import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'

function StatCard({ label, value, sub, accent, highlight }) {
  return (
    <div className={`card flex flex-col justify-between min-h-[140px] ${highlight ? 'card-accent-strip' : ''}`}>
      <div>
        <span className="section-label">{label}</span>
        <div className={`stat-value mt-2 ${accent || 'text-text-primary'}`}>{value ?? '—'}</div>
      </div>
      {sub && <span className="text-[13px] text-text-secondary font-medium mt-auto">{sub}</span>}
    </div>
  )
}

function StudentDashboard() {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [rank, setRank]       = useState(null)
  const [announcements, setAnnouncements] = useState([])
  const [teams, setTeams]     = useState([])

  useEffect(() => {
    api.get('/profile').then(r => setProfile(r.data)).catch(() => {})
    api.get('/leaderboard').then(r => {
      const entry = r.data.leaderboard.find(e => e.user_id === user?.id)
      setRank(entry?.rank ?? null)
    }).catch(() => {})
    api.get('/announcements').then(r => setAnnouncements(r.data.announcements.slice(0, 3))).catch(() => {})
    api.get('/teams').then(r => setTeams(r.data.teams.slice(0, 3))).catch(() => {})
  }, [user])

  const rankColor = (r) => {
    if (!r) return 'text-text-secondary'
    if (r === 1) return 'text-secondary'
    return 'text-text-primary'
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-4xl font-bold text-text-primary">
          Welcome back, <span className="text-primary">{user?.name?.split(' ')[0]}</span> 👋
        </h1>
        <p className="text-text-secondary mt-2 text-[15px] font-medium">{user?.branch} · Year {user?.year}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label="Codeforces Rating" value={profile?.cf_rating || 0} sub={profile?.cf_rank || 'unrated'} accent="text-primary" highlight />
        <StatCard label="Problems Solved" value={profile?.cf_problems_solved || 0} sub="on Codeforces" />
        <StatCard label="College Rank" value={rank ? `#${rank}` : '—'} sub="Global Leaderboard" accent={rankColor(rank)} highlight={rank === 1} />
        <StatCard label="GitHub Score" value={profile?.github_score ? `${profile.github_score}/10` : '—'} sub="Project Analysis" />
      </div>

      {!profile?.cf_handle && (
        <div className="bg-accent-pill border border-primary/20 rounded-xl p-6 flex items-center justify-between">
          <div>
            <p className="font-bold text-text-primary text-lg">Connect Codeforces</p>
            <p className="text-sm text-text-secondary mt-1 font-medium">Add your handle to appear on the leaderboard and track your progress.</p>
          </div>
          <Link to="/profile?tab=settings" className="btn-primary py-2.5">Set Handle →</Link>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-10">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-text-primary">Latest Opportunities</h2>
            <Link to="/announcements" className="text-sm font-bold text-primary hover:underline">View all →</Link>
          </div>
          <div className="space-y-3">
            {announcements.length === 0 ? (
              <div className="card text-center py-10 text-text-secondary font-medium italic">No announcements yet</div>
            ) : announcements.map(a => (
              <div key={a.id} className="card py-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <span className={`badge mb-2 ${a.category === 'hackathon' ? 'badge-purple' : a.category === 'contest' ? 'badge-blue' : 'bg-gray-100 text-gray-600'}`}>{a.category}</span>
                    <p className="font-bold text-text-primary text-[15px] truncate">{a.title}</p>
                    <p className="text-xs text-text-secondary mt-1 font-medium">by {a.author}</p>
                  </div>
                  {a.link && (
                    <a href={a.link} target="_blank" rel="noreferrer" className="text-xs font-bold text-primary hover:underline shrink-0 bg-accent-pill px-3 py-1.5 rounded-lg">Apply →</a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-text-primary">Team Board</h2>
            <Link to="/teams" className="text-sm font-bold text-primary hover:underline">View all →</Link>
          </div>
          <div className="space-y-3">
            {teams.length === 0 ? (
              <div className="card text-center py-10 text-text-secondary font-medium italic">No team posts yet</div>
            ) : teams.map(t => (
              <div key={t.id} className="card py-4 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-4">
                  <span className={`badge shrink-0 px-3 py-1 ${t.post_type === 'looking' ? 'bg-green-50 text-green-600' : 'badge-amber'}`}>
                    {t.post_type === 'looking' ? '🔍 Looking' : '📢 Recruiting'}
                  </span>
                  <div className="min-w-0">
                    <p className="font-bold text-text-primary text-[15px] truncate">{t.title}</p>
                    <p className="text-xs text-text-secondary mt-1 font-medium uppercase tracking-wider">{t.author} · {t.author_branch} Y{t.author_year}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function MentorDashboard() {
  const { user } = useAuth()
  const [topStudents, setTopStudents] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/leaderboard?limit=5').then(r => setTopStudents(r.data.leaderboard.slice(0, 5))).catch(() => {})
    api.get('/admin/stats').then(r => setStats(r.data)).catch(() => {})
    setLoading(false)
  }, [])

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      <div>
        <h1 className="text-4xl font-bold text-text-primary">Mentor Dashboard <span className="text-primary">🎓</span></h1>
        <p className="text-text-secondary mt-2 text-[15px] font-medium">Monitoring student performance for {user?.name}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label="Total Students" value={stats?.total_users} accent="text-primary" highlight />
        <StatCard label="Hackathons" value={stats?.total_hackathon_results} />
        <StatCard label="Active Teams" value={stats?.total_teams} />
        <StatCard label="Announcements" value={stats?.total_announcements} />
      </div>

      <div className="grid lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-text-primary">Top Performers</h2>
            <Link to="/leaderboard" className="text-sm font-bold text-primary hover:underline">Full Leaderboard →</Link>
          </div>
          <div className="card overflow-hidden p-0">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-border-dim">
                <tr>
                  <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-text-secondary">Rank</th>
                  <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-text-secondary">Student</th>
                  <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-text-secondary">Branch</th>
                  <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-text-secondary text-right">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-dim">
                {topStudents.map((s, idx) => (
                  <tr key={s.user_id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-text-secondary text-sm">#{idx + 1}</td>
                    <td className="px-6 py-4">
                      <p className="font-bold text-text-primary text-sm">{s.name}</p>
                      <p className="text-[10px] text-text-secondary font-medium uppercase">{s.college}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-text-secondary font-medium">{s.branch}</td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-extrabold text-primary">{s.global_score?.toFixed(1)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-bold text-text-primary">Recent Activity</h2>
          <div className="card bg-accent-pill/30 border-dashed border-primary/20 flex flex-col items-center justify-center py-10 text-center">
            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm">
              <span className="text-xl">📊</span>
            </div>
            <p className="text-sm font-bold text-text-primary">Analytics Engine</p>
            <p className="text-[12px] text-text-secondary mt-1 px-4">Student performance trends and automated reports are being generated.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Edit Student Modal ───────────────────────────────────────────────────────
function EditStudentModal({ student, onClose, onSave }) {
  const [form, setForm] = useState({
    cf_handle:   student.cf_handle   || '',
    lc_username: student.lc_username || '',
    github_url:  student.github_url  || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const res = await api.put(`/admin/student/${student.id}`, form)
      // Pass updated fields back to parent so list updates immediately
      onSave(student.id, {
        cf_handle:   form.cf_handle,
        lc_username: form.lc_username,
        github_url:  form.github_url,
      })
      onClose()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white border border-border-dim rounded-2xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border-dim">
          <div>
            <h2 className="text-lg font-bold text-text-primary">Edit Student Profile</h2>
            <p className="text-xs text-text-secondary mt-0.5 font-medium">{student.name} · {student.email}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-gray-100 text-text-secondary hover:bg-gray-200 flex items-center justify-center transition-colors font-bold">✕</button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-red-600 text-sm font-medium">{error}</div>
          )}

          <div>
            <label className="section-label block mb-2">Codeforces Handle</label>
            <input
              className="input font-mono"
              placeholder="e.g. tourist"
              value={form.cf_handle}
              onChange={e => setForm(p => ({ ...p, cf_handle: e.target.value }))}
            />
          </div>

          <div>
            <label className="section-label block mb-2">LeetCode Username</label>
            <input
              className="input font-mono"
              placeholder="e.g. leet_dev"
              value={form.lc_username}
              onChange={e => setForm(p => ({ ...p, lc_username: e.target.value }))}
            />
          </div>

          <div>
            <label className="section-label block mb-2">GitHub Profile URL</label>
            <input
              className="input"
              type="url"
              placeholder="https://github.com/username"
              value={form.github_url}
              onChange={e => setForm(p => ({ ...p, github_url: e.target.value }))}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="btn-primary flex-1 py-3">
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-border-dim text-text-secondary font-bold hover:bg-gray-50 transition-colors">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AdminDashboard() {
  const { user } = useAuth()
  const [view, setView] = useState('overview')
  const [stats, setStats] = useState(null)
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [collegeSearch, setCollegeSearch] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [collegeSuggestions, setCollegeSuggestions] = useState([])

  // Edit modal state
  const [editingUser, setEditingUser] = useState(null)

  const fetchColleges = async (q) => {
    try {
      const res = await api.get(`/admin/colleges/search?q=${encodeURIComponent(q)}`)
      setCollegeSuggestions(res.data.colleges || [])
    } catch (err) {
      console.error('Failed to fetch colleges', err)
    }
  }

  useEffect(() => {
    if (view === 'overview') {
      api.get('/admin/stats').then(r => setStats(r.data)).catch(() => {})
    } else if (view === 'users') {
      setLoading(true)
      api.get('/admin/users')
        .then(r => {
          if (r.data && Array.isArray(r.data.users)) {
            setUsers(r.data.users)
          } else {
            setUsers([])
            console.error("Unexpected API response format:", r.data)
          }
        })
        .catch(err => {
          console.error("Failed to fetch users:", err)
          alert("Failed to load users: " + (err.response?.data?.error || err.message))
        })
        .finally(() => setLoading(false))
    }
  }, [view])

  const handleRoleChange = async (uid, newRole) => {
    try {
      await api.post(`/admin/user/${uid}/role`, { role: newRole })
      setUsers(prev => prev.map(u => u.id === uid ? { ...u, role: newRole } : u))
    } catch (err) {
      alert('Failed to update role')
    }
  }

  const handleAdjustScore = async (uid, points) => {
    try {
      const res = await api.post(`/admin/user/${uid}/score`, { points, reason: 'Manual Admin Adjustment' })
      setUsers(prev => prev.map(u => u.id === uid ? { ...u, global_score: res.data.new_score } : u))
    } catch (err) {
      alert('Failed to adjust score')
    }
  }

  const handleRecalculateAll = async () => {
    setLoading(true)
    try {
      await api.post('/admin/recalculate')
      alert('Global score recalculation complete!')
      api.get('/admin/stats').then(r => setStats(r.data))
      if (view === 'users') {
        api.get('/admin/users').then(r => setUsers(r.data?.users || []))
      }
    } catch (err) {
      alert('Recalculation failed')
    } finally {
      setLoading(false)
    }
  }

  // Called by EditStudentModal after successful save — updates list immediately
  const handleEditSaved = (userId, updatedFields) => {
    setUsers(prev =>
      prev.map(u => u.id === userId ? { ...u, ...updatedFields } : u)
    )
  }

  if (view === 'users') {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        {/* Edit modal — renders on top when a user is selected */}
        {editingUser && (
          <EditStudentModal
            student={editingUser}
            onClose={() => setEditingUser(null)}
            onSave={handleEditSaved}
          />
        )}

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <button onClick={() => setView('overview')} className="text-primary font-bold hover:underline mb-2 block">← Back to Overview</button>
            <h2 className="text-2xl font-bold text-text-primary">Manage Users & Scores</h2>
          </div>
          <div className="relative w-full md:w-72">
            <input
              className="w-full border border-border-dim rounded-lg px-4 py-2 text-sm outline-none focus:border-primary shadow-sm"
              placeholder="Search by college (Type 'All' for all users)"
              value={collegeSearch}
              onChange={(e) => {
                const val = e.target.value
                setCollegeSearch(val)
                setShowSuggestions(true)
                fetchColleges(val)
              }}
              onFocus={() => { setShowSuggestions(true); fetchColleges(collegeSearch) }}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            />
            {showSuggestions && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-border-dim rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                {(!collegeSearch || 'all users'.includes(collegeSearch.toLowerCase()) || collegeSearch.toLowerCase() === 'all') && (
                  <div
                    className="px-4 py-2 text-sm cursor-pointer hover:bg-gray-50 text-text-primary font-medium border-b border-gray-100"
                    onMouseDown={() => { setCollegeSearch('All'); setShowSuggestions(false) }}
                  >
                    All Users
                  </div>
                )}
                {collegeSuggestions.map(c => (
                  <div
                    key={c.domain || c.name}
                    className="px-4 py-2 text-sm cursor-pointer hover:bg-gray-50 text-text-primary"
                    onMouseDown={() => { setCollegeSearch(c.name); setShowSuggestions(false) }}
                  >
                    {c.name}
                  </div>
                ))}
                {collegeSuggestions.length === 0 && collegeSearch && collegeSearch.toLowerCase() !== 'all' && (
                  <div className="px-4 py-2 text-xs text-text-secondary italic text-center">No matching colleges found</div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="card overflow-hidden p-0">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 border-b border-border-dim">
              <tr>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-text-secondary">Name / Email</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-text-secondary">Academic</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-text-secondary">Role</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-text-secondary">Handles</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-text-secondary">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-dim">
              {(users || []).filter(u => {
                const search = (collegeSearch || '').trim().toLowerCase()
                if (!search || search === 'all' || search === 'all users') return true
                const exactMatchExists = (users || []).some(user => user?.college && user.college.toLowerCase() === search)
                if (exactMatchExists) return u?.college && u.college.toLowerCase() === search
                return u?.college && u.college.toLowerCase().includes(search)
              }).map(u => (
                <tr key={u.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <Link to={`/profile/${u.id}`} className="block hover:opacity-80">
                      <p className="font-bold text-text-primary hover:text-primary transition-colors">{u.name}</p>
                      <p className="text-xs text-text-secondary font-medium">{u.email}</p>
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-text-primary">{u.branch}</p>
                    <p className="text-xs text-text-secondary">Year {u.year}</p>
                  </td>
                  <td className="px-6 py-4">
                    <select
                      value={u.role}
                      onChange={(e) => handleRoleChange(u.id, e.target.value)}
                      className="text-sm font-bold bg-white border border-border-dim rounded-lg px-2 py-1 outline-none focus:border-primary cursor-pointer"
                    >
                      <option value="student">Student</option>
                      <option value="mentor">Mentor</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      {u.cf_handle   && <p className="text-xs font-mono text-text-secondary">CF: {u.cf_handle}</p>}
                      {u.lc_username && <p className="text-xs font-mono text-text-secondary">LC: {u.lc_username}</p>}
                      {u.github_url  && <p className="text-xs font-mono text-text-secondary truncate max-w-[120px]">GH: {u.github_url.replace('https://github.com/', '')}</p>}
                      {!u.cf_handle && !u.lc_username && !u.github_url && (
                        <p className="text-xs text-text-secondary italic">No handles</p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => setEditingUser(u)}
                      className="text-xs font-bold text-primary border border-primary/20 bg-accent-pill hover:bg-primary hover:text-white px-3 py-1.5 rounded-lg transition-all"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading && <div className="py-20 text-center text-text-secondary italic">Loading users…</div>}
        </div>
      </div>
    )
  }

  if (view === 'leaderboard') {
    return (
      <div className="space-y-8 animate-in fade-in duration-300">
        <div className="flex items-center justify-between">
          <button onClick={() => setView('overview')} className="text-primary font-bold hover:underline">← Back to Overview</button>
          <h2 className="text-2xl font-bold text-text-primary">Leaderboard Control</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="card space-y-4">
            <h3 className="font-bold text-lg text-text-primary">Force System Sync</h3>
            <p className="text-sm text-text-secondary">
              This will trigger a full recalculation of scores for all users in the system.
              Use this after updating scoring weights or fixing calculation bugs.
            </p>
            <button onClick={handleRecalculateAll} disabled={loading} className="btn-primary w-full py-3">
              {loading ? 'Recalculating...' : 'Recalculate All Scores 🔄'}
            </button>
          </div>

          <div className="card space-y-4">
            <h3 className="font-bold text-lg text-text-primary">Platform Integrity</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-border-dim">
                <span className="text-sm font-medium text-text-primary">Flagged Accounts</span>
                <span className="badge">0</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-border-dim">
                <span className="text-sm font-medium text-text-primary">Pending Verifications</span>
                <span className="badge">12</span>
              </div>
            </div>
            <p className="text-xs text-text-secondary italic font-medium">Auto-moderation is currently active.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      <div>
        <h1 className="text-4xl font-bold text-text-primary">
          Admin Control Panel <span className="text-primary">⚙️</span>
        </h1>
        <p className="text-text-secondary mt-2 text-[15px] font-medium">Full access for {user?.name}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label="Total Users" value={stats?.total_users} accent="text-primary" highlight />
        <StatCard label="Hackathons" value={stats?.total_hackathon_results} />
        <StatCard label="Active Teams" value={stats?.total_teams} />
        <StatCard label="Announcements" value={stats?.total_announcements} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <button onClick={() => setView('users')} className="card text-left bg-red-50/30 border-red-100 hover:bg-red-50 transition-all group">
          <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <span className="text-red-600 text-xl">👥</span>
          </div>
          <h3 className="font-bold text-lg text-red-700">Manage Users</h3>
          <p className="text-sm mt-2 text-text-secondary">Edit user profiles, change roles, and modify achievement points.</p>
          <div className="mt-4 text-xs font-bold text-red-600 uppercase tracking-wider">Open Manager →</div>
        </button>

        <button className="card text-left bg-blue-50/30 border-blue-100 hover:bg-blue-50 transition-all group opacity-60">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
            <span className="text-blue-600 text-xl">🏆</span>
          </div>
          <h3 className="font-bold text-lg text-blue-700">Manage Hackathons</h3>
          <p className="text-sm mt-2 text-text-secondary">Add, update, or delete hackathon events and results.</p>
          <div className="mt-4 text-xs font-bold text-blue-400 uppercase tracking-wider">Coming Soon</div>
        </button>

        <button onClick={() => setView('leaderboard')} className="card text-left bg-purple-50/30 border-purple-100 hover:bg-purple-50 transition-all group">
          <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <span className="text-purple-600 text-xl">⚡</span>
          </div>
          <h3 className="font-bold text-lg text-purple-700">Leaderboard Control</h3>
          <p className="text-sm mt-2 text-text-secondary">Adjust rankings and verify scores manually for platform integrity.</p>
          <div className="mt-4 text-xs font-bold text-purple-600 uppercase tracking-wider">Open Control →</div>
        </button>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()

  if (user?.role === 'admin') return <AdminDashboard />
  if (user?.role === 'mentor' || user?.role === 'faculty') return <MentorDashboard />
  return <StudentDashboard />
}