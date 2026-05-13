import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'

const CATEGORIES = ['all', 'hackathon', 'contest', 'general']

// ── Compact List Card ──────────────────────────────────────────
function AnnouncementListCard({ post, currentUserId, onDelete, onClick }) {
  const targetDate = post.deadline || post.event_date
  const daysLeft = targetDate
    ? Math.ceil((new Date(targetDate) - new Date()) / (1000 * 60 * 60 * 24))
    : null
  const isExpired = daysLeft !== null && daysLeft < 0

  return (
    <div
      onClick={() => onClick(post)}
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
          {post.tags && post.tags.length > 0 && post.tags.slice(0, 2).map((tag, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-border-dim text-text-secondary text-xs font-bold">
              {tag}
            </span>
          ))}
        </div>

        {/* Perks / Prize */}
        {post.perks && (
          <div className="mb-4">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 text-[13px] font-bold border border-amber-100">
              🏆 {post.perks}
            </span>
          </div>
        )}

        {/* Bottom row */}
        <div className="flex items-center justify-between pt-4 border-t border-dashed border-border-dim">
          <div className="flex items-center gap-4 text-[13px] font-medium text-text-secondary">
            <span>Posted {new Date(post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
            {daysLeft !== null && (
              <span className={`font-bold ${isExpired ? 'text-danger' : 'text-emerald-500'}`}>
                {daysLeft > 0 ? `Ends in ${daysLeft}d` : daysLeft === 0 ? 'ENDS TODAY' : 'EXPIRED'}
              </span>
            )}
          </div>
          {post.author_id === currentUserId && (
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

// ── Detail Modal ────────────────────────────────────────────────
function AnnouncementDetail({ post, onClose, currentUserId, onDelete }) {
  if (!post) return null

  const targetDate = post.deadline || post.event_date
  const daysLeft = targetDate
    ? Math.ceil((new Date(targetDate) - new Date()) / (1000 * 60 * 60 * 24))
    : null
  const isExpired = daysLeft !== null && daysLeft < 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-white rounded-2xl overflow-hidden shadow-2xl border border-border-dim flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 w-10 h-10 flex items-center justify-center rounded-full bg-white/80 hover:bg-white text-text-secondary shadow-sm border border-border-dim transition-colors"
        >
          ✕
        </button>

        <div className="overflow-y-auto">
          {/* Banner */}
          {post.background_banner_url && (
            <div className="h-56 relative">
              <img
                src={post.background_banner_url}
                alt="banner"
                className="w-full h-full object-cover"
                onError={e => { e.target.parentElement.style.display = 'none' }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent" />
            </div>
          )}

          <div className="px-8 pb-10 -mt-10 relative z-10">
            {/* Header info */}
            <div className="flex justify-between items-end gap-6 mb-8">
              <div className="flex-1">
                <span className={`badge mb-3 ${
                  post.category === 'hackathon' ? 'badge-purple' : 'badge-blue'
                }`}>
                  {post.category}
                </span>
                <h1 className="text-3xl font-extrabold text-text-primary leading-tight">
                  {post.title}
                </h1>
                <p className="text-text-secondary font-bold uppercase tracking-wider text-sm mt-1">{post.organization}</p>
              </div>
              {post.banner_url && (
                <img
                  src={post.banner_url}
                  alt="logo"
                  className="w-24 h-24 object-cover rounded-2xl border-4 border-white shadow-card"
                  onError={e => { e.target.style.display = 'none' }}
                />
              )}
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="p-4 rounded-xl bg-gray-50 border border-border-dim">
                <p className="section-label mb-1">TEAM SIZE</p>
                <p className="text-lg font-bold text-text-primary">{post.team_size || 'Individual'}</p>
              </div>
              <div className="p-4 rounded-xl bg-gray-50 border border-border-dim">
                <p className="section-label mb-1">MODE</p>
                <p className="text-lg font-bold text-text-primary">{post.mode || 'Online'}</p>
              </div>
            </div>

            {/* Description */}
            <div className="prose prose-sm max-w-none mb-10">
              <h3 className="section-label mb-4">ABOUT THE OPPORTUNITY</h3>
              <p className="text-gray-600 text-[15px] leading-relaxed whitespace-pre-wrap">
                {post.description}
              </p>
            </div>

            {/* Timeline */}
            <div className="space-y-4 mb-10">
              <h3 className="section-label">TIMELINE</h3>
              <div className="flex flex-col gap-3">
                {post.event_date && (
                  <div className="flex items-center gap-4 p-4 rounded-xl border border-border-dim">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold">📅</div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-text-primary">Event Date</p>
                      <p className="text-xs text-text-secondary font-medium">{new Date(post.event_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                    </div>
                  </div>
                )}
                {post.deadline && (
                  <div className={`flex items-center gap-4 p-4 rounded-xl border ${isExpired ? 'bg-danger/5 border-danger/20' : 'bg-amber-50 border-amber-100'}`}>
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold ${isExpired ? 'bg-danger/10 text-danger' : 'bg-amber-100 text-amber-600'}`}>⏳</div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-text-primary">Registration Deadline</p>
                      <p className={`text-xs font-bold ${isExpired ? 'text-danger' : 'text-amber-700'}`}>
                        {new Date(post.deadline).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} — {daysLeft > 0 ? `${daysLeft} days left` : isExpired ? 'Expired' : 'Ends today'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer actions */}
            <div className="flex items-center gap-4">
              {post.link && (
                <a
                  href={post.link}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-primary flex-1 text-center py-4"
                >
                  Register Now ↗
                </a>
              )}
              {post.author_id === currentUserId && (
                <button
                  onClick={() => { onDelete(post.id); onClose() }}
                  className="px-6 py-4 rounded-lg bg-danger/5 text-danger font-bold hover:bg-danger/10 transition-colors"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
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

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Announcements() {
  const { user } = useAuth()
  const [posts, setPosts]         = useState([])
  const [cat, setCat]             = useState('all')
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [selected, setSelected]   = useState(null)

  const initialFormState = {
    title: '', category: 'hackathon', organization: '', description: '',
    participation_type: 'Individual Participation', mode: 'Online',
    tags: '', link: '', event_date: '', deadline: '',
    banner_url: '', background_banner_url: '', team_size: '', perks: ''
  }
  const [form, setForm] = useState(initialFormState)

  const fetchPosts = (category) => {
    setLoading(true)
    const params = category !== 'all' ? `?category=${category}` : ''
    api.get(`/announcements${params}`)
      .then(r => setPosts(r.data.announcements))
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

  return (
    <div className="space-y-10">
      {selected && (
        <AnnouncementDetail
          post={selected}
          onClose={() => setSelected(null)}
          currentUserId={user?.id}
          onDelete={handleDelete}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-bold text-text-primary">Announcements</h1>
          <p className="text-text-secondary text-[15px] mt-2 font-medium">Hackathons, contests & technical opportunities for you.</p>
        </div>
        <button onClick={() => setShowForm(p => !p)} className={`btn-primary self-start sm:self-auto ${showForm ? 'bg-danger hover:brightness-110' : ''}`}>
          {showForm ? '✕ Cancel' : '+ Post Opportunity'}
        </button>
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
                <label className="section-label block mb-2">Key Perk / Prize</label>
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
              onDelete={handleDelete}
              onClick={setSelected}
            />
          ))}
        </div>
      )}
    </div>
  )
}
