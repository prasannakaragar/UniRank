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
  if (rank === 1) return <span className="text-xl">🥇</span>
  if (rank === 2) return <span className="text-xl">🥈</span>
  if (rank === 3) return <span className="text-xl">🥉</span>
  return <span className="font-bold text-text-secondary text-sm w-6 text-center">{rank}</span>
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
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-bold text-text-primary">Leaderboard</h1>
          <p className="text-text-secondary text-[15px] mt-2 font-medium">
            {type === 'cp' ? 'Competitive programming rankings across platforms.' : 
             type === 'github' ? 'GitHub AI project analysis rankings based on repo impact.' :
             'Hackathon achievements and participation scores.'}
          </p>
        </div>
        <div className="flex gap-3">
          {user?.role === 'faculty' && (
            <button onClick={() => setShowModal(true)} className="btn-primary py-2.5">
              + Add Result
            </button>
          )}
          <button onClick={fetchData} className="btn-secondary py-2.5">
            ↻ Refresh
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-center border-b border-border-dim">
        <div className="flex">
          {[
            { id: 'cp', label: 'CP Rankings' },
            { id: 'hackathon', label: 'Hackathon' },
            { id: 'github', label: 'GitHub Analysis' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setType(tab.id)}
              className={`px-6 py-4 text-sm font-bold transition-all border-b-2 -mb-[2px] ${
                type === tab.id ? 'border-primary text-primary' : 'border-transparent text-text-secondary hover:text-gray-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        
        {/* Scope Toggle */}
        <div className="flex p-1 bg-border-dim/30 rounded-lg mb-4 sm:mb-2 border border-border-dim">
          <button
            onClick={() => setScope('global')}
            className={`px-5 py-1.5 text-xs font-bold rounded-md transition-all ${
              scope === 'global' ? 'bg-white text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            GLOBAL 🌍
          </button>
          <button
            onClick={() => setScope('college')}
            className={`px-5 py-1.5 text-xs font-bold rounded-md transition-all ${
              scope === 'college' ? 'bg-white text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            COLLEGE 🏫
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative">
          <select className="appearance-none bg-white border border-border-dim rounded-full px-6 py-2 pr-10 text-xs font-bold text-text-secondary focus:outline-none focus:ring-1 focus:ring-primary/20" value={branch} onChange={e => setBranch(e.target.value)}>
            <option value="">ALL BRANCHES</option>
            {['CSE','ISE','ECE','EEE','ME','CE'].map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-text-secondary">
            <ChevronDownIcon size={12} />
          </div>
        </div>

        <div className="relative">
          <select className="appearance-none bg-white border border-border-dim rounded-full px-6 py-2 pr-10 text-xs font-bold text-text-secondary focus:outline-none focus:ring-1 focus:ring-primary/20" value={year} onChange={e => setYear(e.target.value)}>
            <option value="">ALL YEARS</option>
            {[1,2,3,4].map(y => <option key={y} value={y}>YEAR {y}</option>)}
          </select>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-text-secondary">
            <ChevronDownIcon size={12} />
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-24">
          <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : data.length === 0 ? (
        <div className="card text-center py-24 text-text-secondary font-medium italic">
          No rankings available for this category.
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="table-header w-20 text-center">RANK</th>
                  <th className="table-header">STUDENT</th>
                  {type === 'cp' ? (
                    <>
                      <th className="table-header">PLATFORMS</th>
                      <th className="table-header text-right">RATING</th>
                      <th className="table-header text-right">SOLVED</th>
                      <th className="table-header text-right text-primary">CP SCORE</th>
                    </>
                  ) : type === 'hackathon' ? (
                    <>
                      <th className="table-header text-right text-primary">SCORE</th>
                      <th className="table-header text-right">HACKATHONS</th>
                    </>
                  ) : type === 'github' ? (
                    <>
                      <th className="table-header text-center">REPO</th>
                      <th className="table-header text-right">IMPL</th>
                      <th className="table-header text-right">IMPACT</th>
                      <th className="table-header text-right">WORKING</th>
                      <th className="table-header text-right text-primary">TOTAL</th>
                    </>
                  ) : null}
                  <th className="table-header hidden md:table-cell">BRANCH</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dashed divide-border-dim">
                {data.map((entry) => {
                  const isMe = entry.user_id === user?.id
                  return (
                    <tr key={entry.user_id}
                      className={`transition-colors border-b border-dashed border-border-dim ${
                        isMe ? 'bg-accent-pill border-l-4 border-l-primary' : 'hover:bg-page/50'
                      }`}>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-center">
                          <MedalIcon rank={entry.rank} />
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          {entry.avatar_url ? (
                            <img src={entry.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover border border-border-dim" />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center border border-border-dim">
                              <span className="text-sm font-bold text-text-secondary">{entry.name[0]}</span>
                            </div>
                          )}
                          <div>
                            <p className={`text-[15px] font-bold ${isMe ? 'text-primary' : 'text-text-primary'}`}>
                              {entry.name} {isMe && <span className="text-xs ml-1">(YOU)</span>}
                            </p>
                            <p className="text-[11px] text-text-secondary font-bold uppercase tracking-wider">Year {entry.year}</p>
                          </div>
                        </div>
                      </td>
                      
                      {type === 'cp' && (
                        <>
                          <td className="px-4 py-4">
                            <div className="flex flex-col gap-1">
                              {entry.cf_handle && (
                                <a href={`https://codeforces.com/profile/${entry.cf_handle}`}
                                   target="_blank" rel="noreferrer"
                                   className="text-[12px] font-bold rank-link">
                                  <span className="text-text-secondary font-medium">CF:</span> @{entry.cf_handle}
                                </a>
                              )}
                              {entry.lc_username && (
                                <a href={`https://leetcode.com/${entry.lc_username}`}
                                   target="_blank" rel="noreferrer"
                                   className="text-[12px] font-bold rank-link-amber">
                                  <span className="text-text-secondary font-medium">LC:</span> @{entry.lc_username}
                                </a>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4 text-right">
                            <div className="flex flex-col gap-1">
                              <span className="text-[13px] font-bold text-primary">
                                {entry.cf_rating || 0}
                              </span>
                              <span className="text-[13px] font-bold text-secondary">
                                {entry.lc_rating || 0}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-right">
                            <div className="flex flex-col gap-1">
                              <span className="text-[12px] font-bold text-text-secondary">{entry.cf_problems_solved || 0}</span>
                              <span className="text-[12px] font-bold text-secondary/60">{entry.lc_problems_solved || 0}</span>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-right text-[15px] font-extrabold text-primary">
                            {entry.cp_score}
                          </td>
                        </>
                      )}

                      {type === 'hackathon' && (
                        <>
                          <td className="px-4 py-4 text-right text-[15px] font-extrabold text-primary">
                            {entry.score}
                          </td>
                          <td className="px-4 py-4 text-right font-bold text-text-secondary">
                            {entry.hackathons_count}
                          </td>
                        </>
                      )}

                      {type === 'github' && (
                        <>
                          <td className="px-4 py-4 text-center">
                            {entry.github_url ? (
                              <a href={entry.github_url} target="_blank" rel="noreferrer" className="inline-flex p-2 bg-gray-100 rounded-lg text-primary hover:bg-primary/10 transition-colors" title={entry.github_review_reason}>
                                <CodeIcon size={16} />
                              </a>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                          <td className="px-4 py-4 text-right font-bold text-text-secondary">
                            {entry.github_impl_score?.toFixed(1) || '0.0'}
                          </td>
                          <td className="px-4 py-4 text-right font-bold text-text-secondary">
                            {entry.github_imp_score?.toFixed(1) || '0.0'}
                          </td>
                          <td className="px-4 py-4 text-right font-bold text-text-secondary">
                            {entry.github_work_score?.toFixed(1) || '0.0'}
                          </td>
                          <td className="px-4 py-4 text-right text-[15px] font-extrabold text-primary">
                            {entry.github_total_score?.toFixed(1) || '0.0'}
                          </td>
                        </>
                      )}

                      <td className="px-4 py-4 hidden md:table-cell">
                        <div className="flex items-center gap-3">
                          <span className="badge bg-gray-100 text-text-secondary font-bold">{entry.branch}</span>
                          {!isMe && (
                            <button
                              onClick={() => navigate(`/chats?dm=${entry.user_id}`)}
                              title="Send message"
                              className="p-2 rounded-lg text-text-secondary hover:text-primary hover:bg-primary/5 transition-colors"
                            >
                              <MsgIcon size={16} />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
          <div className="bg-white border border-border-dim rounded-2xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-8 py-6 border-b border-border-dim">
              <h2 className="text-xl font-bold text-text-primary">Add Hackathon Result</h2>
              <button onClick={() => setShowModal(false)} className="w-8 h-8 rounded-lg bg-gray-100 text-text-secondary hover:bg-gray-200 flex items-center justify-center transition-colors">✕</button>
            </div>
            <form onSubmit={handleAddResult} className="p-8 space-y-6">
              <div>
                <label className="section-label block mb-2">User ID</label>
                <input type="number" required className="input" placeholder="e.g. 1"
                  value={modalData.user_id} onChange={e => setModalData({...modalData, user_id: e.target.value})} />
              </div>
              <div>
                <label className="section-label block mb-2">Hackathon Name</label>
                <input type="text" required className="input" placeholder="e.g. Smart India Hackathon"
                  value={modalData.hackathon_name} onChange={e => setModalData({...modalData, hackathon_name: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="section-label block mb-2">Position</label>
                  <input type="number" className="input" placeholder="1 for 1st, 0 for participation"
                    value={modalData.position} onChange={e => setModalData({...modalData, position: parseInt(e.target.value)})} />
                </div>
                <div>
                  <label className="section-label block mb-2">Points</label>
                  <input type="number" required className="input" placeholder="e.g. 100"
                    value={modalData.points} onChange={e => setModalData({...modalData, points: parseInt(e.target.value)})} />
                </div>
              </div>
              <div className="flex gap-4 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1 py-3">Cancel</button>
                <button type="submit" className="btn-primary flex-1 py-3">Save Result</button>
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
function ChevronDownIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  )
}
