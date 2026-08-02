import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'

const CATEGORIES = ['all', 'hackathon', 'contest', 'general']

// ── Compact List Card ──────────────────────────────────────────
function AnnouncementListCard({ post, currentUserId, userRole, onDelete }) {
  const navigate = useNavigate()
  const targetDate = post.deadline || post.event_date
  const targetDateObj = targetDate ? new Date(targetDate) : null
  const isValidDate = targetDateObj && !isNaN(targetDateObj)
  const daysLeft = isValidDate
    ? Math.ceil((targetDateObj - new Date()) / (1000 * 60 * 60 * 24))
    : null
  const isExpired = daysLeft !== null && daysLeft < 0

  const createdDate = new Date(post.created_at)
  const safeCreated = isNaN(createdDate) ? 'Unknown Date' : createdDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  return (
    <div
      onClick={() => navigate(`/announcements/${post.id}`)}
      className="card hover:shadow-lg transition-all duration-300 cursor-pointer group relative overflow-hidden flex flex-col md:flex-row gap-6"
    >
      <div className="flex-1 min-w-0">
        {/* Top row */}
        <div className="flex items-center gap-3 mb-2">
          <span className={`badge ${
            post.category === 'hackathon' ? 'badge-purple' :
            post.category === 'contest' ? 'badge-blue' :
            'bg-gray-100 text-gray-600'
          }`}>
            {post.category}
          </span>
          {post.organization && (
            <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">{post.organization}</span>
          )}
        </div>

        <h3 className="text-xl font-bold text-text-primary group-hover:text-primary transition-colors truncate mb-3">
          {post.title}
        </h3>

        {/* Meta badges */}
        <div className="flex flex-wrap gap-2 mb-4">
          {post.team_size && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-bold">
              👥 {post.team_size}
            </span>
          )}
          {post.mode && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-bold">
              📍 {post.mode}
            </span>
          )}
          {Array.isArray(post.tags) && post.tags.length > 0 && post.tags.slice(0, 2).map((tag, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-border-dim text-text-secondary text-xs font-bold">
              {tag}
            </span>
          ))}
        </div>

        {/* Perks / Prize */}
        {(post.prize_pool || post.perks) && (
          <div className="mb-4">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 text-[13px] font-bold border border-amber-100">
              🏆 {post.prize_pool || post.perks}
            </span>
          </div>
        )}

        {/* Bottom row */}
        <div className="flex items-center justify-between pt-4 border-t border-dashed border-border-dim">
          <div className="flex items-center gap-4 text-[13px] font-medium text-text-secondary">
            <span>Posted {safeCreated}</span>
            {daysLeft !== null && (
              <span className={`font-bold ${isExpired ? 'text-danger' : 'text-emerald-500'}`}>
                {daysLeft > 0 ? `Ends in ${daysLeft}d` : daysLeft === 0 ? 'ENDS TODAY' : 'EXPIRED'}
              </span>
            )}
            {post.registered_count > 0 && (
              <span className="text-text-secondary">
                👥 {post.registered_count.toLocaleString()} registered
              </span>
            )}
          </div>
          {userRole === 'admin' && (
            <button
              onClick={e => { e.stopPropagation(); onDelete(post.id) }}
              className="text-text-secondary hover:text-danger transition-colors p-1.5 hover:bg-danger/5 rounded-md"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Right side thumbnail */}
      {post.banner_url && (
        <div className="w-full md:w-[140px] h-[140px] shrink-0 relative">
          <img
            src={post.banner_url}
            alt="logo"
            className="w-full h-full object-cover rounded-xl border border-border-dim"
            onError={e => { e.target.style.display = 'none' }}
          />
          <div className="absolute top-2 right-2 bg-white/90 backdrop-blur px-2 py-0.5 rounded text-[10px] font-bold text-primary uppercase border border-border-dim shadow-sm">
            {post.category}
          </div>
        </div>
      )}
    </div>
  )
}

