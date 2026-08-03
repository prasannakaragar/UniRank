import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'
import { resolveMediaUrl } from '../utils/media'

// ── Helpers ────────────────────────────────────────────────────────
const safeFormatDate = (dateStr) => {
  if (!dateStr) return 'TBA'
  const d = new Date(dateStr)
  return isNaN(d) ? dateStr : d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function computeDaysLeft(deadline, eventDate) {
  const target = deadline || eventDate
  if (!target) return null
  const d = new Date(target)
  if (isNaN(d)) return null
  return Math.ceil((d - new Date()) / (1000 * 60 * 60 * 24))
}

// ── Sub-components ─────────────────────────────────────────────────

/** Vertical timeline list for stages */
function StagesTimeline({ stages }) {
  if (!stages?.length) return null
  return (
    <div className="relative pl-6 space-y-0">
      {/* Vertical connector line */}
      <div
        className="absolute left-[11px] top-4 bottom-4 w-0.5 bg-border-dim"
        aria-hidden="true"
      />
      {stages.map((stage, i) => (
        <div key={i} className="relative pb-8 last:pb-0">
          {/* Dot */}
          <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
          </div>
          <div className="card p-5 ml-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-2">
              <p className="font-bold text-text-primary">{stage.title || `Stage ${i + 1}`}</p>
              {stage.date_range && (
                <span className="badge bg-gray-100 text-gray-600 text-[11px]">
                  📅 {stage.date_range}
                </span>
              )}
            </div>
            {stage.description && (
              <p className="text-[14px] text-text-secondary leading-relaxed">{stage.description}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

/** Accordion for FAQs using HTML details — no JS state */
function FaqAccordion({ faqs }) {
  if (!faqs?.length) return null
  return (
    <div className="space-y-3">
      {faqs.map((faq, i) => (
        <details
          key={i}
          className="card p-0 overflow-hidden group"
          style={{ cursor: 'pointer' }}
        >
          <summary className="flex items-center justify-between gap-4 px-5 py-4 font-bold text-text-primary list-none select-none hover:bg-gray-50 transition-colors">
            <span>{faq.question}</span>
            <span className="shrink-0 text-text-secondary transition-transform group-open:rotate-45 text-lg leading-none">+</span>
          </summary>
          <div className="px-5 pb-5 pt-1 text-[14px] text-text-secondary leading-relaxed border-t border-border-dim">
            {faq.answer}
          </div>
        </details>
      ))}
    </div>
  )
}

/** Tab content sections */
function TabContent({ tab, post }) {
  switch (tab) {
    case 'stages':
      return (
        <div>
          <h2 className="section-label mb-6">STAGES &amp; TIMELINE</h2>
          <StagesTimeline stages={post.stages} />
        </div>
      )

    case 'details':
      return (
        <div className="space-y-6">
          <h2 className="section-label">ABOUT THE OPPORTUNITY</h2>
          <p className="text-[15px] text-text-secondary leading-relaxed whitespace-pre-wrap">
            {post.description}
          </p>

          {post.eligibility && (
            <div>
              <h3 className="section-label mb-3">ELIGIBILITY</h3>
              <p className="text-[15px] text-text-secondary leading-relaxed">{post.eligibility}</p>
            </div>
          )}

          <div className="grid sm:grid-cols-3 gap-4">
            {post.team_size && (
              <div className="p-4 rounded-xl bg-gray-50 border border-border-dim">
                <p className="section-label mb-1">TEAM SIZE</p>
                <p className="font-bold text-text-primary">👥 {post.team_size}</p>
              </div>
            )}
            {post.mode && (
              <div className="p-4 rounded-xl bg-gray-50 border border-border-dim">
                <p className="section-label mb-1">MODE</p>
                <p className="font-bold text-text-primary">📍 {post.mode}</p>
              </div>
            )}
            {post.participation_type && (
              <div className="p-4 rounded-xl bg-gray-50 border border-border-dim">
                <p className="section-label mb-1">PARTICIPATION</p>
                <p className="font-bold text-text-primary">{post.participation_type}</p>
              </div>
            )}
          </div>

          {Array.isArray(post.tags) && post.tags.length > 0 && (
            <div>
              <h3 className="section-label mb-3">TAGS</h3>
              <div className="flex flex-wrap gap-2">
                {post.tags.map((tag, i) => (
                  <span key={i} className="badge border border-border-dim bg-white text-text-secondary">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )

    case 'dates':
      return (
        <div>
          <h2 className="section-label mb-6">DATES &amp; DEADLINES</h2>
          <div className="space-y-3">
            {post.registration_start_date && (
              <div className="flex items-center gap-4 p-4 rounded-xl border border-border-dim">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 font-bold">🟢</div>
                <div>
                  <p className="text-sm font-bold text-text-primary">Registration Opens</p>
                  <p className="text-xs text-text-secondary font-medium">{safeFormatDate(post.registration_start_date)}</p>
                </div>
              </div>
            )}
            {post.deadline && (
              <div className="flex items-center gap-4 p-4 rounded-xl bg-amber-50 border border-amber-100">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600 font-bold">⏳</div>
                <div>
                  <p className="text-sm font-bold text-text-primary">Registration Deadline</p>
                  <p className="text-xs font-bold text-amber-700">{safeFormatDate(post.deadline)}</p>
                </div>
              </div>
            )}
            {post.event_date && (
              <div className="flex items-center gap-4 p-4 rounded-xl border border-border-dim">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold">📅</div>
                <div>
                  <p className="text-sm font-bold text-text-primary">Event Date</p>
                  <p className="text-xs text-text-secondary font-medium">{safeFormatDate(post.event_date)}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )

    case 'prizes':
      return (
        <div className="space-y-6">
          <h2 className="section-label">PRIZES &amp; REWARDS</h2>
          {post.prize_pool && (
            <div className="p-6 rounded-2xl bg-amber-50 border border-amber-100 flex items-center gap-4">
              <div className="text-4xl">🏆</div>
              <div>
                <p className="section-label mb-1">PRIZE POOL</p>
                <p className="text-2xl font-extrabold text-amber-700">{post.prize_pool}</p>
              </div>
            </div>
          )}
          {post.perks && (
            <div>
              <h3 className="section-label mb-3">PERKS</h3>
              <p className="text-[15px] text-text-secondary leading-relaxed">{post.perks}</p>
            </div>
          )}
        </div>
      )

    case 'faqs':
      return (
        <div>
          <h2 className="section-label mb-6">FREQUENTLY ASKED QUESTIONS</h2>
          <FaqAccordion faqs={post.faqs} />
        </div>
      )

    default:
      return null
  }
}

// ── Main Page ──────────────────────────────────────────────────────
export default function AnnouncementDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [post, setPost] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState(null)
  const [registering, setRegistering] = useState(false)
  const [registered, setRegistered] = useState(false)
  const [registeredCount, setRegisteredCount] = useState(0)

  useEffect(() => {
    setLoading(true)
    api.get(`/announcements/${id}`)
      .then((r) => {
        const p = r.data?.announcement
        setPost(p)
        setRegisteredCount(p?.registered_count || 0)
        // Restore registered state if user already signed up (survives page refresh)
        if (p?.is_user_registered) setRegistered(true)
        // Default to first available tab
        const firstTab = getAvailableTabs(p)[0]?.key || 'details'
        setActiveTab(firstTab)
      })
      .catch(() => {
        setPost(null)
      })
      .finally(() => setLoading(false))
  }, [id])

  function getAvailableTabs(p) {
    if (!p) return []
    const tabs = []
    if (p.stages?.length > 0) tabs.push({ key: 'stages', label: 'Stages & Timeline' })
    tabs.push({ key: 'details', label: 'Details' })
    if (p.event_date || p.deadline || p.registration_start_date)
      tabs.push({ key: 'dates', label: 'Dates & Deadlines' })
    if (p.prize_pool || p.perks) tabs.push({ key: 'prizes', label: 'Prizes' })
    if (p.faqs?.length > 0) tabs.push({ key: 'faqs', label: 'FAQs' })
    return tabs
  }

  const handleRegister = async () => {
    if (registering || registered) return
    if (post?.link) {
      // Primary CTA: open external link
      window.open(post.link, '_blank', 'noreferrer')
    }
    // Also increment the internal counter
    if (id && !id.startsWith('dummy')) {
      setRegistering(true)
      try {
        const r = await api.post(`/announcements/${id}/register`)
        setRegisteredCount(r.data?.registered_count ?? registeredCount + 1)
        setRegistered(true)
      } catch (err) {
        // 409 = already registered — that's fine
        if (err?.response?.status === 409) setRegistered(true)
      } finally {
        setRegistering(false)
      }
    }
  }

  const handleDelete = async () => {
    if (!confirm('Delete this announcement?')) return
    await api.delete(`/announcements/${id}`)
    navigate('/announcements')
  }

  // ── Loading state ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex justify-center py-32">
        <div className="w-10 h-10 border-4 border-primary/10 border-t-primary rounded-full animate-spin" />
      </div>
    )
  }

  // ── Not found ────────────────────────────────────────────────────
  if (!post) {
    return (
      <div className="space-y-6">
        <button onClick={() => navigate('/announcements')} className="flex items-center gap-2 text-text-secondary hover:text-primary transition-colors font-medium text-sm">
          ← Back to Announcements
        </button>
        <div className="card text-center py-24 text-text-secondary font-medium">
          Announcement not found.
        </div>
      </div>
    )
  }

  const tabs = getAvailableTabs(post)
  const daysLeft = computeDaysLeft(post.deadline, post.event_date)
  const isExpired = daysLeft !== null && daysLeft < 0

  return (
    <div className="space-y-6 pb-16">
      {/* Breadcrumb */}
      <button
        onClick={() => navigate('/announcements')}
        className="flex items-center gap-2 text-text-secondary hover:text-primary transition-colors font-medium text-sm"
      >
        ← Back to Announcements
      </button>

      {/* ── Hero Section ───────────────────────────────────────── */}
      <div className="relative">
        {/* Background banner */}
        {post.background_banner_url ? (
          <div className="w-full h-56 sm:h-72 rounded-2xl overflow-hidden relative">
            <img
              src={resolveMediaUrl(post.background_banner_url)}
              alt="banner"
              className="w-full h-full object-cover"
              onError={(e) => { e.target.parentElement.style.background = 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          </div>
        ) : (
          /* Gradient fallback when no banner */
          <div
            className="w-full h-32 sm:h-44 rounded-2xl"
            style={{ background: 'linear-gradient(135deg,#6366f1 0%,#8b5cf6 50%,#a855f7 100%)' }}
          />
        )}

        {/* Logo overlapping banner bottom-left */}
        <div className="flex items-end gap-5 -mt-10 px-4 sm:px-6 relative z-10">
          {post.banner_url ? (
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border-4 border-white shadow-card overflow-hidden bg-white shrink-0">
              <img
                src={resolveMediaUrl(post.banner_url)}
                alt="logo"
                className="w-full h-full object-cover"
                onError={(e) => { e.target.style.display = 'none' }}
              />
            </div>
          ) : (
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border-4 border-white shadow-card bg-white shrink-0 flex items-center justify-center text-3xl">
              🏆
            </div>
          )}

          <div className="pb-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className={`badge ${post.category === 'hackathon' ? 'badge-purple' : post.category === 'contest' ? 'badge-blue' : 'bg-gray-100 text-gray-600'}`}>
                {post.category}
              </span>
              {post.mode && (
                <span className="badge bg-gray-100 text-gray-600">📍 {post.mode}</span>
              )}
            </div>
            <h1 className="text-xl sm:text-3xl font-extrabold text-text-primary leading-tight truncate">
              {post.title}
            </h1>
            {post.organization && (
              <p className="text-text-secondary font-bold text-sm uppercase tracking-wider mt-0.5">
                {post.organization}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Content: tabs + sidebar ────────────────────────────── */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">

        {/* ── Tab area ────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Tab bar */}
          <div className="flex overflow-x-auto gap-1 bg-gray-100 p-1 rounded-xl">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`px-4 py-2 rounded-lg text-[13px] font-bold whitespace-nowrap transition-all ${
                  activeTab === t.key
                    ? 'bg-white text-primary shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="card p-6 sm:p-8">
            <TabContent tab={activeTab} post={post} />
          </div>
        </div>

        {/* ── Sticky Sidebar ──────────────────────────────────── */}
        <div className="w-full lg:w-72 lg:sticky lg:top-6 space-y-4">
          <div className="card p-6 space-y-5">
            {/* Days left badge */}
            {daysLeft !== null && (
              <div className={`text-center py-3 px-4 rounded-xl font-bold text-sm ${
                isExpired
                  ? 'bg-red-50 text-red-600 border border-red-100'
                  : daysLeft <= 3
                  ? 'bg-amber-50 text-amber-700 border border-amber-100'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
              }`}>
                {isExpired
                  ? '⛔ Registration Closed'
                  : daysLeft === 0
                  ? '🔥 Last Day to Register!'
                  : `⏱ ${daysLeft} day${daysLeft === 1 ? '' : 's'} left`}
              </div>
            )}

            {/* Organizer */}
            {post.organization && (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-extrabold text-sm shrink-0">
                  {post.organization.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="section-label">ORGANIZER</p>
                  <p className="font-bold text-text-primary text-sm truncate">{post.organization}</p>
                </div>
              </div>
            )}

            {/* Registered count */}
            <div className="flex items-center justify-between py-3 border-t border-b border-border-dim">
              <span className="text-text-secondary text-sm font-medium">👥 Registered</span>
              <span className="font-extrabold text-text-primary">{registeredCount.toLocaleString()}</span>
            </div>

            {/* Deadline */}
            {post.deadline && (
              <div className="text-sm">
                <p className="section-label mb-1">DEADLINE</p>
                <p className="font-bold text-text-primary">{safeFormatDate(post.deadline)}</p>
              </div>
            )}

            {/* Register CTA */}
            <button
              onClick={handleRegister}
              disabled={registering || isExpired}
              className={`btn-primary w-full py-3.5 text-center transition-all ${
                registered ? 'opacity-80' : ''
              } ${isExpired ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              {registering
                ? 'Processing…'
                : registered
                ? '✓ Registered!'
                : isExpired
                ? 'Registration Closed'
                : post.link
                ? 'Register Now ↗'
                : 'Register Now'}
            </button>

            {/* Admin delete */}
            {user?.role === 'admin' && (
              <button
                onClick={handleDelete}
                className="w-full px-4 py-2.5 rounded-lg bg-red-50 text-red-600 font-bold text-sm hover:bg-red-100 transition-colors border border-red-100"
              >
                Delete Announcement
              </button>
            )}
          </div>

          {/* Quick info card */}
          {(post.team_size || post.participation_type) && (
            <div className="card p-5 space-y-3">
              <h3 className="section-label">QUICK INFO</h3>
              {post.team_size && (
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary font-medium">Team Size</span>
                  <span className="font-bold text-text-primary">{post.team_size}</span>
                </div>
              )}
              {post.participation_type && (
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary font-medium">Type</span>
                  <span className="font-bold text-text-primary">{post.participation_type}</span>
                </div>
              )}
              {post.prize_pool && (
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary font-medium">Prize Pool</span>
                  <span className="font-bold text-amber-600">{post.prize_pool}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
