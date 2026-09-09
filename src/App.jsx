import React, { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from './lib/supabase'
import './App.css'

const STATUS_BADGE = {
  'Production Ready': 'production',
  'Active': 'active',
  'In Development': 'dev',
  'Develop': 'dev',
  'Design Phase': 'design',
  'Completed': 'complete',
  'MVP Complete': 'complete',
  'Built': 'production',
  'Active Dev': 'dev',
  'Mid-Development': 'dev',
  'Research': 'design',
  'Pending': 'pending',
}

const STATUS_COLORS = {
  'active': '#5b8cff',
  'dev': '#f5a623',
  'design': '#9aa3b7',
  'production': '#2fd18a',
  'complete': '#2fd18a',
  'pending': '#9aa3b7',
}

const EMPTY_FORM = {
  name: '', client: '', status: 'Pending', type: '', start: '', lastActivity: '',
  duration: '', hours: '', progress: '', location: '', tech: '', scope: '', team: '', billing: '', folder: '',
}

// ---- Auth ----
function Auth({ onAuthed }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      onAuthed(data.user)
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
        <p className="auth-sub">Sign in to manage your projects</p>
        <form onSubmit={submit}>
          <div>
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <div className="auth-error">{error}</div>}
          <button className="primary auth-btn" type="submit" disabled={loading}>
            {loading ? 'Please wait...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ---- Set new password (landed via recovery link) ----
function RecoveryForm() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState(null)
  const [msg, setMsg] = useState(null)
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError(null); setMsg(null)
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setMsg('Password updated. Sign in with your new password.')
      await supabase.auth.signOut()
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
        <p className="auth-sub">Set a new password</p>
        <form onSubmit={submit}>
          <div>
            <label>New Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoFocus />
          </div>
          <div>
            <label>Confirm Password</label>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={6} />
          </div>
          {msg && <div className="auth-msg">{msg}</div>}
          {error && <div className="auth-error">{error}</div>}
          <button className="primary auth-btn" type="submit" disabled={loading}>
            {loading ? 'Saving...' : 'Set Password'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ---- AppShell ----
function AppInner({ user }) {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null) // { role, owner_id } or null
  const [view, setView] = useState('dashboard')
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sortField, setSortField] = useState('lastActivity')
  const [editing, setEditing] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [viewing, setViewing] = useState(null)

  const role = profile?.role || 'owner' // fresh signups with no profile can still work
  const canEdit = role !== 'viewer'
  const ownerId = profile?.owner_id || user.id

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('role, owner_id')
        .eq('user_id', user.id)
        .maybeSingle()
      setProfile(data || null)
    })()
  }, [user.id])

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
      progress: form.progress !== '' ? Number(form.progress) : null,
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
      ;({ error: err } = await supabase.from('projects').insert({ ...payload, owner_id: ownerId }))
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

  const updateStatus = async (id, status) => {
    const { error } = await supabase
      .from('projects')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) { alert('Status update failed: ' + error.message); return }
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
        progress: (x, y) => (Number(x.progress) || 0) - (Number(y.progress) || 0),
        duration: (x, y) => (Number(x.duration) || 0) - (Number(y.duration) || 0),
        lastActivity: (x, y) => (y.last_activity || '').localeCompare(x.last_activity || ''),
      }[sortField]
      return s ? s(a, b) : 0
    })

  const stats = {
    total: projects.length,
    active: projects.filter((p) => ['Active', 'In Development', 'Develop', 'Active Dev', 'Mid-Development'].includes(p.status)).length,
    production: projects.filter((p) => ['Production Ready', 'Built', 'Completed', 'MVP Complete'].includes(p.status)).length,
    hours: projects.reduce((s, p) => s + (Number(p.hours) || 0), 0),
    days: projects.reduce((s, p) => s + (Number(p.duration) || 0), 0),
    avgProgress: projects.length ? Math.round(projects.reduce((s, p) => s + (Number(p.progress) || 0), 0) / projects.length) : 0,
  }

  return (
    <div className="app-shell">
      <header className="header">
        <div className="header-inner">
          <div>
            <h1><span className="brand-dot" />Agency Project Tracker</h1>
            <div className="sub">Signed in as {user?.email}</div>
          </div>
          <div className="header-actions">
            <button onClick={() => exportCSV(filtered)}>Export CSV</button>
            <button onClick={() => exportJSON(filtered)}>Export JSON</button>
            {canEdit && <button className="primary" onClick={() => { setEditing(null); setShowForm(true) }}>+ New Project</button>}
            <button onClick={signOut}>Sign Out</button>
          </div>
        </div>
        <div className="tabs">
          {['dashboard', 'board', 'table', ...(role === 'owner' ? ['people'] : [])].map((v) => (
            <button key={v} className={`tab ${view === v ? 'active' : ''}`} onClick={() => setView(v)}>
              {v === 'dashboard' ? 'Dashboard' : v === 'board' ? 'Board' : v === 'table' ? 'Table' : 'People'}
            </button>
          ))}
        </div>
      </header>

      <main className="main">
        {loading ? (
          <div className="empty">Loading projects...</div>
        ) : view === 'people' ? (
          <PeopleView ownerId={ownerId} />
        ) : view === 'dashboard' ? (
          <Dashboard projects={projects} stats={stats} onOpen={setViewing} onClickNew={canEdit ? () => { setEditing(null); setShowForm(true) } : null} />
        ) : view === 'board' ? (
          <BoardView projects={projects} filters={{ q, statusFilter, sortField }} onSetQ={setQ} onSetStatus={setStatusFilter} onSetSort={setSortField} onOpen={setViewing} onMove={updateStatus} canDrag={canEdit} />
        ) : (
          <>
            <Toolbar q={q} setQ={setQ} statusFilter={statusFilter} setStatusFilter={setStatusFilter} sortField={sortField} setSortField={setSortField} />
            {filtered.length === 0 ? (
              <div className="empty"><div className="big">📭</div>No projects found.</div>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Project</th><th>Client</th><th>Status</th><th>Start</th>
                      <th>Last Activity</th><th>Duration</th><th>Progress</th><th>Hours</th><th></th>
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
                        <td><Progress val={p.progress} /></td>
                        <td>{p.hours ?? '—'}</td>
                        <td>
                          <div className="row-actions">
                            <button onClick={() => setViewing(p)}>Details</button>
                            {canEdit && <button onClick={() => { setEditing(p); setShowForm(true) }}>Edit</button>}
                            {canEdit && <button className="danger" onClick={() => deleteProject(p.id, p.name)}>Delete</button>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>

      {showForm && (
        <ProjectForm
          initial={editing}
          onCancel={() => { setShowForm(false); setEditing(null) }}
          onSave={saveProject}
        />
      )}

      {viewing && <ProjectView project={viewing} onClose={() => setViewing(null)} canEdit={canEdit} onEdit={() => { setEditing(viewing); setShowForm(true); setViewing(null) }} />}
    </div>
  )
}

function Toolbar({ q, setQ, statusFilter, setStatusFilter, sortField, setSortField }) {
  return (
    <div className="toolbar">
      <input type="search" placeholder="Search projects..." value={q} onChange={(e) => setQ(e.target.value)} />
      <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
        <option value="">All Statuses</option>
        {Object.keys(STATUS_BADGE).map((s) => <option key={s}>{s}</option>)}
      </select>
      <select value={sortField} onChange={(e) => setSortField(e.target.value)}>
        <option value="lastActivity">Sort: Last Activity</option>
        <option value="progress">Sort: Progress</option>
        <option value="start">Sort: Start Date</option>
        <option value="duration">Sort: Duration</option>
        <option value="name">Sort: Name</option>
      </select>
    </div>
  )
}

// ---- Dashboard ----
function Dashboard({ projects, stats, onOpen, onClickNew }) {
  const byStatus = {}
  projects.forEach((p) => {
    const k = STATUS_BADGE[p.status] || 'pending'
    byStatus[k] = byStatus[k] || { count: 0, color: STATUS_COLORS[k], label: k }
    byStatus[k].count++
  })
  const maxCount = Math.max(1, ...Object.values(byStatus).map((s) => s.count))
  const recent = [...projects].sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || '')).slice(0, 6)

  return (
    <div className="dash-grid">
      <div className="stat-cards">
        <StatCard num={stats.total} label="Total Projects" color="#5b8cff" sub={`${stats.active} active`} />
        <StatCard num={stats.production} label="Production Ready" color="#2fd18a" />
        <StatCard num={stats.hours} label="Total Hours" color="#a78bfa" />
        <StatCard num={stats.days} label="Total Days" color="#38bdf8" />
        <StatCard num={stats.avgProgress + '%'} label="Avg Progress" color="#f5a623" />
      </div>

      <div className="dash-grid" style={{ gridTemplateColumns: '1.4fr 1fr' }}>
        <div className="panel">
          <div className="panel-head"><h3>Quick Overview</h3><div className="muted">Latest activity across projects</div></div>
          <div className="recent-list">
            {recent.map((p) => (
              <div className="recent-item" key={p.id} onClick={() => onOpen(p)} style={{ cursor: 'pointer' }}>
                <span className={`badge ${STATUS_BADGE[p.status] || 'pending'}`}>{p.status}</span>
                <div className="info">
                  <div className="name">{p.name}</div>
                  <div className="meta">{p.client || '—'} · Updated {fmtDate(p.updated_at)}</div>
                </div>
                <Progress val={p.progress} />
              </div>
            ))}
          </div>
        </div>

        <div className="dash-grid" style={{ gap: 16 }}>
          <div className="panel">
            <div className="panel-head"><h3>Status Breakdown</h3></div>
            <div className="status-bars">
              {Object.entries(byStatus).sort((a, b) => b[1].count - a[1].count).map(([k, s]) => (
                <div className="status-row" key={k}>
                  <span className="name" style={{ textTransform: 'capitalize' }}>
                    <span className="dot" style={{ background: s.color }} />{s.label}
                  </span>
                  <div className="track"><div className="fill" style={{ width: (s.count / maxCount) * 100 + '%', background: s.color }} /></div>
                  <span className="count">{s.count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><h3>Top Projects by Hours</h3></div>
            <div className="recent-list">
              {[...projects].sort((a, b) => (Number(b.hours) || 0) - (Number(a.hours) || 0)).slice(0, 4).map((p) => (
                <div className="recent-item" key={p.id} onClick={() => onOpen(p)} style={{ cursor: 'pointer' }}>
                  <div className="info">
                    <div className="name">{p.name}</div>
                    <div className="meta">{p.hours ?? 0} hrs · {p.duration ?? 0} days</div>
                  </div>
                  <strong style={{ fontSize: 14 }}>{p.hours ?? '—'}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ num, label, color, sub }) {
  return (
    <div className="stat-card" style={{ '--stat-c': color }}>
      <div className="num">{num}</div>
      <div className="label">{label}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  )
}

function Progress({ val }) {
  const v = Math.min(100, Math.max(0, Number(val) || 0))
  const color = v >= 100 ? '#2fd18a' : v >= 50 ? '#5b8cff' : '#f5a623'
  return (
    <div className="progress-pill">
      <div className="progress-bar"><div className="progress-fill" style={{ width: v + '%', background: color }} /></div>
      <span style={{ fontSize: 12, color: 'var(--muted)', minWidth: 30 }}>{v}%</span>
    </div>
  )
}

// ---- Board (Kanban) ----
const BOARD_ORDER = ['Design Phase', 'Pending', 'Develop', 'In Development', 'Active Dev', 'Mid-Development', 'Active', 'Built', 'MVP Complete', 'Production Ready', 'Completed', 'Research']

function BoardView({ projects, filters, onSetQ, onSetStatus, onSetSort, onOpen, onMove, canDrag }) {
  const [dragId, setDragId] = useState(null)
  const [overCol, setOverCol] = useState(null)
  const dragCount = useRef({})

  const present = new Set(projects.map((p) => p.status))
  const cols = BOARD_ORDER.filter((c) => present.has(c))
  const extras = [...new Set(projects.map((p) => p.status))].filter((s) => !BOARD_ORDER.includes(s))
  const allCols = [...cols, ...extras]
  const groups = allCols.map((c) => ({ col: c, list: projects.filter((p) => p.status === c) }))

  const onDrop = (col) => {
    setOverCol(null)
    const id = dragId
    setDragId(null)
    if (id) onMove(id, col)
  }

  return (
    <>
      <Toolbar {...filters} setQ={onSetQ} setStatusFilter={onSetStatus} setSortField={onSetSort} />
      <div className="board">
        {groups.map(({ col, list }) => (
          <div
            className="board-col"
            key={col}
            onDragOver={(e) => { e.preventDefault(); if (overCol !== col) setOverCol(col) }}
            onDragEnter={(e) => { e.preventDefault(); dragCount.current[col] = (dragCount.current[col] || 0) + 1 }}
            onDragLeave={() => {
              dragCount.current[col] = (dragCount.current[col] || 1) - 1
              if (dragCount.current[col] <= 0) { dragCount.current[col] = 0; setOverCol((c) => (c === col ? null : c)) }
            }}
            onDrop={() => onDrop(col)}
            style={{ outline: overCol === col ? '2px solid var(--accent)' : 'none', outlineOffset: -1, borderRadius: 'var(--radius)' }}
          >
            <div className="board-col-head">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span className="dot" style={{ background: STATUS_COLORS[STATUS_BADGE[col] || 'pending'] }} />{col}
              </span>
              <span style={{ color: 'var(--muted)' }}>{list.length}</span>
            </div>
            <div className="board-cards">
              {list.map((p) => (
                <div
                  className="board-card"
                  key={p.id}
                  draggable={canDrag}
                  onDragStart={(e) => { setDragId(p.id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', p.id) }}
                  onDragEnd={() => { setDragId(null); setOverCol(null); dragCount.current = {} }}
                  onClick={() => onOpen(p)}
                  style={dragId === p.id ? { opacity: 0.4 } : undefined}
                >
                  <div className="name">{p.name}</div>
                  <div className="client">{p.client || '—'}</div>
                  {p.progress != null && <div style={{ marginTop: 10 }}><Progress val={p.progress} /></div>}
                  <div className="meta">
                    {p.duration ? <span>⏱ {p.duration}d</span> : ''}
                    {p.hours ? <span>🕐 {p.hours}h</span> : ''}
                    {p.last_activity ? <span>{fmtDate(p.last_activity)}</span> : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {projects.length === 0 && <div className="empty"><div className="big">🗂</div>No projects yet. Click "+ New Project" to begin.</div>}
    </>
  )
}

// ---- People (owner only) ----
function PeopleView() {
  const [members, setMembers] = useState([])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('intern')
  const [error, setError] = useState(null)
  const [msg, setMsg] = useState(null)
  const [loading, setLoading] = useState(false)
  const [resetLink, setResetLink] = useState(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('list_members')
    if (!error) setMembers(data || [])
  }, [])

  useEffect(() => { load() }, [load])

  const create = async (e) => {
    e.preventDefault()
    setError(null); setMsg(null); setLoading(true)
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token
      const res = await fetch('/api/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ email, password, role }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`)
      setMsg(`Account created: ${json.email} (${json.role}). Hand them the password.`)
      setEmail(''); setPassword('')
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const changeRole = async (mEmail, newRole) => {
    const { data: session } = await supabase.auth.getSession()
    const token = session?.session?.access_token
    const res = await fetch('/api/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ action: 'role', email: mEmail, role: newRole }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) { alert(json.error || 'Failed to update role'); return }
    load()
  }

  const generateResetLink = async (mEmail) => {
    const { data: session } = await supabase.auth.getSession()
    const token = session?.session?.access_token
    const res = await fetch('/api/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ action: 'reset-link', email: mEmail }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) { alert(json.error || 'Failed to generate reset link'); return }
    const link = json.reset_link
    setResetLink(link ? { email: mEmail, link } : null)
  }

  const ROLE_LABEL = { owner: 'Owner', intern: 'Intern', viewer: 'Boss' }

  return (
    <div className="dash-grid">
      <div className="panel">
        <div className="panel-head"><h3>Create a member account</h3><div className="muted">Only the owner can do this. The account is created instantly (no email confirmation needed) — give the person their email + password to sign in.</div></div>
        <form onSubmit={create} style={{ padding: 20, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="intern@example.com" />
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label>Password</label>
            <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} placeholder="Pick a password" />
          </div>
          <div style={{ minWidth: 200 }}>
            <label>Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="intern">Intern (full access)</option>
              <option value="viewer">Boss (read-only)</option>
            </select>
          </div>
          <button className="primary" type="submit" disabled={loading}>{loading ? 'Creating...' : 'Create account'}</button>
        </form>
        {error && <div className="auth-error" style={{ margin: '0 20px 20px' }}>{error}</div>}
        {msg && <div className="auth-msg" style={{ margin: '0 20px 20px' }}>{msg}</div>}
      </div>

      <div className="panel">
        <div className="panel-head"><h3>Team members</h3><div className="muted">{members.length} in this workspace</div></div>
        {resetLink && (
          <div style={{ padding: '0 20px 16px' }}>
            <div className="auth-msg" style={{ margin: 0 }}>
              <strong>Reset link for {resetLink.email}</strong> — share it with them. It expires in a few minutes.
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <code style={{ background: 'var(--panel2)', padding: '8px 12px', borderRadius: 8, fontSize: 12, wordBreak: 'break-all', flex: 1 }}>{resetLink.link}</code>
              <button className="primary" onClick={() => { navigator.clipboard?.writeText(resetLink.link); setMsg('Link copied to clipboard') }}>Copy</button>
              <button className="ghost" onClick={() => setResetLink(null)}>Dismiss</button>
            </div>
          </div>
        )}
        <div className="recent-list">
          {members.map((m) => (
            <div className="recent-item" key={m.email}>
              <span className="badge" style={{ minWidth: 60, textAlign: 'center' }}>{ROLE_LABEL[m.role] || m.role}</span>
              <div className="info" style={{ flex: 1 }}>
                <div className="name">{m.email}</div>
                <div className="meta">{m.is_owner ? 'Workspace owner' : 'Member'}</div>
              </div>
              {!m.is_owner && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select value={m.role} onChange={(e) => changeRole(m.email, e.target.value)} style={{ maxWidth: 130 }}>
                    <option value="intern">Intern</option>
                    <option value="viewer">Boss</option>
                  </select>
                  <button className="ghost" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => generateResetLink(m.email)} title="Generate reset link">Reset</button>
                </div>
              )}
            </div>
          ))}
          {members.length === 0 && <div className="empty" style={{ padding: 20 }}>No members yet.</div>}
        </div>
      </div>
    </div>
  )
}

// ---- Forms / Details ----
function ProjectForm({ initial, onCancel, onSave }) {
  const [form, setForm] = useState(initial ? {
    name: initial.name, client: initial.client, status: initial.status, type: initial.type,
    start: initial.start || '', lastActivity: initial.last_activity || '', duration: initial.duration || '',
    hours: initial.hours || '', progress: initial.progress ?? '', location: initial.location, tech: initial.tech,
    scope: initial.scope, team: initial.team, billing: initial.billing, folder: initial.folder,
  } : { ...EMPTY_FORM })
  const [error, setError] = useState(null)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = (e) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Project name is required'); return }
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
            <div className="full"><label>Progress</label>
              <div className="range-wrap">
                <input type="range" min="0" max="100" value={form.progress || 0} onChange={set('progress')} />
                <span className="range-val">{form.progress || 0}%</span>
              </div>
            </div>
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

function ProjectView({ project, onClose, onEdit, canEdit }) {  const rows = [
    ['Client', project.client], ['Status', project.status], ['Type', project.type],
    ['Start Date', fmtDate(project.start)], ['Last Activity', fmtDate(project.last_activity)],
    ['Duration', project.duration ? project.duration + ' days' : null], ['Progress', project.progress != null ? project.progress + '%' : null],
    ['Location', project.location], ['Hours', project.hours], ['Tech Stack', project.tech],
    ['Team', project.team], ['Folder', project.folder], ['Commits', project.commits],
    ['Scope', project.scope], ['Billing', project.billing],
  ].filter(([, v]) => v != null && v !== '')

  return (
    <div className="modal-backdrop open" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <h2>{project.name}</h2>
        {project.progress != null && <div style={{ marginBottom: 16 }}><Progress val={project.progress} /></div>}
        <table className="detail-table">
          <tbody>
            {rows.map(([k, v]) => (
              <tr key={k}><td><strong>{k}</strong></td><td>{v}</td></tr>
            ))}
          </tbody>
        </table>
        <div className="modal-actions">
          {canEdit && <button onClick={onEdit}>Edit</button>}
          <button className="primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

// ---- Export helpers ----
function exportCSV(list) {
  const headers = ['Name', 'Client', 'Status', 'Type', 'Start', 'Last Activity', 'Duration', 'Hours', 'Progress', 'Location', 'Tech', 'Scope', 'Team', 'Billing', 'Folder']
  const key = { 'Name': 'name', 'Client': 'client', 'Status': 'status', 'Type': 'type', 'Start': 'start', 'Last Activity': 'last_activity', 'Duration': 'duration', 'Hours': 'hours', 'Progress': 'progress', 'Location': 'location', 'Tech': 'tech', 'Scope': 'scope', 'Team': 'team', 'Billing': 'billing', 'Folder': 'folder' }
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
  const [recovery, setRecovery] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data?.session?.user ?? null)
      setChecking(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((evt, session) => {
      if (evt === 'PASSWORD_RECOVERY') setRecovery(true)
      setUser(session?.user ?? null)
    })
    return () => sub?.subscription?.unsubscribe()
  }, [])

  if (checking) return <div className="auth-wrap"><div className="auth-card">Loading...</div></div>
  if (recovery) return <RecoveryForm />
  return user ? <AppInner user={user} /> : <Auth onAuthed={setUser} />
}
