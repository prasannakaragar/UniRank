import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useEffect, useState } from 'react'
import api from '../api/axios'

const nav = [
  { to: '/dashboard',     label: 'Dashboard',     icon: GridIcon },
  { to: '/leaderboard',   label: 'Leaderboard',   icon: TrophyIcon },
  { to: '/announcements', label: 'Announcements', icon: MegaphoneIcon },
  { to: '/teams',         label: 'Teams',         icon: UsersIcon },
  { to: '/chats',         label: 'Chats',         icon: ChatIcon, badge: true },
  { to: '/profile',       label: 'My Profile',    icon: UserIcon },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [unread, setUnread] = useState(0)

  const handleLogout = () => { logout(); navigate('/login') }

  useEffect(() => {
    const fetchUnread = () =>
      api.get('/chats/unread').then(r => setUnread(r.data.unread || 0)).catch(() => {})
    fetchUnread()
    const id = setInterval(fetchUnread, 8000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="flex min-h-screen">
      {/* ── Sidebar ── */}
      <aside className="w-64 bg-void/50 backdrop-blur-2xl border-r border-glass-border flex flex-col fixed h-full z-10">
        {/* Logo */}
        <div className="px-6 py-6 border-b border-glass-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-accent-indigo rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <span className="text-white font-display font-black text-sm">U</span>
            </div>
            <div>
              <p className="font-display font-bold text-white text-lg leading-none tracking-tight">UniRank</p>
              <p className="text-[10px] text-slate-500 font-mono mt-1 uppercase tracking-widest">Platform</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map(({ to, label, icon: Icon, badge }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-body transition-all duration-300 ${
                  isActive
                    ? 'bg-accent-indigo/10 text-accent-indigo border border-accent-indigo/30 shadow-lg shadow-indigo-500/5'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`
              }
            >
              <Icon size={17} />
              {label}
              {badge && unread > 0 && (
                <span className="ml-auto bg-accent-indigo text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-lg shadow-indigo-500/30">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className="px-4 py-4 border-t border-glass-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-accent-indigo/10 border border-accent-indigo/30 flex items-center justify-center">
              <span className="text-accent-indigo font-display font-bold text-xs">
                {user?.name?.[0]?.toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-display font-semibold text-white truncate">{user?.name}</p>
              <p className="text-[10px] text-slate-500 truncate">{user?.branch} · Y{user?.year}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="w-full text-left text-xs text-slate-500 hover:text-rose-400 transition-colors px-1 py-1 font-medium">
            Sign out →
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 ml-64 min-h-screen">
        <div className="max-w-6xl mx-auto px-6 py-8">
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
