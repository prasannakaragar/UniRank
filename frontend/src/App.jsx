import { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'

const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Leaderboard = lazy(() => import('./pages/Leaderboard'))
const Announcements = lazy(() => import('./pages/Announcements'))
const Teams = lazy(() => import('./pages/Teams'))
const Profile = lazy(() => import('./pages/Profile'))
const Chats = lazy(() => import('./pages/Chats'))

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
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      }>
        <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login"    element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

        <Route element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route path="/dashboard"     element={<Dashboard />} />
          <Route path="/leaderboard"   element={<Leaderboard />} />
          <Route path="/announcements" element={<Announcements />} />
          <Route path="/teams"         element={
            <RoleRoute allowedRoles={['student', 'admin']}>
              <Teams />
            </RoleRoute>
          } />
          <Route path="/chats"         element={<Chats />} />
          <Route path="/profile"       element={<Profile />} />
          <Route path="/profile/:id"   element={<Profile />} />
        </Route>

        {/* Catch-all or 404 could go here */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </AuthProvider>
  )
}
