import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="card flex flex-col gap-1">
      <span className="text-xs font-display font-semibold text-slate-500 uppercase tracking-wider">{label}</span>
      <span className={`text-3xl font-display font-bold ${accent || 'text-white'}`}>{value ?? '—'}</span>
      {sub && <span className="text-xs text-slate-500 font-mono">{sub}</span>}
    </div>
  )
}

export default function Dashboard() {
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
    if (!r) return 'text-slate-400'
    if (r === 1) return 'text-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.3)]'
    if (r <= 3)  return 'text-orange-400'
    if (r <= 10) return 'text-accent-indigo'
    return 'text-white'
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-display font-bold text-3xl text-white">
          Welcome back, <span className="text-accent-indigo">{user?.name?.split(' ')[0]}</span> 👋
        </h1>
        <p className="text-slate-400 mt-1 text-sm">{user?.branch} · Year {user?.year}</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="CF Rating"
          value={profile?.cf_rating || 0}
          sub={profile?.cf_rank || 'unrated'}
          accent="text-accent-indigo"
        />
        <StatCard
          label="Problems Solved"
          value={profile?.cf_problems_solved || 0}
          sub="on Codeforces"
        />
        <StatCard
          label="College Rank"
          value={rank ? `#${rank}` : '—'}
          sub="leaderboard"
          accent={rankColor(rank)}
        />
        <StatCard
          label="Branch"
          value={user?.branch}
          sub={`Year ${user?.year}`}
        />
      </div>

      {/* CF Handle CTA */}
      {!profile?.cf_handle && (
        <div className="card border-accent-indigo/40 bg-accent-indigo/5 flex items-center justify-between">
          <div>
            <p className="font-display font-semibold text-white">Connect Codeforces</p>
            <p className="text-sm text-slate-400 mt-0.5">Add your handle to appear on the leaderboard</p>
          </div>
          <Link to="/profile" className="btn-primary shrink-0">Set Handle →</Link>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Announcements */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-bold text-lg text-white">Latest Opportunities</h2>
            <Link to="/announcements" className="text-xs text-accent-indigo hover:text-accent-indigo transition-colors">View all →</Link>
          </div>
          {announcements.length === 0 ? (
            <div className="card text-center py-8 text-slate-500 text-sm">No announcements yet</div>
          ) : announcements.map(a => (
            <div key={a.id} className="card hover:border-dark-500 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <span className={`badge text-xs mb-1 ${
                    a.category === 'hackathon' ? 'bg-purple-500/15 text-purple-400' :
                    a.category === 'contest'   ? 'bg-blue-500/15 text-blue-400' :
                    'bg-slate-500/15 text-slate-400'
                  }`}>{a.category}</span>
                  <p className="font-display font-semibold text-white text-sm truncate">{a.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">by {a.author}</p>
                </div>
                {a.link && (
                  <a href={a.link} target="_blank" rel="noreferrer"
                     className="text-xs text-accent-indigo hover:underline shrink-0 font-mono">
                    Apply →
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Recent Team Posts */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-bold text-lg text-white">Team Board</h2>
            <Link to="/teams" className="text-xs text-accent-indigo hover:text-accent-indigo transition-colors">View all →</Link>
          </div>
          {teams.length === 0 ? (
            <div className="card text-center py-8 text-slate-500 text-sm">No team posts yet</div>
          ) : teams.map(t => (
            <div key={t.id} className="card hover:border-dark-500 transition-colors">
              <div className="flex items-start gap-3">
                <span className={`badge shrink-0 mt-0.5 ${
                  t.post_type === 'looking' ? 'bg-green-500/15 text-green-400' : 'bg-amber-500/15 text-amber-400'
                }`}>
                  {t.post_type === 'looking' ? '🔍 Looking' : '📢 Recruiting'}
                </span>
                <div className="min-w-0">
                  <p className="font-display font-semibold text-white text-sm truncate">{t.title}</p>
                  <p className="text-xs text-slate-500">{t.author} · {t.author_branch} Y{t.author_year}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
