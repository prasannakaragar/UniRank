import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const navigate  = useNavigate()
  const [form, setForm]     = useState({ email: '', password: '' })
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      await login(form.email, form.password)
      navigate('/dashboard')
    } catch (err) {
      const data = err.response?.data
      if (data?.needs_verification) {
        setError('Your email is not verified yet. Please check your inbox for the OTP or register again.')
      } else if (data?.college_verified === false) {
        setError('Your email domain is not recognised. Only @reva.edu.in accounts are allowed. Contact admin for manual verification.')
      } else {
        setError(data?.error || 'Login failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-accent-indigo/10 border border-accent-indigo/30 rounded-2xl mb-4 shadow-lg shadow-indigo-500/20">
            <span className="text-accent-indigo font-display font-black text-2xl">U</span>
          </div>
          <h1 className="font-display font-bold text-3xl text-white">UniRank</h1>
          <p className="text-slate-400 text-sm mt-1">Sign in to your college account</p>
        </div>

        {/* Form */}
        <div className="card space-y-5 relative overflow-hidden">
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg px-4 py-3 text-rose-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-display font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                College Email
              </label>
              <input
                className="input"
                type="email"
                placeholder="you@reva.edu.in"
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-display font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <input
                className="input"
                type="password"
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                required
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500">
            No account?{' '}
            <Link to="/register" className="text-accent-indigo hover:text-accent-cyan font-bold transition-all">
              Register here
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
