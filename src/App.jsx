import React, { useEffect, useState, useCallback } from 'react'
import { supabase } from './lib/supabase'
import './App.css'

const STATUS_BADGE = {
  'Production Ready': 'production',
  'Active': 'active',
  'In Development': 'dev',
  'Develop': 'dev',
  'Design Phase': 'design',
  'Pending': 'pending',
  'Complete': 'complete',
}

const EMPTY_FORM = {
  name: '', client: '', status: 'Pending', type: '', start: '', lastActivity: '',
  duration: '', hours: '', location: '', tech: '', scope: '', team: '', billing: '', folder: '',
}

// ---- Auth ----
function Auth({ onAuthed }) {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setError(null); setMsg(null)
    setLoading(true)
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } })
        if (error) throw error
        if (data?.session) {
          onAuthed(data.session.user)
        } else {
          setMsg('Account created! Check your email to confirm, then sign in.')
          setMode('signin')
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        onAuthed(data.user)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1>Agency Project Tracker</h1>
        <p className="auth-sub">Sign in to manage projects</p>
        <form onSubmit={submit}>
          {mode === 'signup' && (
            <div>
              <label>Your Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Aditya" />
            </div>
          )}
          <div>
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </div>
          {msg && <div className="auth-msg">{msg}</div>}
          {error && <div className="auth-error">{error}</div>}
          <button className="primary auth-btn" type="submit" disabled={loading}>
            {loading ? 'Please wait...' : mode === 'signup' ? 'Create Account' : 'Sign In'}
          </button>
        </form>
        <button className="switch-mode" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); setMsg(null); }}>
          {mode === 'signin' ? 'New here? Create an account' : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  )
}

