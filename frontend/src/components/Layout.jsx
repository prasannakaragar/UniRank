import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useEffect, useState } from 'react'
import api from '../api/axios'
import { io } from 'socket.io-client'

function timeAgo(dateStr) {
  const now = new Date()
  const date = new Date(dateStr)
  const seconds = Math.floor((now - date) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

const nav = [
  { to: '/dashboard',     label: 'Dashboard',     icon: GridIcon, roles: ['student', 'mentor', 'admin'] },
  { to: '/leaderboard',   label: 'Leaderboard',   icon: TrophyIcon, roles: ['student', 'mentor', 'admin'] },
  { to: '/announcements', label: 'Announcements', icon: MegaphoneIcon, roles: ['student', 'mentor', 'admin'] },
  { to: '/teams',         label: 'Teams',         icon: UsersIcon, roles: ['student', 'admin'] }, // Mentors don't need teams
  { to: '/chats',         label: 'Chats',         icon: ChatIcon, roles: ['student', 'mentor', 'admin'], badge: true },
  { to: '/profile',       label: 'My Profile',    icon: UserIcon, roles: ['student', 'mentor', 'admin'] },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [unread, setUnread] = useState(0)
  const [bellOpen, setBellOpen] = useState(false)
  const [pendingRequests, setPendingRequests] = useState([])
  const [unreadCertCount, setUnreadCertCount] = useState(0)
  const [certToast, setCertToast] = useState(null)
  const [previewImage, setPreviewImage] = useState(null)

  const handleLogout = () => { logout(); navigate('/login') }

  useEffect(() => {
    const fetchUnread = () =>
      api.get('/chats/unread').then(r => setUnread(r.data.unread || 0)).catch(() => {})
    fetchUnread()
    const id = setInterval(fetchUnread, 8000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (user?.role !== 'admin' && user?.role !== 'superadmin') return
    const fetchPending = () => {
      api.get('/hackathons/pending-requests').then(r => setPendingRequests(r.data.submissions || [])).catch(() => {})
      api.get('/notifications/unread-count').then(r => setUnreadCertCount(r.data.count || 0)).catch(() => {})
    }
    fetchPending()

    const socket = io(import.meta.env.VITE_API_URL?.replace('/api', '') || window.location.origin)
    socket.on('new_certificate_request', () => {
      fetchPending()
    })
    return () => socket.disconnect()
  }, [user?.role])

  useEffect(() => {
    if (!bellOpen) return
    const handleClick = (e) => {
      if (!e.target.closest('.notification-bell-container')) {
        setBellOpen(false)
      }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [bellOpen])

  const handleApprove = async (subId) => {
    try {
      const res = await api.post(`/hackathons/submissions/${subId}/review`, { action: 'approve' })
      setPendingRequests(prev => prev.filter(r => r.id !== subId))
      setUnreadCertCount(prev => Math.max(0, prev - 1))
      setCertToast({ type: 'ok', text: res.data.message || 'Approved!' })
      setTimeout(() => setCertToast(null), 3000)
    } catch (err) {
      setCertToast({ type: 'err', text: err.response?.data?.error || 'Failed to approve' })
      setTimeout(() => setCertToast(null), 3000)
    }
  }

  const handleReject = async (subId) => {
    try {
      await api.post(`/hackathons/submissions/${subId}/review`, { action: 'reject' })
      setPendingRequests(prev => prev.filter(r => r.id !== subId))
      setUnreadCertCount(prev => Math.max(0, prev - 1))
      setCertToast({ type: 'ok', text: 'Request rejected.' })
      setTimeout(() => setCertToast(null), 3000)
    } catch (err) {
      setCertToast({ type: 'err', text: err.response?.data?.error || 'Failed to reject' })
      setTimeout(() => setCertToast(null), 3000)
    }
  }

  return (
    <div className="flex min-h-screen bg-page">
      {/* ── Sidebar ── */}
      <aside className="w-[280px] bg-white border-r border-sidebar-border flex flex-col fixed h-full z-10">
        {/* Logo */}
        <div className="px-8 py-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">U</span>
            </div>
            <div>
              <p className="font-bold text-text-primary text-xl leading-none tracking-tight">UniRank</p>
              <p className="text-[10px] text-text-secondary font-bold mt-1 uppercase tracking-[0.1em]">PLATFORM</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-2 space-y-1">
          {nav
            .filter(item => !item.roles || item.roles.includes(user?.role))
            .map(({ to, label, icon: Icon, badge }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-accent-pill text-primary relative before:absolute before:left-0 before:top-2.5 before:bottom-2.5 before:w-1 before:bg-primary before:rounded-r-full'
                    : 'text-text-secondary hover:bg-page'
                }`
              }
            >
              <Icon size={18} className="stroke-[2.5]" />
              {label}
              {badge && unread > 0 && (
                <span className="ml-auto bg-primary text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className="px-6 py-6 border-t border-border-dim">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center border border-border-dim">
              <span className="text-primary font-bold text-sm">
                {user?.name?.[0]?.toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-text-primary truncate">{user?.name}</p>
              <p className="text-[11px] text-text-secondary font-medium truncate uppercase tracking-wider">{user?.branch} · Y{user?.year}</p>
            </div>
          </div>
          <button 
            onClick={handleLogout} 
            className="flex items-center gap-2 text-[13px] font-medium text-text-secondary hover:text-text-primary transition-colors group"
          >
            Sign out <span className="group-hover:translate-x-1 transition-transform">→</span>
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 ml-[280px] min-h-screen">
        {/* Admin notification bell bar */}
        {(user?.role === 'admin' || user?.role === 'superadmin') && (
          <div className="sticky top-0 z-30 bg-page/80 backdrop-blur-md border-b border-border-dim">
            <div className="max-w-6xl mx-auto px-10 py-3 flex justify-end items-center">
              <div className="relative notification-bell-container">
                <button
                  onClick={() => setBellOpen(!bellOpen)}
                  className="relative w-10 h-10 rounded-xl bg-white border border-border-dim flex items-center justify-center hover:bg-gray-50 transition-all shadow-sm"
                >
                  <span className="text-lg">🔔</span>
                  {unreadCertCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center animate-pulse">
                      {unreadCertCount > 9 ? '9+' : unreadCertCount}
                    </span>
                  )}
                </button>

                {/* Dropdown */}
                {bellOpen && (
                  <div className="absolute right-0 top-12 w-[420px] bg-white border border-border-dim rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-50">
                    <div className="px-5 py-4 border-b border-border-dim flex items-center justify-between">
                      <h3 className="text-sm font-black text-text-primary uppercase tracking-wider">Certificate Requests</h3>
                      <button onClick={() => setBellOpen(false)} className="text-text-secondary hover:text-text-primary text-lg">✕</button>
                    </div>
                    <div className="max-h-[400px] overflow-y-auto">
                      {pendingRequests.length === 0 ? (
                        <div className="py-10 text-center text-text-secondary text-sm italic">No pending requests</div>
                      ) : (
                        pendingRequests.map(req => (
                          <div key={req.id} className="p-4 border-b border-border-dim hover:bg-page/50 transition-colors">
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center text-lg flex-shrink-0">
                                {req.event_type === '1st Place' ? '🥇' : req.event_type === '2nd Place' ? '🥈' : req.event_type === '3rd Place' ? '🥉' : '🏆'}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-text-primary truncate">{req.user_name}</p>
                                <p className="text-xs text-text-secondary mt-0.5 truncate">{req.hackathon_name} · <span className="font-semibold">{req.event_type}</span></p>
                                <p className="text-xs font-bold text-primary mt-1">{req.points_to_award} pts to award</p>
                                {req.certificate_url && req.certificate_url !== 'no_certificate' && (
                                  <button
                                    onClick={() => setPreviewImage(req.certificate_url.startsWith('/') ? (import.meta.env.VITE_API_URL?.replace('/api', '') || '') + req.certificate_url : req.certificate_url)}
                                    className="text-[11px] text-primary hover:underline mt-1 font-semibold"
                                  >
                                    📎 View Certificate
                                  </button>
                                )}
                                <p className="text-[10px] text-text-secondary mt-1">{timeAgo(req.created_at)}</p>
                              </div>
                            </div>
                            <div className="flex gap-2 mt-3">
                              <button
                                onClick={() => handleApprove(req.id)}
                                className="flex-1 py-2 rounded-lg bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600 transition-colors"
                              >
                                ✓ Approve
                              </button>
                              <button
                                onClick={() => handleReject(req.id)}
                                className="flex-1 py-2 rounded-lg bg-red-50 text-red-600 border border-red-200 text-xs font-bold hover:bg-red-100 transition-colors"
                              >
                                ✗ Reject
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Toast for cert actions */}
        {certToast && (
          <div className={`fixed top-4 right-4 z-50 rounded-xl px-5 py-3 text-sm font-bold shadow-lg animate-in slide-in-from-top-2 duration-200 ${
            certToast.type === 'ok' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
          }`}>
            {certToast.text}
          </div>
        )}

        {/* Certificate preview modal */}
        {previewImage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setPreviewImage(null)}>
            <div className="relative max-w-3xl max-h-[80vh] bg-white rounded-2xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
              <button onClick={() => setPreviewImage(null)} className="absolute top-3 right-3 w-8 h-8 rounded-lg bg-white/90 text-text-primary flex items-center justify-center hover:bg-gray-100 shadow-md z-10">✕</button>
              <img src={previewImage} alt="Certificate" className="max-w-full max-h-[80vh] object-contain" />
            </div>
          </div>
        )}

        <div className="max-w-6xl mx-auto px-10 py-10">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

/* ── Inline SVG Icons ── */
function GridIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>
  )
}
function TrophyIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="8 21 12 17 16 21"/><line x1="12" y1="17" x2="12" y2="11"/>
      <path d="M7 4H4a2 2 0 0 0-2 2v2a4 4 0 0 0 4 4h12a4 4 0 0 0 4-4V6a2 2 0 0 0-2-2h-3"/>
      <path d="M7 4h10v7a5 5 0 0 1-10 0V4z"/>
    </svg>
  )
}
function MegaphoneIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11l19-9-9 19-2-8-8-2z"/>
    </svg>
  )
}
function UsersIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )
}
function UserIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  )
}
function CodeIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
    </svg>
  )
}
function ChatIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  )
}
