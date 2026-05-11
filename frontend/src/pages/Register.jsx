import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const BRANCHES = ['CSE', 'ISE', 'ECE', 'EEE', 'ME', 'CE', 'BT', 'CH', 'Other']

export default function Register() {
  const { register, verifyOtp, resendOtp } = useAuth()
  const navigate = useNavigate()

  // Steps: 'register' → 'verify'
  const [step, setStep]       = useState('register')
  const [form, setForm]       = useState({ name: '', email: '', password: '', branch: '', year: '' })
  const [otp, setOtp]         = useState(['', '', '', '', '', ''])
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [countdown, setCountdown] = useState(0)

  const inputRefs = useRef([])

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  // Countdown timer for resend OTP
  useEffect(() => {
    if (countdown <= 0) return
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown])

  // ── Step 1: Register ──────────────────────────────────────────────────────
  const handleRegister = async (e) => {
    e.preventDefault()
    setError(''); setSuccess(''); setLoading(true)
    try {
      const res = await register({ ...form, year: parseInt(form.year) })
      setSuccess(res.message || 'OTP sent to your email!')
      setCountdown(300) // 5 minutes
      setStep('verify')
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // ── Step 2: Verify OTP ────────────────────────────────────────────────────
  const handleVerify = async (e) => {
    e.preventDefault()
    const otpString = otp.join('')
    if (otpString.length !== 6) {
      setError('Please enter the full 6-digit OTP')
      return
    }
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

  // ── OTP Input Handlers ────────────────────────────────────────────────────
  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return // digits only
    const newOtp = [...otp]
    newOtp[index] = value.slice(-1)
    setOtp(newOtp)
    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
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

  const formatTime = (s) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-accent-indigo/10 border border-accent-indigo/30 rounded-2xl mb-4 shadow-lg shadow-indigo-500/20">
            <span className="text-accent-indigo font-display font-black text-2xl">U</span>
          </div>
          <h1 className="font-display font-bold text-3xl text-white">
            {step === 'register' ? 'Create Account' : 'Verify Email'}
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {step === 'register'
              ? 'Join your college\'s competitive network'
              : `Enter the 6-digit code sent to ${form.email}`}
          </p>
        </div>

        <div className="card space-y-5">
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg px-4 py-3 text-rose-400 text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-accent-indigo/10 border border-accent-indigo/30 rounded-lg px-4 py-3 text-accent-indigo text-sm">
              {success}
            </div>
          )}

          {/* ── Registration Form ──────────────────────────────────────────── */}
          {step === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-display font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Full Name</label>
                <input className="input" placeholder="Arjun Sharma" value={form.name}
                  onChange={e => set('name', e.target.value)} required />
              </div>

              <div>
                <label className="block text-xs font-display font-semibold text-slate-400 uppercase tracking-wider mb-1.5">College Email</label>
                <input className="input" type="email" placeholder="you@reva.edu.in" value={form.email}
                  onChange={e => set('email', e.target.value)} required />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-display font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Branch</label>
                  <select className="input" value={form.branch} onChange={e => set('branch', e.target.value)} required>
                    <option value="">Select…</option>
                    {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-display font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Year</label>
                  <select className="input" value={form.year} onChange={e => set('year', e.target.value)} required>
                    <option value="">Select…</option>
                    {[1, 2, 3, 4].map(y => <option key={y} value={y}>Year {y}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-display font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Password</label>
                <input className="input" type="password" placeholder="Min 8 characters" value={form.password}
                  onChange={e => set('password', e.target.value)} required minLength={8} />
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
                {loading ? 'Creating account…' : 'Create Account'}
              </button>
            </form>
          )}

          {/* ── OTP Verification ───────────────────────────────────────────── */}
          {step === 'verify' && (
            <form onSubmit={handleVerify} className="space-y-6">
              
              <div className="text-center bg-rose-500/10 border border-rose-500/20 rounded-lg p-3">
                <p className="text-rose-400 text-sm font-semibold">
                  Note: OTP has been sent to {form.email}.
                </p>
                <p className="text-rose-400/80 text-xs mt-1">
                  If not visible in your inbox, please look at your junk or spam section.
                </p>
              </div>

              {/* 6-digit OTP input boxes */}
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
                    className="w-12 h-14 text-center text-xl font-bold rounded-lg border border-glass-border bg-black/40 text-white focus:border-accent-indigo focus:ring-2 focus:ring-accent-indigo/30 outline-none transition-all shadow-xl shadow-indigo-500/5"
                    autoFocus={i === 0}
                  />
                ))}
              </div>

              {/* Timer + Resend */}
              <div className="text-center text-sm">
                {countdown > 0 ? (
                  <p className="text-slate-400">
                    OTP expires in <span className="text-accent-indigo font-bold font-mono">{formatTime(countdown)}</span>
                  </p>
                ) : (
                  <p className="text-rose-400 font-bold">OTP expired</p>
                )}
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={loading}
                  className="text-accent-indigo hover:text-accent-cyan font-bold mt-2 transition-all disabled:opacity-50"
                >
                  Resend OTP
                </button>
              </div>

              <button type="submit" disabled={loading || otp.join('').length !== 6} className="btn-primary w-full">
                {loading ? 'Verifying…' : 'Verify Email'}
              </button>

              <button
                type="button"
                onClick={() => { setStep('register'); setError(''); setSuccess('') }}
                className="w-full text-sm text-slate-500 hover:text-slate-300 transition-colors"
              >
                ← Back to registration
              </button>
            </form>
          )}

          <p className="text-center text-sm text-slate-500">
            Already have an account?{' '}
            <Link to="/login" className="text-accent-indigo hover:text-accent-cyan font-bold transition-all">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
