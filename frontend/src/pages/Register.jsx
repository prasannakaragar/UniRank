import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const BRANCHES = ['CSE', 'ISE', 'ECE', 'EEE', 'ME', 'CE', 'BT', 'CH', 'Other']

export default function Register() {
  const { register, verifyOtp, resendOtp } = useAuth()
  const navigate = useNavigate()

  const [step, setStep]       = useState('register')
  const [form, setForm]       = useState({ name: '', email: '', password: '', branch: '', year: '' })
  const [otp, setOtp]         = useState(['', '', '', '', '', ''])
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [countdown, setCountdown] = useState(0)

  const inputRefs = useRef([])
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  useEffect(() => {
    if (countdown <= 0) return
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown])

  const handleRegister = async (e) => {
    e.preventDefault()
    setError(''); setSuccess(''); setLoading(true)
    try {
      const res = await register({ ...form, year: parseInt(form.year) })
      setSuccess(res.message || 'OTP sent to your email!')
      setCountdown(300)
      setStep('verify')
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async (e) => {
    e.preventDefault()
    const otpString = otp.join('')
    if (otpString.length !== 6) { setError('Please enter the full 6-digit OTP'); return }
    setError(''); setSuccess(''); setLoading(true)
    try {
      const res = await verifyOtp(form.email, otpString)
      if (res.college_verified) {
        setSuccess('Email verified! Logging you in…')
        setTimeout(() => navigate('/dashboard'), 1500)
      } else {
        setError(res.warning || 'Your email domain is not recognised. Contact admin.')
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Verification failed.')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (countdown > 0) return
    setError(''); setSuccess(''); setLoading(true)
    try {
      const res = await resendOtp(form.email)
      setSuccess(res.message || 'New OTP sent!')
      setCountdown(300)
      setOtp(['', '', '', '', '', ''])
    } catch (err) {
      setError(err.response?.data?.error || 'Could not resend OTP.')
    } finally {
      setLoading(false)
    }
  }

  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return
    const newOtp = [...otp]
    newOtp[index] = value.slice(-1)
    setOtp(newOtp)
    if (value && index < 5) inputRefs.current[index + 1]?.focus()
  }

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handleOtpPaste = (e) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length === 6) {
      setOtp(pasted.split(''))
      inputRefs.current[5]?.focus()
    }
  }

  const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

  return (
    <div className="min-h-screen bg-page flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">

        {/* Logo mark */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-2xl mb-5 shadow-lg">
            <span className="text-white font-bold text-3xl">U</span>
          </div>
          <h1 className="text-3xl font-extrabold text-text-primary">
            {step === 'register' ? 'Create Account' : 'Verify Email'}
          </h1>
          <p className="text-text-secondary text-[15px] mt-2 font-medium">
            {step === 'register'
              ? "Join your college's competitive network"
              : `Enter the 6-digit code sent to ${form.email}`}
          </p>
        </div>

        <div className="card p-8 space-y-6">
          {/* Feedback banners */}
          {error && (
            <div className="bg-danger/5 border border-danger/20 rounded-xl px-5 py-4 text-danger text-sm font-medium animate-in slide-in-from-top-2 duration-200">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-5 py-4 text-emerald-700 text-sm font-medium animate-in slide-in-from-top-2 duration-200">
              {success}
            </div>
          )}

          {/* ── Registration Form ── */}
          {step === 'register' && (
            <form onSubmit={handleRegister} className="space-y-5">
              <div>
                <label className="section-label block mb-2">Full Name</label>
                <input className="input" placeholder="Arjun Sharma" value={form.name}
                  onChange={e => set('name', e.target.value)} required />
              </div>

              <div>
                <label className="section-label block mb-2">College Email</label>
                <input className="input" type="email" placeholder="you@reva.edu.in" value={form.email}
                  onChange={e => set('email', e.target.value)} required />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="section-label block mb-2">Branch</label>
                  <select className="input" value={form.branch} onChange={e => set('branch', e.target.value)} required>
                    <option value="">Select…</option>
                    {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="section-label block mb-2">Year</label>
                  <select className="input" value={form.year} onChange={e => set('year', e.target.value)} required>
                    <option value="">Select…</option>
                    {[1, 2, 3, 4].map(y => <option key={y} value={y}>Year {y}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="section-label block mb-2">Password</label>
                <input className="input" type="password" placeholder="Min 8 characters" value={form.password}
                  onChange={e => set('password', e.target.value)} required minLength={8} />
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full py-3.5 mt-2">
                {loading ? 'Creating account…' : 'Create Account →'}
              </button>
            </form>
          )}

          {/* ── OTP Verification ── */}
          {step === 'verify' && (
            <form onSubmit={handleVerify} className="space-y-8">
              <div className="bg-accent-pill border border-primary/20 rounded-xl p-4 text-center">
                <p className="text-primary text-sm font-bold">OTP sent to {form.email}</p>
                <p className="text-text-secondary text-xs mt-1 font-medium">
                  Check your spam or junk folder if you don't see it in your inbox.
                </p>
              </div>

              {/* 6-digit OTP boxes */}
              <div className="flex justify-center gap-3" onPaste={handleOtpPaste}>
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={el => inputRefs.current[i] = el}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={e => handleOtpChange(i, e.target.value)}
                    onKeyDown={e => handleOtpKeyDown(i, e)}
                    className={`w-12 h-14 text-center text-xl font-extrabold rounded-xl border-2 outline-none transition-all ${
                      digit ? 'bg-primary text-white border-primary shadow-md' : 'bg-white text-text-secondary border-border-dim hover:border-primary/30'
                    }`}
                    autoFocus={i === 0}
                  />
                ))}
              </div>

              {/* Timer + Resend */}
              <div className="text-center space-y-2">
                {countdown > 0 ? (
                  <p className="text-text-secondary text-sm font-medium">
                    OTP expires in{' '}
                    <span className="text-primary font-extrabold font-mono">{formatTime(countdown)}</span>
                  </p>
                ) : (
                  <p className="text-danger text-sm font-bold">OTP expired</p>
                )}
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={loading || countdown > 0}
                  className="text-primary font-bold text-sm hover:underline disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  Resend OTP
                </button>
              </div>

              <button type="submit" disabled={loading || otp.join('').length !== 6}
                className="btn-primary w-full py-3.5">
                {loading ? 'Verifying…' : 'Verify Email →'}
              </button>

              <button
                type="button"
                onClick={() => { setStep('register'); setError(''); setSuccess('') }}
                className="w-full text-sm text-text-secondary hover:text-text-primary transition-colors font-medium"
              >
                ← Back to registration
              </button>
            </form>
          )}

          <p className="text-center text-sm text-text-secondary font-medium pt-2 border-t border-border-dim">
            Already have an account?{' '}
            <Link to="/login" className="text-primary font-bold hover:underline underline-offset-4 decoration-primary/30">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
