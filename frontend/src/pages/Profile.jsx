import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
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

function TrashIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
      <path d="M10 11v6"/><path d="M14 11v6"/>
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
    </svg>
  )
}

function ScoreBadge({ label, score, color }) {
  const colors = {
    blue: "text-primary bg-accent-pill border-primary/10",
    purple: "text-purple-600 bg-purple-50 border-purple-100",
    emerald: "text-emerald-600 bg-emerald-50 border-emerald-100"
  }
  return (
    <div className={`p-4 rounded-xl border ${colors[color]} text-center`}>
      <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">{label}</p>
      <p className="text-xl font-extrabold leading-none">{(score || 0).toFixed(1)}</p>
    </div>
  )
}

export default function Profile() {
  const { id } = useParams()
  const { user: currentUser, refreshUser } = useAuth()
  const isOwnProfile = !id || id === currentUser?.id
  const [profile, setProfile] = useState(null)
  const [editing, setEditing] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const navigate = useNavigate()

  // Follow Modal state
  const [followModal, setFollowModal] = useState({ show: false, type: '', list: [], loading: false })

  // Profile form state
  const [form, setForm] = useState({
    cf_handle: '', lc_username: '', bio: '', skills: '', github_url: '', linkedin_url: ''
  })

  // Hackathon form state
  const [showHForm, setShowHForm] = useState(false)
  const [hForm, setHForm] = useState({ hackathon_name: '', position: 0, points: 0 })

  const fetchProfile = () => {
    const endpoint = id ? `/profile/${id}` : '/profile'
    api.get(endpoint).then(r => {
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
  }


  useEffect(() => { fetchProfile() }, [id])

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true); setMsg(null)
    try {
      await api.put('/profile', form)
      await fetchProfile()
      await refreshUser()
      setEditing(false)
      setMsg({ type: 'ok', text: 'Profile updated successfully!' })
    } catch {
      setMsg({ type: 'err', text: 'Update failed. Please check your data.' })
    } finally {
      setSaving(false)
    }
  }

  const handleSync = async () => {
    setSyncing(true); setMsg(null)
    try {
      await api.post('/profile/sync')
      await fetchProfile()
      setMsg({ type: 'ok', text: 'Statistics synced with external platforms!' })
    } catch (err) {
      setMsg({ type: 'err', text: err.response?.data?.error || 'Sync failed.' })
    } finally {
      setSyncing(false)
    }
  }

  const handleFollowToggle = async () => {
    try {
      const endpoint = profile.is_following ? `/profile/${id || currentUser?.id}/unfollow` : `/profile/${id || currentUser?.id}/follow`
      const res = await api.post(endpoint)
      
      setProfile(p => ({
        ...p,
        is_following: !p.is_following,
        followers_count: res.data.followers_count
      }))
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update follow status')
    }
  }

  const handleOpenFollowModal = async (type) => {
    setFollowModal({ show: true, type, list: [], loading: true })
    try {
      const targetId = id || currentUser?.id
      const res = await api.get(`/profile/${targetId}/${type}`)
      setFollowModal({ show: true, type, list: res.data, loading: false })
    } catch (err) {
      setFollowModal({ show: false, type: '', list: [], loading: false })
      alert('Failed to load list')
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
      alert(err.response?.data?.error || 'Failed to add achievement')
    }
  }

  const handleDeleteHackathon = async (id) => {
    if (!confirm('Remove this achievement?')) return
    try {
      await api.delete(`/hackathon/result/${id}`)
      fetchProfile()
      refreshUser()
    } catch (err) {
      alert('Failed to delete')
    }
  }

  const rankColor = RANK_COLORS[profile?.cf_rank?.toLowerCase()] || '#9ca3af'

  if (!profile) return (
    <div className="flex justify-center py-32">
      <div className="w-10 h-10 border-4 border-primary/10 border-t-primary rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-20">
      {/* Top Header Card */}
      <div className="card p-10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-32 -mt-32 blur-3xl opacity-50" />
        
        <div className="flex flex-col md:flex-row gap-10 items-start relative z-10">
          <div className="relative group">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="Avatar"
                className="w-32 h-32 rounded-3xl object-cover border-4 border-white shadow-xl" />
            ) : (
              <div className="w-32 h-32 rounded-3xl bg-gray-50 border-4 border-white shadow-xl flex items-center justify-center">
                <span className="text-primary font-bold text-5xl">{profile?.name?.[0]}</span>
              </div>

            )}
          </div>

          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-4 mb-4">
              <h1 className="text-4xl font-extrabold text-text-primary">{profile.name}</h1>
              <div className="flex gap-2">
                {profile.github_url && (
                  <a href={profile.github_url} target="_blank" rel="noreferrer" className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                  </a>
                )}
                {profile.linkedin_url && (
                  <a href={profile.linkedin_url} target="_blank" rel="noreferrer" className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
                    <svg className="w-5 h-5 text-[#0077b5]" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
                  </a>
                )}
              </div>
            </div>
            <p className="text-text-secondary font-bold uppercase tracking-wider text-sm">{profile.branch} · Year {profile.year}</p>
            <p className="text-text-secondary font-medium text-sm mt-1 mb-4">{profile.email}</p>
            
            <div className="flex gap-4 mb-4">
              <div onClick={() => handleOpenFollowModal('followers')} className="text-sm cursor-pointer hover:underline">
                <span className="font-bold text-text-primary">{profile.followers_count || 0}</span> <span className="text-text-secondary font-medium">Followers</span>
              </div>
              <div onClick={() => handleOpenFollowModal('following')} className="text-sm cursor-pointer hover:underline">
                <span className="font-bold text-text-primary">{profile.following_count || 0}</span> <span className="text-text-secondary font-medium">Following</span>
              </div>
            </div>

            {profile.bio && <p className="text-gray-600 text-[15px] mt-6 leading-relaxed border-l-4 border-primary/10 pl-4">{profile.bio}</p>}
            
            <div className="flex gap-4 mt-8">
              {isOwnProfile ? (
                <>
                  <button onClick={() => { setEditing(true); setMsg(null) }} className="btn-primary px-8 py-3">Edit Profile</button>
                  <button onClick={handleSync} disabled={syncing} className="bg-gray-100 text-gray-700 px-6 py-3 rounded-xl font-bold hover:bg-gray-200 transition-all flex items-center gap-2">
                    {syncing ? '⟳ SYNCING...' : '⟳ SYNC STATS'}
                  </button>
                </>
              ) : (
                <button onClick={handleFollowToggle} className={`px-8 py-3 rounded-xl font-bold transition-all ${
                  profile.is_following 
                    ? 'bg-gray-100 text-gray-700 hover:bg-red-50 hover:text-red-600 border border-transparent hover:border-red-200' 
                    : 'btn-primary'
                }`}>
                  {profile.is_following ? 'Following' : 'Follow'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Message feedback */}
      {msg && (
        <div className={`rounded-2xl px-6 py-4 text-sm font-bold border animate-in slide-in-from-top-2 ${msg.type === 'ok'
            ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
            : 'bg-danger/5 border-danger/10 text-danger'
          }`}>
          {msg.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2">
        {['overview', 'achievements', 'settings'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-8 py-3 rounded-full text-xs font-black uppercase tracking-widest transition-all border ${
              activeTab === tab 
                ? 'bg-text-primary text-white border-text-primary shadow-lg' 
                : 'bg-white text-text-secondary border-border-dim hover:border-gray-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Main Ratings Row */}
          <div className="card p-8 md:col-span-2">
            <h3 className="section-label mb-8">COMPETITIVE STANDINGS</h3>
            <div className="grid grid-cols-2 gap-10">
              <div>
                <p className="text-4xl font-extrabold" style={{ color: rankColor }}>{profile.cf_rating || 0}</p>
                <p className="text-[11px] font-black text-text-secondary uppercase tracking-wider mt-2">CF Rating</p>
              </div>
              <div>
                <p className="text-4xl font-extrabold text-secondary">{profile.lc_rating || 0}</p>
                <p className="text-[11px] font-black text-text-secondary uppercase tracking-wider mt-2">LC Rating</p>
              </div>
            </div>
          </div>

          {/* GitHub Analysis */}
          {profile.github_analysis?.total > 0 && (
            <div className="card p-8 md:col-span-2 border-primary/20 bg-accent-pill">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-xl font-bold text-text-primary uppercase tracking-tight">GITHUB EXPERT ANALYSIS</h3>
                  <p className="text-text-secondary text-xs font-bold mt-1">Calculated via AI assessment of implementation & impact.</p>
                </div>
                <div className="bg-white px-6 py-4 rounded-2xl border border-primary/20 shadow-sm text-center">
                  <p className="text-3xl font-black text-primary">{profile.github_analysis.total.toFixed(1)}</p>
                  <p className="text-[10px] font-black text-text-secondary uppercase mt-1">TOTAL SCORE</p>
                </div>
              </div>
              
              <div className="bg-white/80 backdrop-blur p-6 rounded-2xl border border-primary/10 mb-8 italic text-gray-600 text-sm leading-relaxed">
                "{profile.github_analysis.reason}"
              </div>

              <div className="grid grid-cols-3 gap-6">
                <ScoreBadge label="IMPL" score={profile.github_analysis.implementation} color="blue" />
                <ScoreBadge label="IMPACT" score={profile.github_analysis.impact} color="purple" />
                <ScoreBadge label="FUNC" score={profile.github_analysis.working} color="emerald" />
              </div>
            </div>
          )}

          {/* Individual platform cards */}
          <div className="card p-8">
            <div className="flex items-center justify-between mb-8">
              <h3 className="section-label">CODEFORCES</h3>
              {profile.cf_handle && (
                <a href={`https://codeforces.com/profile/${profile.cf_handle}`} target="_blank" rel="noreferrer" className="text-xs font-bold text-primary hover:underline">
                  @{profile.cf_handle} ↗
                </a>
              )}
            </div>
            {profile.cf_handle ? (
              <div className="space-y-6">
                <div className="flex justify-between items-center py-4 border-b border-dashed border-border-dim">
                  <span className="text-sm font-bold text-text-secondary">CURRENT RANK</span>
                  <span className="text-sm font-black uppercase" style={{ color: rankColor }}>{profile.cf_rank || 'Unrated'}</span>
                </div>
                <div className="flex justify-between items-center py-4 border-b border-dashed border-border-dim">
                  <span className="text-sm font-bold text-text-secondary">PROBLEMS SOLVED</span>
                  <span className="text-sm font-black text-text-primary">{profile.cf_problems_solved || 0}</span>
                </div>
                <div className="flex justify-between items-center py-4">
                  <span className="text-sm font-bold text-text-secondary">MAX RATING</span>
                  <span className="text-sm font-black text-text-primary">{profile.cf_max_rating || 0}</span>
                </div>
              </div>
            ) : (
              <p className="text-text-secondary text-sm font-medium italic py-10 text-center">No handle connected.</p>
            )}
          </div>

          <div className="card p-8">
            <div className="flex items-center justify-between mb-8">
              <h3 className="section-label">LEETCODE</h3>
              {profile.lc_username && (
                <a href={`https://leetcode.com/${profile.lc_username}`} target="_blank" rel="noreferrer" className="text-xs font-bold text-primary hover:underline">
                  @{profile.lc_username} ↗
                </a>
              )}
            </div>
            {profile.lc_username ? (
              <div className="space-y-6">
                <div className="flex justify-between items-center py-4 border-b border-dashed border-border-dim">
                  <span className="text-sm font-bold text-text-secondary">GLOBAL RANKING</span>
                  <span className="text-sm font-black text-text-primary">#{profile.lc_rank || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center py-4 border-b border-dashed border-border-dim">
                  <span className="text-sm font-bold text-text-secondary">PROBLEMS SOLVED</span>
                  <span className="text-sm font-black text-text-primary">{profile.lc_problems_solved || 0}</span>
                </div>
                <div className="flex justify-between items-center py-4">
                  <span className="text-sm font-bold text-text-secondary">CONTEST RATING</span>
                  <span className="text-sm font-black text-secondary">{profile.lc_rating || 0}</span>
                </div>
              </div>
            ) : (
              <p className="text-text-secondary text-sm font-medium italic py-10 text-center">No handle connected.</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'achievements' && (
        <div className="card p-10 space-y-10">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-text-primary">Hackathon Achievements</h2>
            <button onClick={() => setShowHForm(!showHForm)} className="text-primary text-sm font-black uppercase tracking-widest hover:underline">
              {showHForm ? '✕ Close' : '+ Add Result'}
            </button>
          </div>

          {showHForm && (
            <form onSubmit={handleAddHackathon} className="bg-gray-50 border border-border-dim p-8 rounded-2xl space-y-6 animate-in slide-in-from-top-4 duration-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="section-label block mb-2">Hackathon Name</label>
                  <input className="input" required placeholder="e.g. Smart India Hackathon 2024"
                    value={hForm.hackathon_name} onChange={e => setHForm(p => ({ ...p, hackathon_name: e.target.value }))} />
                </div>
                <div>
                  <label className="section-label block mb-2">Position (0 for Participation)</label>
                  <input className="input" type="number"
                    value={hForm.position} onChange={e => setHForm(p => ({ ...p, position: parseInt(e.target.value) }))} />
                </div>
                <div>
                  <label className="section-label block mb-2">Points Awarded</label>
                  <input className="input" type="number" required
                    value={hForm.points} onChange={e => setHForm(p => ({ ...p, points: parseInt(e.target.value) }))} />
                </div>
              </div>
              <button type="submit" className="btn-primary w-full py-4 font-bold">Save Achievement</button>
            </form>
          )}

          <div className="divide-y divide-dashed divide-border-dim">
            {profile.hackathon_results?.length > 0 ? (
              profile.hackathon_results.map(h => (
                <div key={h.id} className="flex items-center justify-between py-6 group">
                  <div className="flex items-center gap-6">
                    <div className="w-12 h-12 rounded-2xl bg-secondary/10 flex items-center justify-center text-xl">
                      {h.position === 1 ? '🥇' : h.position === 2 ? '🥈' : h.position === 3 ? '🥉' : '🏆'}
                    </div>
                    <div>
                      <p className="text-lg font-bold text-text-primary">{h.hackathon_name}</p>
                      <p className="text-sm text-text-secondary font-bold uppercase tracking-wider mt-1">
                        {h.position > 0 ? `${h.position}${getOrdinal(h.position)} Place` : 'PARTICIPATION'} · {h.points} PTS
                      </p>
                    </div>
                  </div>
                  <button onClick={() => handleDeleteHackathon(h.id)} className="text-text-secondary hover:text-danger p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <TrashIcon size={18} />
                  </button>
                </div>
              ))
            ) : (
              <p className="text-text-secondary text-sm font-medium italic py-20 text-center">No achievements added yet. Showcase your wins!</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="card p-10">
          <h2 className="text-2xl font-bold text-text-primary mb-10">Profile Settings</h2>
          <form onSubmit={handleSave} className="space-y-10">
            <div className="grid sm:grid-cols-2 gap-8">
              <div>
                <label className="section-label block mb-2">Codeforces Handle</label>
                <input className="input font-mono" placeholder="e.g. tourist" value={form.cf_handle}
                  onChange={e => setForm(p => ({ ...p, cf_handle: e.target.value }))} />
              </div>
              <div>
                <label className="section-label block mb-2">LeetCode Username</label>
                <input className="input font-mono" placeholder="e.g. leet_dev" value={form.lc_username}
                  onChange={e => setForm(p => ({ ...p, lc_username: e.target.value }))} />
              </div>
            </div>
            
            <div>
              <label className="section-label block mb-2">Professional Bio</label>
              <textarea className="input resize-none" rows={4} placeholder="Tell the world about your technical journey..."
                value={form.bio} onChange={e => setForm(p => ({ ...p, bio: e.target.value }))} />
            </div>

            <div>
              <label className="section-label block mb-2">Skills & Technologies (comma separated)</label>
              <input className="input" placeholder="React, Node.js, Python, Competitive Programming" value={form.skills}
                onChange={e => setForm(p => ({ ...p, skills: e.target.value }))} />
            </div>

            <div className="grid sm:grid-cols-2 gap-8">
              <div>
                <label className="section-label block mb-2">GitHub Profile URL</label>
                <input className="input" type="url" placeholder="https://github.com/your-username" value={form.github_url}
                  onChange={e => setForm(p => ({ ...p, github_url: e.target.value }))} />
              </div>
              <div>
                <label className="section-label block mb-2">LinkedIn Profile URL</label>
                <input className="input" type="url" placeholder="https://linkedin.com/in/your-profile" value={form.linkedin_url}
                  onChange={e => setForm(p => ({ ...p, linkedin_url: e.target.value }))} />
              </div>
            </div>

            <div className="pt-6 border-t border-border-dim">
              <button type="submit" disabled={saving} className="btn-primary px-12 py-4">
                {saving ? 'SAVING CHANGES...' : 'SAVE PROFILE'}
              </button>
            </div>
          </form>
        </div>
      )}
      
      {/* Follow Modal */}
      {followModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
          <div className="bg-white border border-border-dim rounded-2xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-dim">
              <h2 className="text-xl font-bold text-text-primary capitalize">{followModal.type}</h2>
              <button onClick={() => setFollowModal({ ...followModal, show: false })} className="w-8 h-8 rounded-lg bg-gray-100 text-text-secondary hover:bg-gray-200 flex items-center justify-center transition-colors">✕</button>
            </div>
            <div className="overflow-y-auto p-4 flex-1">
              {followModal.loading ? (
                <div className="flex justify-center py-10">
                  <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                </div>
              ) : followModal.list.length === 0 ? (
                <div className="text-center py-10 text-text-secondary italic">No users found.</div>
              ) : (
                <div className="space-y-2">
                  {followModal.list.map(u => (
                    <div key={u.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-page/50 transition-colors">
                      {u.avatar_url ? (
                        <img src={u.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover border border-border-dim" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center border border-border-dim">
                          <span className="text-sm font-bold text-text-secondary">{u.name[0]}</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <Link 
                          to={`/profile/${u.id}`}
                          onClick={() => setFollowModal({ ...followModal, show: false })}
                          className="text-[15px] font-bold text-text-primary hover:text-primary hover:underline truncate block"
                        >
                          {u.name}
                        </Link>
                        <p className="text-[11px] text-text-secondary font-bold uppercase tracking-wider truncate">{u.branch} · Year {u.year}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
