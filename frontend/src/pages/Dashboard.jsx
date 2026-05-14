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
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-4xl font-bold text-text-primary">
          Mentor Dashboard 👋
        </h1>
        <p className="text-text-secondary mt-2 text-[15px] font-medium">Read-only view for {user?.name}</p>
      </div>
      <div className="card text-center py-20 text-text-secondary">
        <p className="font-bold text-lg mb-2">Welcome, Mentor.</p>
        <p>You have read-only access to view the Leaderboard and Hackathons.</p>
      </div>
    </div>
  )
}

function AdminDashboard() {
  const { user } = useAuth()
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-4xl font-bold text-text-primary text-red-600">
          Admin Control Panel ⚙️
        </h1>
        <p className="text-text-secondary mt-2 text-[15px] font-medium">Full access for {user?.name}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card bg-red-50/50 border-red-100">
          <h3 className="font-bold text-lg text-red-700">Manage Users</h3>
          <p className="text-sm mt-2 text-text-secondary">Edit user profiles and modify points.</p>
        </div>
        <div className="card bg-blue-50/50 border-blue-100">
          <h3 className="font-bold text-lg text-blue-700">Manage Hackathons</h3>
          <p className="text-sm mt-2 text-text-secondary">Add, update, or delete hackathon events.</p>
        </div>
        <div className="card bg-purple-50/50 border-purple-100">
          <h3 className="font-bold text-lg text-purple-700">Leaderboard Control</h3>
          <p className="text-sm mt-2 text-text-secondary">Adjust rankings and verify scores manually.</p>
        </div>
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
