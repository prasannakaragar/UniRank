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
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-text-primary">
          Welcome back, <span className="text-primary">{user?.name?.split(' ')[0]}</span> 👋
        </h1>
        <p className="text-text-secondary mt-2 text-[15px] font-medium">{user?.branch} · Year {user?.year}</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          label="Codeforces Rating"
          value={profile?.cf_rating || 0}
          sub={profile?.cf_rank || 'unrated'}
          accent="text-primary"
          highlight
        />
        <StatCard
          label="Problems Solved"
          value={profile?.cf_problems_solved || 0}
          sub="on Codeforces"
        />
        <StatCard
          label="College Rank"
          value={rank ? `#${rank}` : '—'}
          sub="Global Leaderboard"
          accent={rankColor(rank)}
          highlight={rank === 1}
        />
        <StatCard
          label="GitHub Score"
          value={profile?.github_score ? `${profile.github_score}/10` : '—'}
          sub="Project Analysis"
        />
      </div>

      {/* CF Handle CTA */}
      {!profile?.cf_handle && (
        <div className="bg-accent-pill border border-primary/20 rounded-xl p-6 flex items-center justify-between">
          <div>
            <p className="font-bold text-text-primary text-lg">Connect Codeforces</p>
            <p className="text-sm text-text-secondary mt-1 font-medium">Add your handle to appear on the leaderboard and track your progress.</p>
          </div>
          <Link to="/profile" className="btn-primary py-2.5">Set Handle →</Link>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-10">
        {/* Recent Announcements */}
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
                    <span className={`badge mb-2 ${
                      a.category === 'hackathon' ? 'badge-purple' :
                      a.category === 'contest'   ? 'badge-blue' :
                      'bg-gray-100 text-gray-600'
                    }`}>{a.category}</span>
                    <p className="font-bold text-text-primary text-[15px] truncate">{a.title}</p>
                    <p className="text-xs text-text-secondary mt-1 font-medium">by {a.author}</p>
                  </div>
                  {a.link && (
                    <a href={a.link} target="_blank" rel="noreferrer"
                       className="text-xs font-bold text-primary hover:underline shrink-0 bg-accent-pill px-3 py-1.5 rounded-lg">
                      Apply →
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Team Posts */}
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
                  <span className={`badge shrink-0 px-3 py-1 ${
                    t.post_type === 'looking' ? 'bg-green-50 text-green-600' : 'badge-amber'
                  }`}>
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
    // Mentors see top students
    api.get('/leaderboard?limit=5').then(r => setTopStudents(r.data.leaderboard.slice(0, 5))).catch(() => {})
    // Mentors can see general stats (if we allow them or use a public stats endpoint)
    // For now, let's assume they can see basic counts
    api.get('/admin/stats').then(r => setStats(r.data)).catch(() => {})
    setLoading(false)
  }, [])

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      <div>
        <h1 className="text-4xl font-bold text-text-primary">
          Mentor Dashboard <span className="text-primary">🎓</span>
        </h1>
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

function AdminDashboard() {
  const { user } = useAuth()
  const [view, setView] = useState('overview') // overview | users | hackathons | leaderboard
  const [stats, setStats] = useState(null)
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (view === 'overview') {
      api.get('/admin/stats').then(r => setStats(r.data)).catch(() => {})
    } else if (view === 'users') {
      setLoading(true)
      api.get('/admin/users').then(r => setUsers(r.data.users)).finally(() => setLoading(false))
    }
  }, [view])

  const handleRoleChange = async (uid, newRole) => {
    try {
      await api.post(`/admin/user/${uid}/role`, { role: newRole })
      setUsers(prev => prev.map(u => u.id === uid ? { ...u, role: newRole } : u))
    } catch (err) {
      alert("Failed to update role")
    }
  }

  const handleAdjustScore = async (uid, points) => {
    try {
      const res = await api.post(`/admin/user/${uid}/score`, { points, reason: "Manual Admin Adjustment" })
      setUsers(prev => prev.map(u => u.id === uid ? { ...u, global_score: res.data.new_score } : u))
    } catch (err) {
      alert("Failed to adjust score")
    }
  }

  const handleRecalculateAll = async () => {
    setLoading(true)
    try {
      await api.post('/admin/recalculate')
      alert("Global score recalculation complete!")
      // Refresh stats/users
      api.get('/admin/stats').then(r => setStats(r.data))
      if (view === 'users') api.get('/admin/users').then(r => setUsers(r.data.users))
    } catch (err) {
      alert("Recalculation failed")
    } finally {
      setLoading(false)
    }
  }

  if (view === 'users') {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="flex items-center justify-between">
          <button onClick={() => setView('overview')} className="text-primary font-bold hover:underline">← Back to Overview</button>
          <h2 className="text-2xl font-bold text-text-primary">Manage Users & Scores</h2>
        </div>
        <div className="card overflow-hidden p-0">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 border-b border-border-dim">
              <tr>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-text-secondary">Name / Email</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-text-secondary">Academic</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-text-secondary">Score</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-text-secondary">Adjust</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-text-secondary">Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-dim">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-bold text-text-primary">{u.name}</p>
                    <p className="text-xs text-text-secondary font-medium">{u.email}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-text-primary">{u.branch}</p>
                    <p className="text-xs text-text-secondary">Year {u.year}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-extrabold text-primary">{u.global_score.toFixed(1)}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button onClick={() => handleAdjustScore(u.id, 50)} className="bg-emerald-50 text-emerald-600 px-2 py-1 rounded-md text-[10px] font-bold border border-emerald-100 hover:bg-emerald-100">+50</button>
                      <button onClick={() => handleAdjustScore(u.id, -50)} className="bg-rose-50 text-rose-600 px-2 py-1 rounded-md text-[10px] font-bold border border-rose-100 hover:bg-rose-100">-50</button>
                    </div>
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
                </tr>
              ))}
            </tbody>
          </table>
          {loading && <div className="py-20 text-center text-text-secondary italic">Updating rankings…</div>}
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
            <button 
              onClick={handleRecalculateAll}
              disabled={loading}
              className="btn-primary w-full py-3"
            >
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

      {/* Stats Quick Look */}
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

  if (user?.role === 'admin') {
    return <AdminDashboard />
  } else if (user?.role === 'mentor' || user?.role === 'faculty') {
    return <MentorDashboard />
  }

  return <StudentDashboard />
}
