import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'

const CATEGORIES = ['all', 'hackathon', 'contest', 'general']

function AnnouncementCard({ post, currentUserId, onDelete }) {
  const targetDate = post.event_date || post.deadline;
  const daysLeft = targetDate ? Math.ceil((new Date(targetDate) - new Date()) / (1000 * 60 * 60 * 24)) : null;
  const isExpired = daysLeft !== null && daysLeft < 0;

  return (
    <div className="glass-card hover:border-accent-indigo/40 transition-all duration-300 relative overflow-hidden flex flex-col justify-between h-full">
      <div>
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0 pr-4">
            <h3 className="font-display font-bold text-accent-indigo text-lg sm:text-xl truncate mb-1">
              {post.title}
            </h3>
            {post.organization && (
              <p className="text-sm text-slate-300 font-medium mb-3">{post.organization}</p>
            )}
          </div>
          {post.author_id === currentUserId && (
            <button onClick={() => onDelete(post.id)}
              className="text-slate-500 hover:text-red-400 transition-colors bg-dark-700 p-1.5 rounded-md flex-shrink-0">
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center gap-4 text-xs font-medium text-slate-400 mb-4 flex-wrap">
          {post.participation_type && (
            <div className="flex items-center gap-1.5">
              <span>👥</span> {post.participation_type}
            </div>
          )}
          {post.mode && (
            <div className="flex items-center gap-1.5">
              <span>📍</span> {post.mode}
            </div>
          )}
        </div>

        <p className="text-sm text-slate-300 leading-relaxed mb-4 whitespace-pre-wrap">
          {post.description}
        </p>

        {post.tags && post.tags.length > 0 && (
          <div className="flex gap-2 flex-wrap mb-6">
            {post.tags.map((tag, i) => (
              <span key={i} className="px-3 py-1 bg-white/5 text-slate-300 rounded-full text-[10px] font-medium border border-glass-border">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-slate-400 pt-4 border-t border-dark-700 mt-auto">
        <div className="flex items-center gap-4 flex-wrap">
          <span>Posted {new Date(post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric'})}</span>
          {daysLeft !== null && (
            <span className={`flex items-center gap-1 font-semibold font-mono ${isExpired ? 'text-rose-400' : 'text-accent-cyan'}`}>
              ⏳ {daysLeft > 0 ? `${daysLeft} days left` : daysLeft === 0 ? 'Ends today' : 'Expired'}
            </span>
          )}
          <span className="capitalize px-2 py-0.5 rounded bg-white/5 border border-glass-border">{post.category}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-4">
           {post.link && (
            <a href={post.link} target="_blank" rel="noreferrer" className="text-accent-indigo hover:brightness-110 font-bold transition-all flex items-center gap-1 font-display">
              Apply <span className="text-[10px]">↗</span>
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Announcements() {
  const { user } = useAuth()
  const [posts, setPosts]     = useState([])
  const [cat, setCat]         = useState('all')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const initialFormState = { 
    title: '', category: 'general', organization: '', description: '', 
    participation_type: 'Individual Participation', mode: 'Online', 
    tags: '', link: '', event_date: '', deadline: '' 
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-3xl text-white">Announcements</h1>
          <p className="text-slate-400 text-sm mt-1">Hackathons, contests & opportunities</p>
        </div>
        <button onClick={() => setShowForm(p => !p)} className="btn-primary self-start sm:self-auto">
          {showForm ? '✕ Cancel' : '+ Post Opportunity'}
        </button>
      </div>

      {/* Post form */}
      {showForm && (
        <div className="card border-accent-indigo/30 bg-accent-indigo/5">
          <h2 className="font-display font-semibold text-white mb-4">New Announcement</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Title *</label>
                <input className="input" placeholder="e.g. HackMIT 2025" value={form.title}
                  onChange={e => setForm(p => ({ ...p, title: e.target.value }))} required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Organization</label>
                <input className="input" placeholder="e.g. AI Academia" value={form.organization}
                  onChange={e => setForm(p => ({ ...p, organization: e.target.value }))} />
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Category</label>
                <select className="input" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                  <option value="hackathon">Hackathon</option>
                  <option value="contest">Coding Contest</option>
                  <option value="general">General</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Participation Type</label>
                <select className="input" value={form.participation_type} onChange={e => setForm(p => ({ ...p, participation_type: e.target.value }))}>
                  <option value="Individual Participation">Individual</option>
                  <option value="Team Participation">Team</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Mode</label>
                <select className="input" value={form.mode} onChange={e => setForm(p => ({ ...p, mode: e.target.value }))}>
                  <option value="Online">Online</option>
                  <option value="Offline">Offline</option>
                  <option value="Hybrid">Hybrid</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Tags</label>
              <input className="input" placeholder="e.g. Strategy & Planning, Engineering Students, Undergraduate" value={form.tags}
                onChange={e => setForm(p => ({ ...p, tags: e.target.value }))} />
              <p className="text-[10px] text-slate-500 mt-1">Separate tags with commas</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Description *</label>
              <textarea className="input resize-none" rows={4} placeholder="Describe the event…"
                value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} required />
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Registration Link</label>
                <input className="input" type="url" placeholder="https://…" value={form.link}
                  onChange={e => setForm(p => ({ ...p, link: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Event Date</label>
                <input className="input" type="date" value={form.event_date}
                  onChange={e => setForm(p => ({ ...p, event_date: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Registration Deadline</label>
                <input className="input" type="date" value={form.deadline}
                  onChange={e => setForm(p => ({ ...p, deadline: e.target.value }))} />
              </div>
            </div>

            <div className="pt-2">
              <button type="submit" disabled={submitting} className="btn-primary w-full sm:w-auto">
                {submitting ? 'Posting…' : 'Post Announcement'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Category filter */}
      <div className="flex gap-1 bg-white/5 backdrop-blur-md border border-glass-border rounded-lg p-1 w-fit">
        {CATEGORIES.map(c => (
          <button key={c} onClick={() => setCat(c)}
            className={`px-4 py-1.5 rounded-md text-xs font-display font-semibold capitalize transition-all ${
              cat === c ? 'bg-accent-indigo text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-white'
            }`}>
            {c}
          </button>
        ))}
      </div>

      {/* Posts */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-accent-indigo border-t-transparent rounded-full animate-spin" />
        </div>
      ) : posts.length === 0 ? (
        <div className="card text-center py-16 text-slate-500">
          No announcements yet. Be the first to post!
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {posts.map(p => (
            <AnnouncementCard key={p.id} post={p} currentUserId={user?.id} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  )
}
