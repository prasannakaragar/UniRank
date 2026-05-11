import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'

const SKILLS = ['DSA', 'Web Dev', 'App Dev', 'AI/ML', 'Blockchain', 'Cybersec', 'UI/UX', 'DevOps', 'Data Science']

function TeamCard({ post, currentUserId, onDelete, onClose }) {
  const isLooking = post.post_type === 'looking'
  return (
    <div className={`card border transition-all duration-200 hover:border-dark-500 ${
      isLooking ? 'border-green-500/20' : 'border-amber-500/20'
    }`}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <span className={`badge border ${
          isLooking ? 'bg-green-500/15 text-green-400 border-green-500/30'
                    : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
        }`}>
          {isLooking ? '🔍 Looking for Team' : '📢 Recruiting Members'}
        </span>
        {post.author_id === currentUserId && (
          <div className="flex gap-2">
            {post.is_active && (
              <button onClick={() => onClose(post.id)}
                className="text-xs text-slate-500 hover:text-brand-400 transition-colors">Mark Closed</button>
            )}
            <button onClick={() => onDelete(post.id)}
              className="text-slate-600 hover:text-red-400 transition-colors text-xs">✕</button>
          </div>
        )}
      </div>

      <h3 className="font-display font-semibold text-white mb-1">{post.title}</h3>
      {post.description && <p className="text-sm text-slate-400 mb-3 leading-relaxed">{post.description}</p>}

      {post.skills_needed?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {post.skills_needed.map(s => (
            <span key={s} className="badge bg-dark-600 text-slate-300 text-xs">{s}</span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-3 border-t border-dark-700">
        <div>
          <p className="text-sm font-display font-medium text-slate-300">{post.author}</p>
          <p className="text-xs text-slate-500">{post.author_branch} · Year {post.author_year}</p>
        </div>
        <div className="text-right">
          {post.team_size && <p className="text-xs text-slate-500">Team size: {post.team_size}</p>}
          {post.contact_info && (
            <p className="text-xs text-brand-400 font-mono mt-0.5">{post.contact_info}</p>
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-3xl text-white">Team Board</h1>
          <p className="text-slate-400 text-sm mt-1">Find teammates or recruit for your next hackathon</p>
        </div>
        <button onClick={() => setShowForm(p => !p)} className="btn-primary self-start sm:self-auto">
          {showForm ? '✕ Cancel' : '+ Post'}
        </button>
      </div>

      {/* Post form */}
      {showForm && (
        <div className="card border-brand-500/30 bg-brand-500/5">
          <h2 className="font-display font-semibold text-white mb-4">Create Team Post</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Type toggle */}
            <div className="flex gap-2">
              {[
                { v: 'looking',    label: '🔍 Looking for Team' },
                { v: 'recruiting', label: '📢 Recruiting Members' },
              ].map(({ v, label }) => (
                <button key={v} type="button"
                  onClick={() => setForm(p => ({ ...p, post_type: v }))}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-display font-semibold border transition-all ${
                    form.post_type === v
                      ? 'bg-brand-500 text-white border-brand-500'
                      : 'bg-dark-700 text-slate-400 border-dark-600 hover:border-brand-500'
                  }`}>
                  {label}
                </button>
              ))}
            </div>

            <div>
              <label className="block text-xs text-slate-500 mb-1">Title *</label>
              <input className="input" placeholder={form.post_type === 'looking' ? 'Looking for team for Smart India Hackathon' : 'Need ML developer for HackMIT'}
                value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} required />
            </div>

            <div>
              <label className="block text-xs text-slate-500 mb-1">Description</label>
              <textarea className="input resize-none" rows={2}
                placeholder="Tell others more about what you're working on…"
                value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
            </div>

            <div>
              <label className="block text-xs text-slate-500 mb-2">Skills</label>
              <div className="flex flex-wrap gap-2">
                {SKILLS.map(s => (
                  <button key={s} type="button" onClick={() => toggleSkill(s)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                      form.skills_needed.includes(s)
                        ? 'bg-brand-500 text-white border-brand-500'
                        : 'bg-dark-700 text-slate-400 border-dark-600 hover:border-brand-500'
                    }`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Contact (email/Discord/phone)</label>
                <input className="input" placeholder="your@email.com or @discord"
                  value={form.contact_info} onChange={e => setForm(p => ({ ...p, contact_info: e.target.value }))} />
              </div>
              {form.post_type === 'recruiting' && (
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Team Size (total)</label>
                  <input className="input" type="number" min={2} max={10} placeholder="4"
                    value={form.team_size} onChange={e => setForm(p => ({ ...p, team_size: e.target.value }))} />
                </div>
              )}
            </div>

            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? 'Posting…' : 'Post'}
            </button>
          </form>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-1 bg-dark-800 border border-dark-600 rounded-lg p-1 w-fit">
        {[
          { v: 'all', label: 'All' },
          { v: 'looking', label: '🔍 Looking' },
          { v: 'recruiting', label: '📢 Recruiting' },
        ].map(({ v, label }) => (
          <button key={v} onClick={() => setFilter(v)}
            className={`px-3 py-1.5 rounded-md text-xs font-display font-semibold transition-all ${
              filter === v ? 'bg-brand-500 text-white' : 'text-slate-400 hover:text-white'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Cards */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : posts.length === 0 ? (
        <div className="card text-center py-16 text-slate-500">
          No team posts yet. Create the first one!
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {posts.map(p => (
            <TeamCard key={p.id} post={p} currentUserId={user?.id} onDelete={handleDelete} onClose={handleClose} />
          ))}
        </div>
      )}
    </div>
  )
}
