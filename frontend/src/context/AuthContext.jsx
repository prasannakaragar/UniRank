import { createContext, useContext, useState, useEffect } from 'react'
import api from '../api/axios'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]     = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    const savedUser = localStorage.getItem('auth_user')
    
    if (!token) { setLoading(false); return }

    if (savedUser) {
      setUser(JSON.parse(savedUser))
    }

    api.get('/profile')
      .then(res => {
        setUser(res.data)
        localStorage.setItem('auth_user', JSON.stringify(res.data))
      })
      .catch(() => {
        localStorage.removeItem('token')
        localStorage.removeItem('auth_user')
      })
      .finally(() => setLoading(false))
  }, [])

  const login = async (email, password) => {
    const res = await api.post('/login', { email, password })
    localStorage.setItem('token', res.data.token)
    localStorage.setItem('auth_user', JSON.stringify(res.data.user))
    setUser(res.data.user)
    return res.data.user
  }

  const register = async (payload) => {
    const res = await api.post('/register', payload)
    return res.data
  }

  const verifyOtp = async (email, otp) => {
    const res = await api.post('/verify-otp', { email, otp })
    if (res.data.token && res.data.user) {
      localStorage.setItem('token', res.data.token)
      localStorage.setItem('auth_user', JSON.stringify(res.data.user))
      setUser(res.data.user)
    }
    return res.data
  }

  const resendOtp = async (email) => {
    const res = await api.post('/resend-otp', { email })
    return res.data
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('auth_user')
    setUser(null)
  }

  const refreshUser = async () => {
    const res = await api.get('/profile')
    setUser(prev => ({ ...prev, ...res.data }))
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, verifyOtp, resendOtp, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)