import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api/axios'

export default function ForgotPassword() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccessMsg('')
    setLoading(true)

    try {
      const res = await api.post('/forgot-password', { email })
      setSuccessMsg(res.data?.message || 'Password reset code sent to your email.')
      setTimeout(() => {
        navigate(`/reset-password?email=${encodeURIComponent(email)}`)
      }, 1500)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to request password reset. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-page flex items-center justify-center px-4 relative overflow-hidden">
      {/* Subtle radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/7 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-[420px] relative z-10">
        {/* Card */}
        <div className="bg-white rounded-2xl border border-border-dim shadow-card p-10">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-primary rounded-xl mb-6">
              <span className="text-white font-bold text-2xl">U</span>
            </div>
            <h1 className="text-2xl font-bold text-text-primary mb-2">Reset Password</h1>
            <p className="text-text-secondary text-[15px]">Enter your college email to receive a verification code</p>
          </div>

          {error && (
            <div className="bg-danger/10 border border-danger/20 rounded-lg px-4 py-3 text-danger text-sm mb-6">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-emerald-700 text-sm mb-6">
              {successMsg} Redirecting to reset page...
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="section-label block mb-2">College Email</label>
              <input
                className="input"
                type="email"
                placeholder="you@college.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Sending Code…' : 'Send Reset Code'}
            </button>
          </form>

          <div className="text-center text-[14px] text-text-secondary mt-8 space-y-2">
            <p>
              Remembered your password?{' '}
              <Link to="/login" className="text-primary font-bold underline decoration-primary/30 hover:decoration-primary transition-all">
                Back to Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