// ── File Upload Input ──────────────────────────────────────────────
function FileUploadInput({ label, value, onChange, placeholder, previewClass }) {
  const [uploading, setUploading] = useState(false)

  const handleFileChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await api.post('/upload/image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      onChange(res.data.url)
    } catch (err) {
      alert(err.response?.data?.error || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <label className="section-label block mb-2">{label}</label>
      <div className="space-y-3">
        <input 
          type="file" 
          accept="image/*"
          className="hidden" 
          id={`file-${label.replace(/\s+/g, '-').toLowerCase()}`}
          onChange={handleFileChange}
        />
        <label 
          htmlFor={`file-${label.replace(/\s+/g, '-').toLowerCase()}`}
          className="input flex items-center justify-between cursor-pointer group"
        >
          <span className="text-text-secondary truncate pr-4 text-sm">
            {uploading ? 'Uploading...' : value ? 'Image Selected (Click to change)' : placeholder}
          </span>
          <span className="text-primary font-bold shrink-0 text-sm">Browse</span>
        </label>
        
        {value && !uploading && (
          <div className="relative group w-fit">
            <img 
              src={value} 
              alt="preview" 
              className={`${previewClass} rounded-lg object-cover border border-border-dim`}
              onError={e => { e.target.style.display = 'none' }} 
            />
            <button 
              type="button"
              onClick={() => onChange('')}
              className="absolute -top-2 -right-2 w-6 h-6 bg-gray-900 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
            >
              ✕
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Stage / FAQ builder helpers ────────────────────────────────────
function StageRow({ stage, index, onChange, onRemove }) {
  return (
    <div className="p-4 rounded-xl border border-border-dim space-y-3 bg-gray-50">
      <div className="flex items-center justify-between">
        <span className="section-label">Stage {index + 1}</span>
        <button type="button" onClick={onRemove} className="text-text-secondary hover:text-danger text-xs font-bold transition-colors">Remove</button>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <input
          className="input"
          placeholder="Stage title (e.g. Registration)"
          value={stage.title}
          onChange={e => onChange({ ...stage, title: e.target.value })}
        />
        <input
          className="input"
          placeholder="Date range (e.g. Jan 1 – Jan 15)"
          value={stage.date_range}
          onChange={e => onChange({ ...stage, date_range: e.target.value })}
        />
      </div>
      <input
        className="input"
        placeholder="Short description (optional)"
        value={stage.description}
        onChange={e => onChange({ ...stage, description: e.target.value })}
      />
    </div>
  )
}

function FaqRow({ faq, index, onChange, onRemove }) {
  return (
    <div className="p-4 rounded-xl border border-border-dim space-y-3 bg-gray-50">
      <div className="flex items-center justify-between">
        <span className="section-label">FAQ {index + 1}</span>
        <button type="button" onClick={onRemove} className="text-text-secondary hover:text-danger text-xs font-bold transition-colors">Remove</button>
      </div>
      <input
        className="input"
        placeholder="Question"
        value={faq.question}
        onChange={e => onChange({ ...faq, question: e.target.value })}
      />
      <textarea
        className="input resize-none"
        rows={2}
        placeholder="Answer"
        value={faq.answer}
        onChange={e => onChange({ ...faq, answer: e.target.value })}
      />
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Announcements() {
  const { user } = useAuth()
  const [posts, setPosts]         = useState([])
  const [cat, setCat]             = useState('all')
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showExtras, setShowExtras] = useState(false)

  const initialFormState = {
    title: '', category: 'hackathon', organization: '', description: '',
    participation_type: 'Individual Participation', mode: 'Online',
    tags: '', link: '', event_date: '', deadline: '',
    banner_url: '', background_banner_url: '', team_size: '', perks: '',
    // New fields
    registration_start_date: '', prize_pool: '', eligibility: '',
    stages: [], faqs: [],
  }
  const [form, setForm] = useState(initialFormState)

  const fetchPosts = (category) => {
    setLoading(true)
    const params = category !== 'all' ? `?category=${category}` : ''
    api.get(`/announcements${params}`)
      .then(r => {
        let fetched = r.data?.announcements
        if (!Array.isArray(fetched) || fetched.length === 0) {
          fetched = [
            {
              id: 'dummy-1',
              title: 'Global AI Hackathon 2025',
              category: 'hackathon',
              organization: 'Tech Innovators',
              description: 'Join the biggest AI hackathon of the year and build the future.',
              mode: 'Online',
              team_size: '2-4 Members',
              tags: ['AI', 'Web3', 'React'],
              perks: '₹1 Lakh Prize Pool',
              prize_pool: '₹1,00,000',
              created_at: new Date().toISOString(),
              deadline: new Date(Date.now() + 86400000 * 10).toISOString(),
              registered_count: 248,
            },
            {
              id: 'dummy-2',
              title: 'CodeSprint Weekly Challenge',
              category: 'contest',
              organization: 'CodeForces',
              description: 'Test your algorithmic skills in this fast-paced 2-hour contest.',
              mode: 'Online',
              team_size: 'Individual',
              tags: ['DSA', 'Algorithms'],
              perks: 'Top 10 get interviews',
              created_at: new Date(Date.now() - 86400000).toISOString(),
              event_date: new Date(Date.now() + 86400000 * 3).toISOString(),
              registered_count: 94,
            }
          ]
        }
        if (category !== 'all') {
          fetched = fetched.filter(p => p.category === category)
        }
        setPosts(fetched)
      })
      .catch(err => {
        console.error("Failed to fetch announcements:", err)
        setPosts([])
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchPosts(cat) }, [cat])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await api.post('/announcements', form)
      setForm(initialFormState)
      setShowForm(false)
      setShowExtras(false)
      fetchPosts(cat)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this announcement?')) return
    await api.delete(`/announcements/${id}`)
    setPosts(p => p.filter(x => x.id !== id))
  }

  // Stage helpers
  const addStage = () => setForm(f => ({ ...f, stages: [...f.stages, { title: '', date_range: '', description: '' }] }))
  const updateStage = (i, val) => setForm(f => ({ ...f, stages: f.stages.map((s, idx) => idx === i ? val : s) }))
  const removeStage = (i) => setForm(f => ({ ...f, stages: f.stages.filter((_, idx) => idx !== i) }))

  // FAQ helpers
  const addFaq = () => setForm(f => ({ ...f, faqs: [...f.faqs, { question: '', answer: '' }] }))
  const updateFaq = (i, val) => setForm(f => ({ ...f, faqs: f.faqs.map((q, idx) => idx === i ? val : q) }))
  const removeFaq = (i) => setForm(f => ({ ...f, faqs: f.faqs.filter((_, idx) => idx !== i) }))

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-bold text-text-primary">Announcements</h1>
          <p className="text-text-secondary text-[15px] mt-2 font-medium">Hackathons, contests &amp; technical opportunities for you.</p>
        </div>
        {user?.role === 'admin' && (
          <button onClick={() => setShowForm(p => !p)} className={`btn-primary self-start sm:self-auto ${showForm ? 'bg-danger hover:brightness-110' : ''}`}>
            {showForm ? '✕ Cancel' : '+ Post Opportunity'}
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div className="card border-border-dim bg-accent-pill/40 p-8 animate-in fade-in slide-in-from-top-4 duration-300">
          <h2 className="text-2xl font-bold text-text-primary mb-8">New Announcement</h2>
          <form onSubmit={handleSubmit} className="space-y-8">

            <div className="grid sm:grid-cols-2 gap-6">
              <div>
                <label className="section-label block mb-2">Title *</label>
                <input className="input" placeholder="e.g. InnovaHack Chapter 1" value={form.title}
                  onChange={e => setForm(p => ({ ...p, title: e.target.value }))} required />
              </div>
              <div>
                <label className="section-label block mb-2">Organization</label>
                <input className="input" placeholder="e.g. Elite Forums" value={form.organization}
                  onChange={e => setForm(p => ({ ...p, organization: e.target.value }))} />
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-6">
              <div>
                <label className="section-label block mb-2">Category</label>
                <select className="input" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                  <option value="hackathon">Hackathon</option>
                  <option value="contest">Coding Contest</option>
                  <option value="general">General</option>
                </select>
              </div>
              <div>
                <label className="section-label block mb-2">Participation Type</label>
                <select className="input" value={form.participation_type} onChange={e => setForm(p => ({ ...p, participation_type: e.target.value }))}>
                  <option value="Individual Participation">Individual</option>
                  <option value="Team Participation">Team</option>
                </select>
              </div>
              <div>
                <label className="section-label block mb-2">Mode</label>
                <select className="input" value={form.mode} onChange={e => setForm(p => ({ ...p, mode: e.target.value }))}>
                  <option value="Online">Online</option>
                  <option value="Offline">Offline</option>
                  <option value="Hybrid">Hybrid</option>
                </select>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-6">
              <div>
                <label className="section-label block mb-2">Team Size</label>
                <input className="input" placeholder="e.g. 2 - 4 Members" value={form.team_size}
                  onChange={e => setForm(p => ({ ...p, team_size: e.target.value }))} />
              </div>
              <div>
                <label className="section-label block mb-2">Key Perk / Prize Badge</label>
                <input className="input" placeholder="e.g. Internships & ₹50k Prize" value={form.perks}
                  onChange={e => setForm(p => ({ ...p, perks: e.target.value }))} />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-6">
              <FileUploadInput 
                label="Logo Thumbnail" 
                value={form.banner_url}
                onChange={url => setForm(p => ({ ...p, banner_url: url }))}
                placeholder="Upload square logo"
                previewClass="h-20 w-20"
              />
              <FileUploadInput 
                label="Header Banner" 
                value={form.background_banner_url}
                onChange={url => setForm(p => ({ ...p, background_banner_url: url }))}
                placeholder="Upload wide banner"
                previewClass="h-20 w-full"
              />
            </div>

            <div>
              <label className="section-label block mb-2">Description *</label>
              <textarea className="input resize-none" rows={5} placeholder="What is this event about?"
                value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} required />
            </div>

            <div className="grid sm:grid-cols-3 gap-6">
              <div>
                <label className="section-label block mb-2">Registration Link</label>
                <input className="input" type="url" placeholder="https://…" value={form.link}
                  onChange={e => setForm(p => ({ ...p, link: e.target.value }))} />
              </div>
              <div>
                <label className="section-label block mb-2">Event Date</label>
                <input className="input" type="date" value={form.event_date}
                  onChange={e => setForm(p => ({ ...p, event_date: e.target.value }))} />
              </div>
              <div>
                <label className="section-label block mb-2">Deadline</label>
                <input className="input" type="date" value={form.deadline}
                  onChange={e => setForm(p => ({ ...p, deadline: e.target.value }))} />
              </div>
            </div>

            {/* ── Collapsible extras section ─────────────────────── */}
            <div className="border border-border-dim rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowExtras(p => !p)}
                className="w-full flex items-center justify-between px-5 py-4 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
              >
                <span className="font-bold text-text-primary text-sm">
                  ✨ Timeline, Prizes &amp; FAQs
                  <span className="ml-2 font-normal text-text-secondary">(optional — for Unstop-style detail page)</span>
                </span>
                <span className={`text-text-secondary transition-transform duration-200 ${showExtras ? 'rotate-180' : ''}`}>▼</span>
              </button>

              {showExtras && (
                <div className="p-6 space-y-8">
                  {/* Prize + Eligibility + Reg start */}
                  <div className="grid sm:grid-cols-3 gap-6">
                    <div>
                      <label className="section-label block mb-2">Registration Opens</label>
                      <input className="input" type="date" value={form.registration_start_date}
                        onChange={e => setForm(p => ({ ...p, registration_start_date: e.target.value }))} />
                    </div>
                    <div>
                      <label className="section-label block mb-2">Prize Pool</label>
                      <input className="input" placeholder="e.g. ₹50,000 + Internships" value={form.prize_pool}
                        onChange={e => setForm(p => ({ ...p, prize_pool: e.target.value }))} />
                    </div>
                    <div>
                      <label className="section-label block mb-2">Eligibility</label>
                      <input className="input" placeholder="e.g. Open to all students" value={form.eligibility}
                        onChange={e => setForm(p => ({ ...p, eligibility: e.target.value }))} />
                    </div>
                  </div>

                  {/* Stages builder */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <label className="section-label">Stages &amp; Timeline</label>
                      <button
                        type="button"
                        onClick={addStage}
                        className="text-primary font-bold text-sm hover:underline"
                      >
                        + Add Stage
                      </button>
                    </div>
                    {form.stages.length === 0 ? (
                      <p className="text-text-secondary text-sm italic">No stages added. Click "+ Add Stage" to build a timeline.</p>
                    ) : (
                      <div className="space-y-3">
                        {form.stages.map((s, i) => (
                          <StageRow
                            key={i}
                            stage={s}
                            index={i}
                            onChange={val => updateStage(i, val)}
                            onRemove={() => removeStage(i)}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* FAQ builder */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <label className="section-label">FAQs</label>
                      <button
                        type="button"
                        onClick={addFaq}
                        className="text-primary font-bold text-sm hover:underline"
                      >
                        + Add FAQ
                      </button>
                    </div>
                    {form.faqs.length === 0 ? (
                      <p className="text-text-secondary text-sm italic">No FAQs added. Click "+ Add FAQ" to add questions.</p>
                    ) : (
                      <div className="space-y-3">
                        {form.faqs.map((f, i) => (
                          <FaqRow
                            key={i}
                            faq={f}
                            index={i}
                            onChange={val => updateFaq(i, val)}
                            onRemove={() => removeFaq(i)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-border-dim">
              <button type="submit" disabled={submitting} className="btn-primary px-10 py-4">
                {submitting ? 'Posting Opportunity…' : 'Publish Announcement'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map(c => (
          <button key={c} onClick={() => setCat(c)}
            className={`px-6 py-2.5 rounded-full text-[13px] font-bold capitalize transition-all border ${
              cat === c 
                ? 'bg-primary text-white border-primary shadow-md' 
                : 'bg-white text-text-secondary border-border-dim hover:border-gray-300'
            }`}>
            {c}
          </button>
        ))}
      </div>

      {/* Cards list */}
      {loading ? (
        <div className="flex justify-center py-24">
          <div className="w-10 h-10 border-4 border-primary/10 border-t-primary rounded-full animate-spin" />
        </div>
      ) : posts.length === 0 ? (
        <div className="card text-center py-24 text-text-secondary font-medium italic">
          No announcements found. Try a different category!
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {posts.map(p => (
            <AnnouncementListCard
              key={p.id}
              post={p}
              currentUserId={user?.id}
              userRole={user?.role}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}
