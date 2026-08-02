import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'

// ── Lazy-loaded page chunks (one bundle per route) ──────────────────
const Login        = lazy(() => import('./pages/Login'))
const Register     = lazy(() => import('./pages/Register'))
const Dashboard    = lazy(() => import('./pages/Dashboard'))
const Leaderboard  = lazy(() => import('./pages/Leaderboard'))
const Announcements       = lazy(() => import('./pages/Announcements'))
const AnnouncementDetail  = lazy(() => import('./pages/AnnouncementDetail'))
const Teams        = lazy(() => import('./pages/Teams'))
const Profile      = lazy(() => import('./pages/Profile'))
const Chats        = lazy(() => import('./pages/Chats'))
const Discovery    = lazy(() => import('./pages/Discovery'))

// ── Suspense fallback: full-page shimmer skeleton ───────────────────
function PageSkeleton() {
  return (
    <div className="min-h-screen bg-page flex flex-col">
      {/* Fake top nav shimmer */}
      <div className="h-16 bg-white border-b border-border-dim px-8 flex items-center gap-4 shrink-0">
        <div className="w-28 h-5 rounded-lg bg-gray-200 animate-pulse" />
        <div className="flex-1" />
        <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
      </div>

      {/* Body shimmer */}
      <div className="flex-1 flex">
        {/* Sidebar shimmer */}
        <div className="w-56 bg-white border-r border-border-dim p-4 space-y-3 hidden md:block shrink-0">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-9 rounded-lg bg-gray-100 animate-pulse" />
          ))}
        </div>

        {/* Content shimmer */}
        <div className="flex-1 p-8 space-y-6 max-w-5xl">
          <div className="h-8 w-64 rounded-lg bg-gray-200 animate-pulse" />
          <div className="h-4 w-40 rounded bg-gray-100 animate-pulse" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mt-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-[140px] rounded-2xl bg-gray-100 animate-pulse" />
            ))}
          </div>
          <div className="grid lg:grid-cols-2 gap-6 mt-4">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-64 rounded-2xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Route guards ─────────────────────────────────────────────────────
function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )
  return user ? children : <Navigate to="/login" replace />
}

function RoleRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )
  
  if (!user) return <Navigate to="/login" replace />
  
  if (user.role === 'admin') return children; // Admin can access everything
  
  return allowedRoles.includes(user.role) ? children : <Navigate to="/dashboard" replace />
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  return user ? <Navigate to="/dashboard" replace /> : children
}

export default function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<PageSkeleton />}>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login"    element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

          <Route element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route path="/dashboard"     element={<Dashboard />} />
            <Route path="/leaderboard"   element={<Leaderboard />} />
            <Route path="/announcements"     element={<Announcements />} />
            <Route path="/announcements/:id" element={<AnnouncementDetail />} />
            <Route path="/teams"         element={
              <RoleRoute allowedRoles={['student', 'admin']}>
                <Teams />
              </RoleRoute>
            } />
            <Route path="/chats"         element={<Chats />} />
            <Route path="/discovery"    element={<Discovery />} />
            <Route path="/profile"       element={<Profile />} />
            <Route path="/profile/:id"   element={<Profile />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </AuthProvider>
  )
}
