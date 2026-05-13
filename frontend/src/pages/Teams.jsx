import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'

const SKILLS = ['DSA', 'Web Dev', 'App Dev', 'AI/ML', 'Blockchain', 'Cybersec', 'UI/UX', 'DevOps', 'Data Science']

function TeamCard({ post, currentUserId, onDelete, onClose }) {
  const isLooking = post.post_type === 'looking'
  return (
    <div className={`card hover:shadow-md transition-all duration-200 border-l-4 ${
      isLooking ? 'border-l-primary' : 'border-l-secondary'
    }`}>
      <div className="flex items-start justify-between gap-2 mb-4">
        <span className={`badge font-bold ${
          isLooking
            ? 'bg-accent-pill text-primary border border-primary/10'
            : 'bg-amber-50 text-secondary border border-secondary/10'
        }`}>
          {isLooking ? '🔍 Looking for Team' : '📢 Recruiting Members'}
        </span>
        {post.author_id === currentUserId && (
          <div className="flex gap-3 shrink-0">
            {post.is_active && (
              <button onClick={() => onClose(post.id)}
                className="text-xs font-bold text-text-secondary hover:text-primary transition-colors">
                Mark Closed
              </button>
            )}
            <button onClick={() => onDelete(post.id)}
              className="text-text-secondary hover:text-danger transition-colors font-bold text-sm">✕</button>
          </div>
        )}
      </div>

      <h3 className="font-bold text-text-primary text-[16px] mb-2 leading-snug">{post.title}</h3>
      {post.description && (
        <p className="text-sm text-text-secondary mb-4 leading-relaxed">{post.description}</p>
      )}

      {post.skills_needed?.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {post.skills_needed.map(s => (
            <span key={s} className="badge bg-page text-text-secondary font-bold text-[11px]">{s}</span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-dashed border-border-dim">
        <div>
          <p className="text-sm font-bold text-text-primary">{post.author}</p>
          <p className="text-xs text-text-secondary font-bold uppercase tracking-wider mt-0.5">{post.author_branch} · Year {post.author_year}</p>
        </div>
        <div className="text-right">
          {post.team_size && (
            <p className="text-xs font-bold text-text-secondary uppercase tracking-wider">Team of {post.team_size}</p>
          )}
          {post.contact_info && (
            <p className="text-xs text-primary font-bold mt-1">{post.contact_info}</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Teams() {
  const { user } = useAuth()
  const [posts, setPosts]     = useState([])
  const [filter, setFilter]   = useState('all')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    post_type: 'looking', title: '', description: '',
    skills_needed: [], contact_info: '', team_size: ''
  })
  const [submitting, setSubmitting] = useState(false)

  const fetchPosts = (type) => {
    setLoading(true)
    const params = type !== 'all' ? `?type=${type}` : ''
    api.get(`/teams${params}`)
      .then(r => setPosts(r.data.teams))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchPosts(filter) }, [filter])

  const toggleSkill = (skill) => {
    setForm(p => ({
      ...p,
      skills_needed: p.skills_needed.includes(skill)
        ? p.skills_needed.filter(s => s !== skill)
        : [...p.skills_needed, skill]
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const payload = { ...form, team_size: form.team_size ? parseInt(form.team_size) : null }
      await api.post('/teams', payload)
      setForm({ post_type: 'looking', title: '', description: '', skills_needed: [], contact_info: '', team_size: '' })
      setShowForm(false)
      fetchPosts(filter)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Remove this post?')) return
    await api.delete(`/teams/${id}`)
    setPosts(p => p.filter(x => x.id !== id))
  }

  const handleClose = async (id) => {
    await api.patch(`/teams/${id}/close`)
    fetchPosts(filter)
  }

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-bold text-text-primary">Team Board</h1>
          <p className="text-text-secondary text-[15px] mt-2 font-medium">Find teammates or recruit for your next hackathon.</p>
        </div>
        <button onClick={() => setShowForm(p => !p)} className="btn-primary self-start sm:self-auto">
          {showForm ? '✕ Cancel' : '+ Create Post'}
        </button>
      </div>

      {/* Post form */}
      {showForm && (
        <div className="card p-8 border-primary/20 bg-primary/5 animate-in slide-in-from-top-4 duration-300">
          <h2 className="text-xl font-bold text-text-primary mb-8">Create Team Post</h2>
          <form onSubmit={handleSubmit} className="space-y-8">
            <div>
              <label className="section-label block mb-3">Post Type</label>
              <div className="flex gap-3">
                {[
                  { v: 'looking',    label: '🔍 Looking for Team' },
                  { v: 'recruiting', label: '📢 Recruiting Members' },
                ].map(({ v, label }) => (
                  <button key={v} type="button"
                    onClick={() => setForm(p => ({ ...p, post_type: v }))}
                    className={`flex-1 py-3 rounded-xl text-sm font-bold border transition-all ${
                      form.post_type === v
                        ? 'bg-primary text-white border-primary shadow-md'
                        : 'bg-white text-text-secondary border-border-dim hover:border-primary/30'
                    }`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="section-label block mb-2">Title *</label>
              <input className="input"
                placeholder={form.post_type === 'looking' ? 'Looking for team for Smart India Hackathon' : 'Need ML developer for HackMIT'}
                value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} required />
            </div>

            <div>
              <label className="section-label block mb-2">Description</label>
              <textarea className="input resize-none" rows={3}
                placeholder="Tell others more about what you're working on…"
                value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
            </div>

            <div>
              <label className="section-label block mb-3">Skills Required</label>
              <div className="flex flex-wrap gap-2">
                {SKILLS.map(s => (
                  <button key={s} type="button" onClick={() => toggleSkill(s)}
                    className={`px-4 py-2 rounded-full text-xs font-bold border transition-all ${
                      form.skills_needed.includes(s)
                        ? 'bg-primary text-white border-primary shadow-sm'
                        : 'bg-white text-text-secondary border-border-dim hover:border-primary/40'
                    }`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-6">
              <div>
                <label className="section-label block mb-2">Contact (email / Discord / phone)</label>
                <input className="input" placeholder="your@email.com or @discord"
                  value={form.contact_info} onChange={e => setForm(p => ({ ...p, contact_info: e.target.value }))} />
              </div>
              {form.post_type === 'recruiting' && (
                <div>
                  <label className="section-label block mb-2">Team Size (total)</label>
                  <input className="input" type="number" min={2} max={10} placeholder="4"
                    value={form.team_size} onChange={e => setForm(p => ({ ...p, team_size: e.target.value }))} />
                </div>
              )}
            </div>

            <button type="submit" disabled={submitting} className="btn-primary px-10 py-3">
              {submitting ? 'Posting…' : 'Publish Post'}
            </button>
          </form>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2">
        {[
          { v: 'all',        label: 'All Posts' },
          { v: 'looking',    label: '🔍 Looking' },
          { v: 'recruiting', label: '📢 Recruiting' },
        ].map(({ v, label }) => (
          <button key={v} onClick={() => setFilter(v)}
            className={`px-6 py-2.5 rounded-full text-xs font-black uppercase tracking-widest transition-all border ${
              filter === v
                ? 'bg-text-primary text-white border-text-primary shadow-sm'
                : 'bg-white text-text-secondary border-border-dim hover:border-gray-300'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Cards grid */}
      {loading ? (
        <div className="flex justify-center py-24">
          <div className="w-10 h-10 border-4 border-primary/10 border-t-primary rounded-full animate-spin" />
        </div>
      ) : posts.length === 0 ? (
        <div className="card text-center py-24 text-text-secondary font-medium italic">
          No team posts yet — be the first to create one!
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {posts.map(p => (
            <TeamCard key={p.id} post={p} currentUserId={user?.id} onDelete={handleDelete} onClose={handleClose} />
          ))}
        </div>
      )}
    </div>
  )
}
