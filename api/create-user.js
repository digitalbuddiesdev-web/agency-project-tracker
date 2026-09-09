import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!SERVICE_ROLE) return res.status(500).json({ error: 'SERVICE_ROLE not configured on server' })

  const { action = 'create', email, password, role } = req.body || {}
  if (!email) return res.status(400).json({ error: 'email is required' })
  if (action !== 'reset-password') {
    if (!role || !['owner', 'intern', 'viewer'].includes(role)) return res.status(400).json({ error: 'invalid role' })
  }
  if (action === 'create' && (!password || String(password).length < 6)) return res.status(400).json({ error: 'password must be at least 6 characters' })

  const authHeader = req.headers['authorization'] || ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ error: 'Sign in first' })

  const anon = createClient(SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)
  const { data: caller, error: callerErr } = await anon.auth.getUser(token)
  if (callerErr || !caller?.user) return res.status(401).json({ error: 'Invalid session' })

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE)
  const { data: profile, error: profileErr } = await admin
    .from('profiles').select('role, owner_id').eq('user_id', caller.user.id).maybeSingle()
  if (profileErr) return res.status(500).json({ error: 'Could not load your role' })
  if (!profile || profile.role !== 'owner') return res.status(403).json({ error: 'Only the workspace owner can do this' })

  const normalizedEmail = email.trim().toLowerCase()

  // Find an existing auth user (we may create, update role, or reset password).
  const { data: existing } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })

  if (action === 'reset-link') {
    const target = (existing.users || []).find((u) => u.email === normalizedEmail)
    if (!target) return res.status(404).json({ error: `No account for ${normalizedEmail}. Create it instead.` })
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email: normalizedEmail,
    })
    if (linkErr || !linkData?.properties?.action_link) return res.status(500).json({ error: 'Failed to generate reset link: ' + (linkErr?.message || 'no link returned') })
    return res.status(200).json({ ok: true, email: normalizedEmail, action: 'reset-link', reset_link: linkData.properties.action_link })
  }

  if (action === 'reset-password') {
    if (!password || String(password).length < 6) return res.status(400).json({ error: 'password must be at least 6 characters' })
    const target = (existing.users || []).find((u) => u.email === normalizedEmail)
    if (!target) return res.status(404).json({ error: `No account for ${normalizedEmail}. Create it instead.` })
    const { error: resetErr } = await admin.auth.admin.updateUserById(target.id, { password: String(password) })
    if (resetErr) return res.status(500).json({ error: 'Failed to reset password: ' + resetErr.message })
    return res.status(200).json({ ok: true, email: normalizedEmail, action: 'reset-password' })
  }

  if (action === 'role') {
    const target = (existing.users || []).find((u) => u.email === normalizedEmail)
    if (!target) return res.status(404).json({ error: `No account for ${normalizedEmail}. Create it instead.` })
    const { error: roleErr } = await admin
      .from('profiles').upsert({
        user_id: target.id,
        role,
        owner_id: profile.owner_id,
        updated_at: new Date().toISOString(),
      })
    if (roleErr) return res.status(500).json({ error: 'Failed to update role: ' + roleErr.message })
    return res.status(200).json({ ok: true, email: normalizedEmail, role, action: 'role' })
  }

  // action === 'create'
  if ((existing.users || []).some((u) => u.email === normalizedEmail)) {
    return res.status(409).json({ error: `An account for ${normalizedEmail} already exists` })
  }

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: normalizedEmail,
    password: String(password),
    email_confirm: true,
    user_metadata: { full_name: normalizedEmail.split('@')[0] },
  })
  if (createErr) return res.status(400).json({ error: createErr.message })

  const { error: roleErr } = await admin
    .from('profiles').upsert({
      user_id: created.user.id,
      role,
      owner_id: profile.owner_id,
      updated_at: new Date().toISOString(),
    })
  if (roleErr) return res.status(500).json({ error: 'Account created but role failed: ' + roleErr.message })

  return res.status(200).json({ ok: true, email: normalizedEmail, role, action: 'create' })
}