// ---- Main ----
function AppInner({ user }) {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sortField, setSortField] = useState('lastActivity')
  const [editing, setEditing] = useState(null) // project object or null
  const [showForm, setShowForm] = useState(false)
  const [viewing, setViewing] = useState(null)

  const fetchProjects = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('updated_at', { ascending: false })
    if (error) {
      alert('Failed to load projects: ' + error.message)
    } else {
      setProjects(data || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchProjects() }, [fetchProjects])

  const signOut = async () => {
    await supabase.auth.signOut()
    window.location.reload()
  }

  const saveProject = async (form) => {
    const payload = {
      name: form.name,
      client: form.client,
      status: form.status,
      type: form.type,
      start: form.start || null,
      last_activity: form.lastActivity || null,
      duration: form.duration ? Number(form.duration) : null,
      hours: form.hours ? Number(form.hours) : null,
      location: form.location,
      tech: form.tech,
      scope: form.scope,
      team: form.team,
      billing: form.billing,
      folder: form.folder,
      updated_at: new Date().toISOString(),
    }
    let err = null
    if (editing) {
      ;({ error: err } = await supabase.from('projects').update(payload).eq('id', editing.id))
    } else {
      ;({ error: err } = await supabase.from('projects').insert(payload))
    }
    if (err) { alert('Save failed: ' + err.message); return false }
    fetchProjects()
    setShowForm(false)
    setEditing(null)
    return true
  }

  const deleteProject = async (id, name) => {
    if (!confirm('Delete "' + name + '"?')) return
    const { error } = await supabase.from('projects').delete().eq('id', id)
    if (error) { alert('Delete failed: ' + error.message); return }
    fetchProjects()
  }

  const filtered = projects
    .filter((p) =>
      (!statusFilter || p.status === statusFilter) &&
      (!q || (p.name + ' ' + (p.client || '') + ' ' + (p.tech || '') + ' ' + (p.scope || '')).toLowerCase().includes(q.toLowerCase()))
    )
    .sort((a, b) => {
      const s = {
        name: (x, y) => x.name.localeCompare(y.name),
        client: (x, y) => (x.client || '').localeCompare(y.client || ''),
        start: (x, y) => (x.start || '').localeCompare(y.start || ''),
        duration: (x, y) => (Number(x.duration) || 0) - (Number(y.duration) || 0),
        lastActivity: (x, y) => (y.last_activity || '').localeCompare(x.last_activity || ''),
      }[sortField]
      return s ? s(a, b) : 0
    })

  const stats = {
    total: projects.length,
    active: projects.filter((p) => ['Active', 'In Development', 'Design Phase'].includes(p.status)).length,
    production: projects.filter((p) => p.status === 'Production Ready').length,
    hours: projects.reduce((s, p) => s + (Number(p.hours) || 0), 0),
  }

  return (
    <>
      <header className="header">
        <div>
          <h1>Agency Project Tracker</h1>
          <div className="sub">Signed in as {user?.email}</div>
        </div>
        <div className="header-actions">
          <button onClick={() => exportCSV(filtered)}>Export CSV</button>
          <button onClick={() => exportJSON(filtered)}>Export JSON</button>
          <button className="primary" onClick={() => { setEditing(null); setShowForm(true) }}>+ New Project</button>
          <button onClick={signOut}>Sign Out</button>
        </div>
      </header>

      <main className="main">
        <div className="stats">
          <Stat num={stats.total} label="Total Projects" />
          <Stat num={stats.active} label="Active / In Dev" />
          <Stat num={stats.production} label="Production Ready" />
          <Stat num={stats.hours || '—'} label="Total Hours" />
        </div>

        <div className="toolbar">
          <input type="search" placeholder="Search projects..." value={q} onChange={(e) => setQ(e.target.value)} />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            {Object.keys(STATUS_BADGE).map((s) => <option key={s}>{s}</option>)}
          </select>
          <select value={sortField} onChange={(e) => setSortField(e.target.value)}>
            <option value="lastActivity">Sort: Last Activity</option>
            <option value="start">Sort: Start Date</option>
            <option value="duration">Sort: Duration</option>
            <option value="name">Sort: Name</option>
            <option value="client">Sort: Client</option>
          </select>
        </div>

        {loading ? (
          <div className="empty">Loading projects...</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Project</th><th>Client</th><th>Status</th><th>Start</th>
                <th>Last Activity</th><th>Duration</th><th>Type</th><th>Hours</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td><strong>{p.name}</strong>{p.folder ? <div className="cell-sub">{p.folder}</div> : ''}</td>
                  <td>{p.client || '—'}</td>
                  <td><span className={`badge ${STATUS_BADGE[p.status] || 'pending'}`}>{p.status}</span></td>
                  <td>{fmtDate(p.start)}</td>
                  <td>{fmtDate(p.last_activity)}</td>
                  <td>{p.duration ? p.duration + ' days' : '—'}</td>
                  <td>{p.type || '—'}</td>
                  <td>{p.hours ?? '—'}</td>
                  <td>
                    <div className="row-actions">
                      <button onClick={() => setViewing(p)}>Details</button>
                      <button onClick={() => { setEditing(p); setShowForm(true) }}>Edit</button>
                      <button className="danger" onClick={() => deleteProject(p.id, p.name)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && filtered.length === 0 && <div className="empty">No projects found.</div>}
      </main>

      {showForm && (
        <ProjectForm
          initial={editing}
          onCancel={() => { setShowForm(false); setEditing(null) }}
          onSave={saveProject}
        />
      )}

      {viewing && <ProjectView project={viewing} onClose={() => setViewing(null)} />}
    </>
  )
}

function Stat({ num, label }) {
  return (
    <div className="stat">
      <div className="num">{num}</div>
      <div className="label">{label}</div>
    </div>
  )
}

function ProjectForm({ initial, onCancel, onSave }) {
  const [form, setForm] = useState(initial ? {
    name: initial.name, client: initial.client, status: initial.status, type: initial.type,
    start: initial.start || '', lastActivity: initial.last_activity || '', duration: initial.duration || '',
    hours: initial.hours || '', location: initial.location, tech: initial.tech, scope: initial.scope,
    team: initial.team, billing: initial.billing, folder: initial.folder,
  } : { ...EMPTY_FORM })
  const [error, setError] = useState(null)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = (e) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Project name is required'); return }
    // auto-calc duration from dates if empty
    let duration = form.duration
    if (!duration && form.start && form.lastActivity) {
      duration = Math.max(1, Math.round((new Date(form.lastActivity) - new Date(form.start)) / 86400000)) + 1
    }
    onSave({ ...form, name: form.name.trim(), duration })
  }

  return (
    <div className="modal-backdrop open" onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}>
      <div className="modal">
        <h2>{initial ? 'Edit Project' : 'New Project'}</h2>
        <form onSubmit={submit}>
          <div className="form-grid">
            <div><label className="required">Project Name</label><input value={form.name} onChange={set('name')} autoFocus /></div>
            <div><label>Client</label><input value={form.client} onChange={set('client')} /></div>
            <div><label>Status</label>
              <select value={form.status} onChange={set('status')}>
                {Object.keys(STATUS_BADGE).map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div><label>Type</label><input value={form.type} onChange={set('type')} placeholder="e.g. Marketing Website" /></div>
            <div><label>Start Date</label><input type="date" value={form.start} onChange={set('start')} /></div>
            <div><label>Last Activity</label><input type="date" value={form.lastActivity} onChange={set('lastActivity')} /></div>
            <div><label>Duration (days)</label><input type="number" min="0" value={form.duration} onChange={set('duration')} placeholder="auto" /></div>
            <div><label>Total Hours</label><input type="number" min="0" value={form.hours} onChange={set('hours')} /></div>
            <div className="full"><label>Location</label><input value={form.location} onChange={set('location')} /></div>
            <div className="full"><label>Folder</label><input value={form.folder} onChange={set('folder')} placeholder="e.g. 9-pm/" /></div>
            <div className="full"><label>Tech Stack</label><input value={form.tech} onChange={set('tech')} /></div>
            <div className="full"><label>Scope / Deliverables</label><textarea value={form.scope} onChange={set('scope')} /></div>
            <div className="full"><label>Team Members</label><input value={form.team} onChange={set('team')} placeholder="comma separated" /></div>
            <div className="full"><label>Billing / Notes</label><textarea value={form.billing} onChange={set('billing')} /></div>
          </div>
          {error && <div className="auth-error">{error}</div>}
          <div className="modal-actions">
            <button type="button" onClick={onCancel}>Cancel</button>
            <button className="primary" type="submit">Save Project</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ProjectView({ project, onClose }) {
  const rows = [
    ['Client', project.client], ['Status', project.status], ['Type', project.type],
    ['Start Date', fmtDate(project.start)], ['Last Activity', fmtDate(project.last_activity)],
    ['Duration', project.duration + ' days'], ['Location', project.location], ['Hours', project.hours],
    ['Tech Stack', project.tech], ['Team', project.team], ['Folder', project.folder],
    ['Commits', project.commits], ['Scope', project.scope], ['Billing', project.billing],
  ].filter(([, v]) => v != null && v !== '')

  return (
    <div className="modal-backdrop open" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <h2>{project.name}</h2>
        <table className="detail-table">
          <tbody>
            {rows.map(([k, v]) => (
              <tr key={k}><td><strong>{k}</strong></td><td>{v}</td></tr>
            ))}
          </tbody>
        </table>
        <div className="modal-actions"><button className="primary" onClick={onClose}>Close</button></div>
      </div>
    </div>
  )
}

// ---- Export helpers ----
function exportCSV(list) {
  const headers = ['Name', 'Client', 'Status', 'Type', 'Start', 'Last Activity', 'Duration', 'Hours', 'Location', 'Tech', 'Scope', 'Team', 'Billing', 'Folder']
  const key = { 'Name': 'name', 'Client': 'client', 'Status': 'status', 'Type': 'type', 'Start': 'start', 'Last Activity': 'last_activity', 'Duration': 'duration', 'Hours': 'hours', 'Location': 'location', 'Tech': 'tech', 'Scope': 'scope', 'Team': 'team', 'Billing': 'billing', 'Folder': 'folder' }
  const body = list.map((p) => headers.map((h) => '"' + String(p[key[h]] != null ? p[key[h]] : '').replace(/"/g, '""') + '"').join(','))
  download((headers.join(',') + '\n' + body.join('\n')), 'agency-projects.csv', 'text/csv')
}

function exportJSON(list) {
  download(JSON.stringify(list, null, 2), 'agency-projects.json', 'application/json')
}

function download(content, filename, type) {
  const blob = new Blob([content], { type })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

// ---- Misc ----
function fmtDate(d) {
  if (!d) return '—'
  const dt = new Date(d)
  const day = String(dt.getDate()).padStart(2, '0')
  const mon = String(dt.getMonth() + 1).padStart(2, '0')
  return `${day}-${mon}-${dt.getFullYear()}`
}

// ---- Root ----
export default function App() {
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(true)

  // detect existing session on load
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data?.session?.user ?? null)
      setChecking(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
    })
    return () => sub?.subscription?.unsubscribe()
  }, [])

  if (checking) return <div className="auth-wrap"><div className="auth-card">Loading...</div></div>
  return user ? <AppInner user={user} /> : <Auth onAuthed={setUser} />
}
