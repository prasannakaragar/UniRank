import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import api from '../api/axios'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [email, setEmail] = useState(searchParams.get('email') || '')
  const [otp, setOtp] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [step, setStep] = useState(1) // 1: Verify OTP, 2: New Password
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [loading, setLoading] = useState(false)

  // Step 1: Verify OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    setError('')
    setSuccessMsg('')
    setLoading(true)

    try {
      const res = await api.post('/verify-reset-otp', { email, otp })
      setResetToken(res.data.reset_token)
      setStep(2)
      setSuccessMsg('Code verified! Enter your new password below.')
    } catch (err) {
      setError(err.response?.data?.error || 'Verification failed. Please check the code and try again.')
    } finally {
      setLoading(false)
    }
  }

  // Step 2: Reset Password
  const handleResetPassword = async (e) => {
    e.preventDefault()
    setError('')
    setSuccessMsg('')

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      const res = await api.post('/reset-password', {
        reset_token: resetToken,
        new_password: newPassword,
      })
      setSuccessMsg(res.data?.message || 'Password reset successfully! Redirecting to login...')
      setTimeout(() => {
        navigate('/login')
      }, 2000)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reset password. Please try again.')
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
            <h1 className="text-2xl font-bold text-text-primary mb-2">
              {step === 1 ? 'Verify Code' : 'Set New Password'}
            </h1>
            <p className="text-text-secondary text-[15px]">
              {step === 1
                ? 'Enter the 6-digit verification code sent to your email'
                : 'Choose a strong new password for your account'}
            </p>
          </div>

          {error && (
            <div className="bg-danger/10 border border-danger/20 rounded-lg px-4 py-3 text-danger text-sm mb-6">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-emerald-700 text-sm mb-6">
              {successMsg}
            </div>
          )}

          {step === 1 ? (
            <form onSubmit={handleVerifyOtp} className="space-y-6">
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

              <div>
                <label className="section-label block mb-2">Verification Code (OTP)</label>
                <input
                  className="input text-center text-xl tracking-[0.5em] font-mono"
                  type="text"
                  maxLength={6}
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  required
                />
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? 'Verifying…' : 'Verify Code'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-6">
              <div>
                <label className="section-label block mb-2">New Password</label>
                <input
                  className="input"
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
                <p className="text-[12px] text-text-tertiary mt-1">
                  At least 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char.
                </p>
              </div>

              <div>
                <label className="section-label block mb-2">Confirm New Password</label>
                <input
                  className="input"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? 'Updating Password…' : 'Reset Password'}
              </button>
            </form>
          )}

          <div className="text-center text-[14px] text-text-secondary mt-8">
            <Link to="/login" className="text-primary font-bold underline decoration-primary/30 hover:decoration-primary transition-all">
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
