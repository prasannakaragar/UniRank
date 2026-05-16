import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useEffect, useState } from 'react'
import api from '../api/axios'

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

  const handleLogout = () => { logout(); navigate('/login') }

  useEffect(() => {
    const fetchUnread = () =>
      api.get('/chats/unread').then(r => setUnread(r.data.unread || 0)).catch(() => {})
    fetchUnread()
    const id = setInterval(fetchUnread, 8000)
    return () => clearInterval(id)
  }, [])

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
