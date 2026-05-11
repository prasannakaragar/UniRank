import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'

const RANK_COLORS = {
  'legendary grandmaster': '#ff0000',
  'international grandmaster': '#ff0000',
  grandmaster: '#ff0000',
  'international master': '#ff8c00',
  master: '#ff8c00',
  'candidate master': '#aa00aa',
  expert: '#0000ff',
  specialist: '#03a89e',
  pupil: '#008000',
  newbie: '#808080',
}

function rankColor(rank = '') {
  return RANK_COLORS[rank?.toLowerCase()] || '#94a3b8'
}

function MedalIcon({ rank }) {
  if (rank === 1) return <span className="text-yellow-400 text-lg">🥇</span>
  if (rank === 2) return <span className="text-slate-300 text-lg">🥈</span>
  if (rank === 3) return <span className="text-amber-600 text-lg">🥉</span>
  return <span className="font-mono text-slate-500 text-sm w-6 text-center">{rank}</span>
}

export default function Leaderboard() {
  const { user } = useAuth()
  const navigate  = useNavigate()
  const [data, setData]       = useState([])
  const [loading, setLoading] = useState(true)
  const [type, setType]       = useState('cp')
  const [scope, setScope]     = useState('global')
  const [branch, setBranch]   = useState('')
  const [year, setYear]       = useState('')
  
  // Hackathon Modal state
  const [showModal, setShowModal] = useState(false)
  const [modalData, setModalData] = useState({ user_id: '', hackathon_name: '', position: 0, points: 0 })

  const fetchData = () => {
    setLoading(true)
    const params = new URLSearchParams({ type, scope })
    if (branch) params.set('branch', branch)
    if (year)   params.set('year', year)
    api.get(`/leaderboard?${params}`)
      .then(r => setData(r.data.leaderboard))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchData() }, [type, scope, branch, year])

  const handleAddResult = (e) => {
    e.preventDefault()
    api.post('/hackathon/result', modalData)
      .then(() => {
        setShowModal(false)
        fetchData()
      })
      .catch(err => alert(err.response?.data?.error || 'Error adding result'))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-3xl text-white">Leaderboard</h1>
          <p className="text-slate-400 text-sm mt-1">
            {type === 'cp' ? 'Competitive programming rankings' : 
             type === 'github' ? 'GitHub AI project analysis rankings' :
             'Hackathon achievements'}
          </p>
        </div>
        <div className="flex gap-2">
          {user?.role === 'faculty' && (
            <button onClick={() => setShowModal(true)} className="btn-primary bg-blue-600 hover:bg-blue-500">
              + Add Hackathon Result
            </button>
          )}
          <button onClick={fetchData} className="btn-secondary">
            ↻ Refresh
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-center border-b border-dark-600">
        <div className="flex">
          {[
            { id: 'cp', label: 'CP' },
            { id: 'hackathon', label: 'Hackathon' },
            { id: 'github', label: 'GitHub Projects' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setType(tab.id)}
              className={`px-6 py-3 text-sm font-display font-semibold transition-all border-b-2 ${
                type === tab.id ? 'border-accent-indigo text-accent-indigo' : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        
        {/* Scope Toggle */}
        <div className="flex p-1 bg-white/5 backdrop-blur-md rounded-lg mb-2 sm:mb-0 mr-2 border border-glass-border">
          <button
            onClick={() => setScope('global')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${
              scope === 'global' ? 'bg-accent-indigo text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-white'
            }`}
          >
            Global 🌍
          </button>
          <button
            onClick={() => setScope('college')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${
              scope === 'college' ? 'bg-accent-indigo text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-white'
            }`}
          >
            College 🏫
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card flex flex-wrap gap-3">
        <select className="input w-auto text-xs py-2" value={branch} onChange={e => setBranch(e.target.value)}>
          <option value="">All Branches</option>
          {['CSE','ISE','ECE','EEE','ME','CE'].map(b => <option key={b} value={b}>{b}</option>)}
        </select>

        <select className="input w-auto text-xs py-2" value={year} onChange={e => setYear(e.target.value)}>
          <option value="">All Years</option>
          {[1,2,3,4].map(y => <option key={y} value={y}>Year {y}</option>)}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : data.length === 0 ? (
        <div className="card text-center py-16 text-slate-500">
          No rankings available for this category.
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-glass-border bg-white/5">
                  <th className="px-4 py-3 text-left text-xs font-display font-semibold text-slate-500 uppercase tracking-wider w-16">Rank</th>
                  <th className="px-4 py-3 text-left text-xs font-display font-semibold text-slate-500 uppercase tracking-wider">Student</th>
                  {type === 'cp' ? (
                    <>
                      <th className="px-4 py-3 text-left text-xs font-display font-semibold text-slate-500 uppercase tracking-wider">Handles</th>
                      <th className="px-4 py-3 text-right text-xs font-display font-semibold text-slate-500 uppercase tracking-wider">Ratings</th>
                      <th className="px-4 py-3 text-right text-xs font-display font-semibold text-slate-500 uppercase tracking-wider">Solved</th>
                      <th className="px-4 py-3 text-right text-xs font-display font-semibold text-accent-indigo uppercase tracking-wider">Score</th>
                    </>
                  ) : type === 'hackathon' ? (
                    <>
                      <th className="px-4 py-3 text-right text-xs font-display font-semibold text-slate-500 uppercase tracking-wider">Score</th>
                      <th className="px-4 py-3 text-right text-xs font-display font-semibold text-slate-500 uppercase tracking-wider">Hackathons</th>
                    </>
                  ) : type === 'github' ? (
                    <>
                      <th className="px-4 py-3 text-center text-xs font-display font-semibold text-slate-500 uppercase tracking-wider">Repo</th>
                      <th className="px-4 py-3 text-right text-xs font-display font-semibold text-slate-500 uppercase tracking-wider">Implementation</th>
                      <th className="px-4 py-3 text-right text-xs font-display font-semibold text-slate-500 uppercase tracking-wider">Impact</th>
                      <th className="px-4 py-3 text-right text-xs font-display font-semibold text-slate-500 uppercase tracking-wider">Working</th>
                      <th className="px-4 py-3 text-right text-xs font-display font-semibold text-accent-indigo uppercase tracking-wider">Total</th>
                    </>
                  ) : null}
                  <th className="px-4 py-3 text-left text-xs font-display font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Branch</th>
                </tr>
              </thead>
              <tbody>
                {data.map((entry) => {
                  const isMe = entry.user_id === user?.id
                  return (
                    <tr key={entry.user_id}
                      className={`border-b border-white/5 transition-colors ${
                        isMe ? 'bg-accent-indigo/10 border-l-2 border-l-accent-indigo' : 'hover:bg-white/5'
                      }`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center w-8">
                          <MedalIcon rank={entry.rank} />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          {entry.avatar_url ? (
                            <img src={entry.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover border border-dark-500" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-dark-600 border border-dark-500 flex items-center justify-center">
                              <span className="text-xs font-bold text-slate-400">{entry.name[0]}</span>
                            </div>
                          )}
                          <div>
                            <p className={`font-display font-semibold ${isMe ? 'text-brand-300' : 'text-white'}`}>
                              {entry.name} {isMe && <span className="text-xs text-brand-400">(you)</span>}
                            </p>
                            <p className="text-xs text-slate-500">Year {entry.year}</p>
                          </div>
                        </div>
                      </td>
                      
                      {type === 'cp' && (
                        <>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              {entry.cf_handle && (
                                <a href={`https://codeforces.com/profile/${entry.cf_handle}`}
                                   target="_blank" rel="noreferrer"
                                   className="font-mono text-[10px] hover:underline"
                                   style={{ color: rankColor(entry.cf_rank) }}>
                                  CF: @{entry.cf_handle}
                                </a>
                              )}
                              {entry.lc_username && (
                                <a href={`https://leetcode.com/${entry.lc_username}`}
                                   target="_blank" rel="noreferrer"
                                   className="font-mono text-[10px] hover:underline text-yellow-500">
                                  LC: @{entry.lc_username}
                                </a>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex flex-col gap-1">
                              <span className="font-mono font-semibold" style={{ color: rankColor(entry.cf_rank) }}>
                                {entry.cf_rating || 0}
                              </span>
                              <span className="font-mono font-semibold text-yellow-500">
                                {entry.lc_rating || 0}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-slate-300">
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] text-slate-400">{entry.cf_problems_solved || 0}</span>
                              <span className="text-[10px] text-yellow-500/70">{entry.lc_problems_solved || 0}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-accent-indigo">
                            {entry.cp_score}
                          </td>
                        </>
                      )}

                      {type === 'hackathon' && (
                        <>
                          <td className="px-4 py-3 text-right font-mono font-bold text-accent-indigo">
                            {entry.score}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-slate-400">
                            {entry.hackathons_count}
                          </td>
                        </>
                      )}

                      {type === 'github' && (
                        <>
                          <td className="px-4 py-3 text-center">
                            {entry.github_url ? (
                              <a href={entry.github_url} target="_blank" rel="noreferrer" className="text-brand-400 hover:text-brand-300 transition-colors" title={entry.github_review_reason}>
                                <CodeIcon size={16} />
                              </a>
                            ) : (
                              <span className="text-slate-600">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-slate-300">
                            {entry.github_impl_score?.toFixed(1) || '0.0'}/10
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-slate-300">
                            {entry.github_imp_score?.toFixed(1) || '0.0'}/10
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-slate-300">
                            {entry.github_work_score?.toFixed(1) || '0.0'}/10
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-accent-indigo">
                            {entry.github_total_score?.toFixed(1) || '0.0'}
                          </td>
                        </>
                      )}

                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="flex items-center gap-2">
                          <span className="badge bg-dark-600 text-slate-400">{entry.branch}</span>
                          {!isMe && (
                            <button
                              onClick={() => navigate(`/chats?dm=${entry.user_id}`)}
                              title="Send message"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-brand-400 hover:bg-brand-500/10 transition-colors"
                            >
                              <MsgIcon size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Admin Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="card w-full max-w-md animate-in fade-in zoom-in duration-200">
            <h2 className="text-xl font-display font-bold text-white mb-4">Add Hackathon Result</h2>
            <form onSubmit={handleAddResult} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase mb-1 block">User ID</label>
                <input type="number" required className="input" placeholder="e.g. 1" 
                  value={modalData.user_id} onChange={e => setModalData({...modalData, user_id: e.target.value})} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase mb-1 block">Hackathon Name</label>
                <input type="text" required className="input" placeholder="e.g. Smart India Hackathon" 
                  value={modalData.hackathon_name} onChange={e => setModalData({...modalData, hackathon_name: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase mb-1 block">Position</label>
                  <input type="number" className="input" placeholder="1 for 1st, 0 for participation" 
                    value={modalData.position} onChange={e => setModalData({...modalData, position: parseInt(e.target.value)})} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase mb-1 block">Points</label>
                  <input type="number" required className="input" placeholder="e.g. 100" 
                    value={modalData.points} onChange={e => setModalData({...modalData, points: parseInt(e.target.value)})} />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1">Save Result</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
function CodeIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
    </svg>
  )
}
function MsgIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  )
}
