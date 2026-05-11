import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'

const RANK_COLORS = {
  'legendary grandmaster': '#ff0000', 'international grandmaster': '#ff0000',
  grandmaster: '#ff0000', 'international master': '#ff8c00', master: '#ff8c00',
  'candidate master': '#aa00aa', expert: '#0000ff', specialist: '#03a89e',
  pupil: '#008000', newbie: '#808080',
}

function getOrdinal(n) {
  const s = ["th", "st", "nd", "rd"],
    v = n % 100;
  return (s[(v - 20) % 10] || s[v] || s[0]);
}

function ScoreBadge({ label, score, color }) {
  const colors = {
    blue: "text-accent-cyan bg-accent-cyan/10 border-accent-cyan/20",
    purple: "text-accent-violet bg-accent-violet/10 border-accent-violet/20",
    emerald: "text-accent-indigo bg-accent-indigo/10 border-accent-indigo/20"
  }
  return (
    <div className={`p-2 rounded-lg border ${colors[color]} text-center`}>
      <p className="text-[9px] font-black uppercase opacity-60 leading-none mb-1">{label}</p>
      <p className="font-mono font-bold text-sm leading-none">{(score || 0).toFixed(1)}</p>
    </div>
  )
}

export default function Profile() {
  const { user, refreshUser } = useAuth()
  const [profile, setProfile] = useState(null)
  const [editing, setEditing] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)   // { type: 'ok'|'err', text }

  // Profile form state
  const [form, setForm] = useState({
    cf_handle: '', lc_username: '', bio: '', skills: '', github_url: '', linkedin_url: ''
  })

  // Hackathon form state
  const [showHForm, setShowHForm] = useState(false)
  const [hForm, setHForm] = useState({ hackathon_name: '', position: 0, points: 0 })

  const fetchProfile = () =>
    api.get('/profile').then(r => {
      setProfile(r.data)
      setForm({
        cf_handle: r.data.cf_handle || '',
        lc_username: r.data.lc_username || '',
        bio: r.data.bio || '',
        skills: Array.isArray(r.data.skills) ? r.data.skills.join(', ') : (r.data.skills || ''),
        github_url: r.data.github_url || '',
        linkedin_url: r.data.linkedin_url || '',
      })
    })

  useEffect(() => { fetchProfile() }, [])

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true); setMsg(null)
    try {
      await api.put('/profile', form)
      await fetchProfile()
      await refreshUser()
      setEditing(false)
      setMsg({ type: 'ok', text: 'Profile updated!' })
    } catch {
      setMsg({ type: 'err', text: 'Update failed. Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  const handleSync = async () => {
    setSyncing(true); setMsg(null)
    try {
      await api.post('/profile/sync')
      await fetchProfile()
      setMsg({ type: 'ok', text: 'Profile stats synced!' })
    } catch (err) {
      setMsg({ type: 'err', text: err.response?.data?.error || 'Sync failed.' })
    } finally {
      setSyncing(false)
    }
  }

  const handleAddHackathon = async (e) => {
    e.preventDefault()
    try {
      await api.post('/hackathon/result', hForm)
      setHForm({ hackathon_name: '', position: 0, points: 0 })
      setShowHForm(false)
      fetchProfile()
      refreshUser()
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add hackathon result')
    }
  }

  const handleDeleteHackathon = async (id) => {
    if (!confirm('Are you sure you want to delete this result?')) return
    try {
      await api.delete(`/hackathon/result/${id}`)
      fetchProfile()
      refreshUser()
    } catch (err) {
      alert('Failed to delete result')
    }
  }

  const rankColor = RANK_COLORS[profile?.cf_rank?.toLowerCase()] || '#94a3b8'

  if (!profile) return (
    <div className="flex justify-center py-24">
      <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-6 max-w-2xl pb-20">
      <div className="flex items-center justify-between">
        <h1 className="font-display font-bold text-3xl text-white">My Profile</h1>
        <div className="flex gap-2">
          {(profile.cf_handle || profile.lc_username) && (
            <button onClick={handleSync} disabled={syncing} className="btn-secondary text-xs px-3 py-2">
              {syncing ? '⟳ Syncing…' : '⟳ Sync Stats'}
            </button>
          )}
          <button onClick={() => { setEditing(p => !p); setMsg(null) }} className="btn-primary text-xs px-3 py-2">
            {editing ? 'Cancel' : 'Edit Profile'}
          </button>
        </div>
      </div>

      {msg && (
        <div className={`rounded-lg px-4 py-3 text-sm border ${msg.type === 'ok'
            ? 'bg-green-500/10 border-green-500/30 text-green-400'
            : 'bg-red-500/10 border-red-500/30 text-red-400'
          }`}>
          {msg.text}
        </div>
      )}

      {/* Profile card */}
      <div className="card space-y-5">
        <div className="flex items-start gap-4">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="CF Avatar"
              className="w-16 h-16 rounded-xl object-cover border-2 border-glass-border" />
          ) : (
            <div className="w-16 h-16 rounded-xl bg-accent-indigo/20 border-2 border-accent-indigo/30 flex items-center justify-center">
              <span className="text-accent-indigo font-display font-bold text-2xl">{user?.name?.[0]}</span>
            </div>
          )}
          <div className="flex-1">
            <h2 className="font-display font-bold text-xl text-white">{user?.name}</h2>
            <p className="text-slate-400 text-sm">{user?.branch} · Year {user?.year}</p>
            <p className="text-slate-500 text-xs font-mono mt-0.5">{user?.email}</p>
            {profile.bio && <p className="text-sm text-slate-300 mt-2">{profile.bio}</p>}
          </div>
        </div>

        {/* CF Stats */}
        {profile.cf_handle ? (
          <div className="bg-white/5 border border-glass-border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-display font-semibold text-slate-500 uppercase tracking-wider">Codeforces</span>
              <a href={`https://codeforces.com/profile/${profile.cf_handle}`}
                target="_blank" rel="noreferrer"
                className="text-xs font-mono hover:underline"
                style={{ color: rankColor }}>
                @{profile.cf_handle} ↗
              </a>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <p className="text-2xl font-display font-bold" style={{ color: rankColor }}>
                  {profile.cf_rating || 0}
                </p>
                <p className="text-xs text-slate-500">Current Rating</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-display font-bold text-slate-300">{profile.cf_max_rating || 0}</p>
                <p className="text-xs text-slate-500">Max Rating</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-display font-bold text-white">{profile.cf_problems_solved || 0}</p>
                <p className="text-xs text-slate-500">Problems Solved</p>
              </div>
            </div>
            <p className="text-center text-xs capitalize" style={{ color: rankColor }}>
              {profile.cf_rank || 'unrated'}
            </p>
          </div>
        ) : (
          <div className="bg-dark-700 rounded-xl p-4 text-center text-slate-500 text-sm">
            No Codeforces handle set. Edit your profile to connect.
          </div>
        )}

        {/* LC Stats */}
        {profile.lc_username ? (
          <div className="bg-white/5 border border-glass-border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-display font-semibold text-slate-500 uppercase tracking-wider">LeetCode</span>
              <a href={`https://leetcode.com/${profile.lc_username}`}
                target="_blank" rel="noreferrer"
                className="text-xs font-mono hover:underline text-yellow-500">
                @{profile.lc_username} ↗
              </a>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <p className="text-2xl font-display font-bold text-yellow-500">
                  {profile.lc_rating || 0}
                </p>
                <p className="text-xs text-slate-500">Contest Rating</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-display font-bold text-slate-300">
                  #{profile.lc_rank || 'N/A'}
                </p>
                <p className="text-xs text-slate-500">Global Rank</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-display font-bold text-white">
                  {profile.lc_problems_solved || 0}
                </p>
                <p className="text-xs text-slate-500">Problems Solved</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-dark-700 rounded-xl p-4 text-center text-slate-500 text-sm">
            No LeetCode username set. Edit your profile to connect.
          </div>
        )}

        {/* GitHub Analysis Showcase */}
        {profile.github_analysis?.total > 0 && (
          <div className="bg-accent-indigo/5 border border-accent-indigo/20 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">🏆</span>
                <span className="text-xs font-display font-black text-accent-indigo uppercase tracking-widest">GitHub Expert Analysis</span>
              </div>
              <div className="text-lg font-display font-black text-white bg-accent-indigo/20 px-3 py-1 rounded-lg border border-accent-indigo/30">
                {profile.github_analysis.total.toFixed(1)} <span className="text-[10px] text-slate-500">/ 10</span>
              </div>
            </div>
            
            <p className="text-sm text-slate-300 italic leading-relaxed">
              "{profile.github_analysis.reason}"
            </p>

            <div className="grid grid-cols-3 gap-2">
              <ScoreBadge label="Impl" score={profile.github_analysis.implementation} color="blue" />
              <ScoreBadge label="Impact" score={profile.github_analysis.impact} color="purple" />
              <ScoreBadge label="Func" score={profile.github_analysis.working} color="emerald" />
            </div>
          </div>
        )}

        {/* Skills */}
        {profile.skills?.length > 0 && (
          <div>
            <p className="text-xs font-display font-semibold text-slate-500 uppercase tracking-wider mb-2">Skills</p>
            <div className="flex flex-wrap gap-2">
              {profile.skills.map(s => (
                <span key={s} className="badge bg-dark-600 text-slate-300">{s.trim()}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Hackathons Section */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-lg text-white">Hackathon Participations</h2>
          <button onClick={() => setShowHForm(!showHForm)} className="text-brand-400 text-xs font-semibold hover:underline">
            {showHForm ? 'Close' : '+ Add Result'}
          </button>
        </div>

        {showHForm && (
          <form onSubmit={handleAddHackathon} className="bg-dark-700 p-4 rounded-xl space-y-3 animate-in slide-in-from-top-2 duration-200">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Hackathon Name</label>
              <input className="input text-xs py-2" required placeholder="e.g. Smart India Hackathon"
                value={hForm.hackathon_name} onChange={e => setHForm(p => ({ ...p, hackathon_name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Position (0 for participation)</label>
                <input className="input text-xs py-2" type="number"
                  value={hForm.position} onChange={e => setHForm(p => ({ ...p, position: parseInt(e.target.value) }))} />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Points Awarded</label>
                <input className="input text-xs py-2" type="number" required
                  value={hForm.points} onChange={e => setHForm(p => ({ ...p, points: parseInt(e.target.value) }))} />
              </div>
            </div>
            <button type="submit" className="btn-primary w-full py-2 text-xs">Save Achievement</button>
          </form>
        )}

        <div className="space-y-2">
          {profile.hackathon_results?.length > 0 ? (
            profile.hackathon_results.map(h => (
              <div key={h.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-glass-border group">
                <div>
                  <p className="text-sm font-semibold text-white">{h.hackathon_name}</p>
                  <p className="text-xs text-slate-500">
                    {h.position > 0 ? `${h.position}${getOrdinal(h.position)} Place` : 'Participation'} · {h.points} pts
                  </p>
                </div>
                <button onClick={() => handleDeleteHackathon(h.id)} className="text-slate-500 hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  ✕
                </button>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500 italic">No hackathons added yet. Start tracking your achievements!</p>
          )}
        </div>
      </div>

      {/* Edit form */}
      {editing && (
        <div className="card border-brand-500/30">
          <h2 className="font-display font-semibold text-white mb-4">Edit Profile</h2>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Codeforces Handle</label>
                <input className="input font-mono" placeholder="tourist" value={form.cf_handle}
                  onChange={e => setForm(p => ({ ...p, cf_handle: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">LeetCode Username</label>
                <input className="input font-mono" placeholder="username" value={form.lc_username}
                  onChange={e => setForm(p => ({ ...p, lc_username: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Bio</label>
              <textarea className="input resize-none" rows={2} placeholder="A short intro about yourself…"
                value={form.bio} onChange={e => setForm(p => ({ ...p, bio: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Skills (comma-separated)</label>
              <input className="input" placeholder="DSA, Web Dev, ML" value={form.skills}
                onChange={e => setForm(p => ({ ...p, skills: e.target.value }))} />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">GitHub URL</label>
                <input className="input" type="url" placeholder="https://github.com/…" value={form.github_url}
                  onChange={e => setForm(p => ({ ...p, github_url: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">LinkedIn URL</label>
                <input className="input" type="url" placeholder="https://linkedin.com/in/…" value={form.linkedin_url}
                  onChange={e => setForm(p => ({ ...p, linkedin_url: e.target.value }))} />
              </div>
            </div>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}