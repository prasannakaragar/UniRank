import { useEffect, useState, useRef, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useSearchParams } from 'react-router-dom'
import api from '../api/axios'

/* ── helpers ── */

// Python datetime.isoformat() has no 'Z' — append it so JS parses as UTC
function parseUTC(iso) {
  if (!iso) return new Date(NaN)
  return new Date(iso.endsWith('Z') ? iso : iso + 'Z')
}

// Conversation list: relative time
function timeAgo(iso) {
  if (!iso) return ''
  const d    = parseUTC(iso)
  const diff = (Date.now() - d) / 1000
  if (diff < 60)    return 'just now'
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

// Message thread: show actual clock time (today) or date+time (older)
function formatMsgTime(iso) {
  if (!iso) return ''
  const d    = parseUTC(iso)
  const diff = (Date.now() - d) / 1000
  const hm   = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
  if (diff < 86400)  return hm
  if (diff < 604800) return `${d.toLocaleDateString('en-IN', { weekday: 'short' })} ${hm}`
  return `${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} ${hm}`
}
function Avatar({ name = '', size = 8 }) {
  return (
    <div className={`w-${size} h-${size} rounded-full bg-accent-indigo/20 border border-accent-indigo/30 flex items-center justify-center shrink-0`}>
      <span className="text-accent-indigo font-bold text-xs">{name?.[0]?.toUpperCase()}</span>
    </div>
  )
}

/* ── Main page ── */
export default function Chats() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()

  const [conversations, setConversations] = useState([])
  const [activeConv, setActiveConv]       = useState(null)
  const [messages, setMessages]           = useState([])
  const [msgInput, setMsgInput]           = useState('')
  const [sending, setSending]             = useState(false)
  const [loadingConvs, setLoadingConvs]   = useState(true)
  const [loadingMsgs, setLoadingMsgs]     = useState(false)
  const [unread, setUnread]               = useState(0)
  const [msgMenuId, setMsgMenuId]         = useState(null)  // hovered msg id for delete
  const [convMenu, setConvMenu]           = useState(false) // header 3-dot dropdown

  // Search / new chat panel
  const [showSearch, setShowSearch]       = useState(false)
  const [searchQ, setSearchQ]             = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching]         = useState(false)

  // Group creation
  const [showGroupModal, setShowGroupModal] = useState(false)
  const [groupName, setGroupName]           = useState('')
  const [groupDesc, setGroupDesc]           = useState('')
  const [selectedMembers, setSelectedMembers] = useState([])

  const bottomRef  = useRef(null)
  const pollRef    = useRef(null)
  const inputRef   = useRef(null)

  /* ── load conversations ── */
  const loadConversations = useCallback(() => {
    api.get('/chats')
      .then(r => setConversations(r.data.conversations || []))
      .catch(() => {})
      .finally(() => setLoadingConvs(false))
    api.get('/chats/unread').then(r => setUnread(r.data.unread || 0)).catch(() => {})
  }, [])

  useEffect(() => { loadConversations() }, [loadConversations])

  /* ── auto-open from ?dm=userId ── */
  useEffect(() => {
    const dmTarget = searchParams.get('dm')
    if (dmTarget) startDM(dmTarget)
  }, [searchParams])

  /* ── load messages when conversation changes ── */
  useEffect(() => {
    if (!activeConv) return
    setLoadingMsgs(true)
    setMessages([])
    api.get(`/chats/${activeConv.id}/messages`)
      .then(r => setMessages(r.data.messages || []))
      .finally(() => setLoadingMsgs(false))
    api.post(`/chats/${activeConv.id}/read`).catch(() => {})
    // Mark conv as read locally
    setConversations(prev =>
      prev.map(c => c.id === activeConv.id ? { ...c, unread_count: 0 } : c)
    )
  }, [activeConv?.id])

  /* ── scroll to bottom on new messages ── */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  /* ── polling every 4s ── */
  useEffect(() => {
    pollRef.current = setInterval(() => {
      loadConversations()
      if (activeConv) {
        api.get(`/chats/${activeConv.id}/messages`)
          .then(r => setMessages(r.data.messages || []))
          .catch(() => {})
      }
    }, 4000)
    return () => clearInterval(pollRef.current)
  }, [activeConv, loadConversations])

  /* ── send message ── */
  const sendMessage = async (e) => {
    e?.preventDefault()
    const content = msgInput.trim()
    if (!content || !activeConv || sending) return
    setSending(true)
    try {
      const r = await api.post(`/chats/${activeConv.id}/messages`, { content })
      setMessages(prev => [...prev, r.data.message])
      setMsgInput('')
      loadConversations()
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to send message')
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  /* ── delete message ── */
  const deleteMessage = async (msgId) => {
    if (!window.confirm('Delete this message?')) return
    try {
      await api.delete(`/chats/${activeConv.id}/messages/${msgId}`)
      setMessages(prev => prev.map(m =>
        m.id === msgId ? { ...m, is_deleted: true, content: '[deleted]' } : m
      ))
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete message')
    } finally {
      setMsgMenuId(null)
    }
  }

  /* ── delete / leave conversation ── */
  const deleteConversation = async () => {
    const label = activeConv.kind === 'group' ? 'Leave this group?' : 'Delete this conversation?'
    if (!window.confirm(label)) return
    try {
      await api.delete(`/chats/${activeConv.id}`)
      setConversations(prev => prev.filter(c => c.id !== activeConv.id))
      setActiveConv(null)
      setMessages([])
    } catch (err) {
      alert(err.response?.data?.error || 'Failed')
    } finally {
      setConvMenu(false)
    }
  }
  
  /* ── block user ── */
  const handleBlock = async () => {
    if (activeConv.kind !== 'dm') return
    const other = activeConv.members?.find(m => m.user_id !== user?.id)
    if (!other) return
    if (!window.confirm(`Block ${other.name}? You won't receive messages from them.`)) return
    try {
      await api.post(`/chats/block/${other.user_id}`)
      alert(`${other.name} blocked.`)
      // Refresh conv list and clear active
      setConversations(prev => prev.filter(c => c.id !== activeConv.id))
      setActiveConv(null)
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to block')
    } finally {
      setConvMenu(false)
    }
  }

  /* ── report conversation ── */
  const handleReport = async () => {
    const reason = window.prompt('Reason for reporting this conversation:')
    if (!reason) return
    alert('Thank you. The conversation has been reported for moderation.')
    setConvMenu(false)
  }

  const startDM = async (targetId) => {
    try {
      const r = await api.post('/chats/dm', { user_id: targetId })
      const conv = r.data.conversation
      setConversations(prev => {
        const exists = prev.find(c => c.id === conv.id)
        return exists ? prev : [conv, ...prev]
      })
      setActiveConv(conv)
      setShowSearch(false)
    } catch (err) {
      alert(err.response?.data?.error || 'Could not start chat')
    }
  }

  /* ── user search ── */
  useEffect(() => {
    if (!searchQ.trim()) { setSearchResults([]); return }
    const t = setTimeout(() => {
      setSearching(true)
      api.get(`/chats/search/users?q=${encodeURIComponent(searchQ)}`)
        .then(r => setSearchResults(r.data.users || []))
        .finally(() => setSearching(false))
    }, 350)
    return () => clearTimeout(t)
  }, [searchQ])

  /* ── create group ── */
  const createGroup = async (e) => {
    e.preventDefault()
    if (!groupName.trim() || selectedMembers.length < 1) return
    try {
      const r = await api.post('/chats/group', {
        name: groupName,
        description: groupDesc,
        member_ids: selectedMembers.map(u => u.user_id),
      })
      const conv = r.data.conversation
      setConversations(prev => [conv, ...prev])
      setActiveConv(conv)
      setShowGroupModal(false)
      setGroupName(''); setGroupDesc(''); setSelectedMembers([])
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create group')
    }
  }

  /* ── get display name for conv ── */
  const convName = (conv) => {
    if (conv.kind === 'group') return conv.name
    const other = conv.members?.find(m => m.user_id !== user?.id)
    return other?.name || 'Chat'
  }
  const convSub = (conv) => {
    if (conv.kind === 'group') return `${conv.members?.length} members`
    const other = conv.members?.find(m => m.user_id !== user?.id)
    return other ? `${other.branch} · Y${other.year}` : ''
  }

  /* ── message status icon ── */
  const StatusIcon = ({ status }) => {
    if (status === 'seen')      return <span className="text-brand-400 text-xs">✓✓</span>
    if (status === 'delivered') return <span className="text-slate-400 text-xs">✓✓</span>
    return <span className="text-slate-600 text-xs">✓</span>
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] -mt-8 -mx-6 overflow-hidden rounded-xl border border-glass-border shadow-2xl">

      {/* ══ LEFT: Conversation list ══ */}
      <aside className="w-80 bg-void/50 backdrop-blur-xl border-r border-glass-border flex flex-col shrink-0">
        {/* Header */}
        <div className="px-4 py-4 border-b border-dark-600">
          <div className="flex items-center justify-between mb-3">
            <h1 className="font-display font-bold text-white text-lg flex items-center gap-2">
              Chats
              {unread > 0 && (
                <span className="bg-accent-indigo text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg shadow-indigo-500/30">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </h1>
            <div className="flex gap-1.5">
              <button
                onClick={() => { setShowSearch(s => !s); setShowGroupModal(false) }}
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-accent-indigo/20 hover:text-accent-indigo text-slate-400 border border-glass-border transition-all flex items-center justify-center"
                title="New chat"
              >
                <EditIcon size={15} />
              </button>
              <button
                onClick={() => { setShowGroupModal(s => !s); setShowSearch(false) }}
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-accent-indigo/20 hover:text-accent-indigo text-slate-400 border border-glass-border transition-all flex items-center justify-center"
                title="New group"
              >
                <UsersIcon size={15} />
              </button>
            </div>
          </div>

          {/* User search panel */}
          {showSearch && (
            <div className="space-y-2">
              <input
                className="input text-xs py-2"
                placeholder="Search by name or email…"
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                autoFocus
              />
              <div className="max-h-48 overflow-y-auto space-y-1">
                {searching && <p className="text-xs text-slate-500 px-1">Searching…</p>}
                {searchResults.map(u => (
                  <button
                    key={u.user_id}
                    onClick={() => startDM(u.user_id)}
                    className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-dark-600 transition-colors text-left"
                  >
                    <Avatar name={u.name} size={7} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{u.name}</p>
                      <p className="text-xs text-slate-500">{u.branch} · Y{u.year}</p>
                    </div>
                    <span className="ml-auto text-brand-400 text-xs shrink-0">Chat →</span>
                  </button>
                ))}
                {!searching && searchQ && searchResults.length === 0 && (
                  <p className="text-xs text-slate-500 px-1">No users found</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {loadingConvs ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : conversations.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <div className="w-12 h-12 rounded-full bg-dark-700 flex items-center justify-center mx-auto mb-3">
                <ChatIcon size={20} className="text-slate-600" />
              </div>
              <p className="text-slate-500 text-sm">No conversations yet</p>
              <p className="text-slate-600 text-xs mt-1">Click ✏ to start one</p>
            </div>
          ) : (
            conversations.map(conv => (
              <button
                key={conv.id}
                onClick={() => setActiveConv(conv)}
                className={`w-full flex items-center gap-3 px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-all text-left ${
                  activeConv?.id === conv.id ? 'bg-accent-indigo/10 border-l-2 border-l-accent-indigo' : ''
                }`}
              >
                {conv.kind === 'group' ? (
                  <div className="w-9 h-9 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center shrink-0">
                    <UsersIcon size={14} className="text-indigo-400" />
                  </div>
                ) : (
                  <Avatar name={convName(conv)} size={9} />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-display font-semibold text-sm text-white truncate">{convName(conv)}</p>
                    <span className="text-xs text-slate-600 shrink-0 ml-1">{timeAgo(conv.updated_at)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-500 truncate">
                      {conv.last_message
                        ? (conv.last_sender ? `${conv.last_sender}: ` : '') + conv.last_message
                        : convSub(conv)
                      }
                    </p>
                    {conv.unread_count > 0 && (
                      <span className="bg-accent-indigo text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ml-1 shadow-lg shadow-indigo-500/20">
                        {conv.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* ══ RIGHT: Message thread ══ */}
      <main className="flex-1 flex flex-col bg-void/30 backdrop-blur-sm min-w-0">
        {!activeConv ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
            <div className="w-20 h-20 rounded-2xl bg-dark-800 border border-dark-600 flex items-center justify-center mb-4">
              <ChatIcon size={36} className="text-brand-500/50" />
            </div>
            <h2 className="font-display font-bold text-white text-xl mb-2">Your Messages</h2>
            <p className="text-slate-500 text-sm max-w-xs">
              Select a conversation to read messages or click the <strong className="text-slate-300">✏</strong> icon to start a new chat.
            </p>
          </div>
        ) : (
          <>
            {/* Thread header */}
            <div className="px-5 py-3.5 border-b border-glass-border bg-white/5 flex items-center gap-3">
              {activeConv.kind === 'group' ? (
                <div className="w-9 h-9 rounded-full bg-accent-violet/20 border border-accent-violet/30 flex items-center justify-center">
                  <UsersIcon size={15} className="text-accent-violet" />
                </div>
              ) : (
                <Avatar name={convName(activeConv)} size={9} />
              )}
              <div>
                <p className="font-display font-semibold text-white leading-none">{convName(activeConv)}</p>
                <p className="text-[10px] text-slate-500 mt-1">{convSub(activeConv)}</p>
              </div>
              {activeConv.kind === 'group' && (
                <div className="flex -space-x-1">
                  {activeConv.members?.slice(0, 5).map(m => (
                    <div key={m.user_id} title={m.name}
                      className="w-6 h-6 rounded-full bg-brand-500/20 border border-dark-800 flex items-center justify-center text-[9px] font-bold text-brand-400">
                      {m.name?.[0]}
                    </div>
                  ))}
                </div>
              )}
              {/* 3-dot menu */}
              <div className="ml-auto relative">
                <button
                  onClick={() => setConvMenu(v => !v)}
                  className="w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-dark-600 flex items-center justify-center transition-colors"
                  title="Options"
                >
                  <DotsIcon size={16} />
                </button>
                {convMenu && (
                  <div className="absolute right-0 top-10 bg-dark-800 border border-glass-border rounded-xl shadow-2xl z-50 overflow-hidden min-w-[160px] animate-in fade-in slide-in-from-top-2 duration-200">
                    <button
                      onClick={deleteConversation}
                      className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-rose-400 hover:bg-rose-500/10 transition-colors text-left"
                    >
                      <TrashIcon size={14} />
                      {activeConv.kind === 'group' ? 'Leave Group' : 'Delete Chat'}
                    </button>
                    {activeConv.kind === 'dm' && (
                      <button
                        onClick={handleBlock}
                        className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-slate-300 hover:bg-white/5 transition-colors text-left"
                      >
                        <SlashIcon size={14} />
                        Block User
                      </button>
                    )}
                    <button
                      onClick={handleReport}
                      className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-slate-300 hover:bg-white/5 transition-colors text-left border-t border-glass-border"
                    >
                      <AlertIcon size={14} />
                      Report
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-3"
              style={{ backgroundImage: 'radial-gradient(ellipse at 50% 0%, rgba(37,162,98,0.04) 0%, transparent 70%)' }}>
              {loadingMsgs ? (
                <div className="flex justify-center py-12"><Spinner /></div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-20 gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-dark-700 border border-dark-600 flex items-center justify-center">
                    <ChatIcon size={24} className="text-slate-600" />
                  </div>
                  <p className="text-slate-500 text-sm">No messages yet — say hello! 👋</p>
                </div>
              ) : (
                messages.map((msg, i) => {
                  const isMe = msg.sender_id === user?.id
                  // Show date divider when day changes
                  const prevMsg   = messages[i - 1]
                  const thisDay   = parseUTC(msg.created_at).toDateString()
                  const prevDay   = prevMsg ? parseUTC(prevMsg.created_at).toDateString() : null
                  const showDivider = thisDay !== prevDay
                  const todayStr  = new Date().toDateString()
                  const dividerLabel = thisDay === todayStr ? 'Today'
                    : parseUTC(msg.created_at).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })
                  return (
                    <div key={msg.id}>
                      {showDivider && (
                        <div className="flex items-center gap-3 my-4">
                          <div className="flex-1 h-px bg-dark-700" />
                          <span className="text-[10px] text-slate-600 font-medium px-2">{dividerLabel}</span>
                          <div className="flex-1 h-px bg-dark-700" />
                        </div>
                      )}
                      <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} items-end gap-2`}>
                        {!isMe && <Avatar name={msg.sender_name} size={7} />}
                        <div className="max-w-[68%] group">
                          {!isMe && (
                            <p className="text-[11px] text-slate-500 mb-1 ml-1 font-medium">{msg.sender_name}</p>
                          )}
                          <div className="flex items-end gap-1.5">
                            {/* Delete button — only own messages, shows on hover */}
                            {isMe && !msg.is_deleted && (
                              <button
                                onClick={() => deleteMessage(msg.id)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-400/10 shrink-0"
                                title="Delete message"
                              >
                                <TrashIcon size={12} />
                              </button>
                            )}
                            <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words shadow-xl ${
                              isMe
                                ? 'bg-gradient-to-br from-accent-indigo to-accent-violet text-white rounded-br-none shadow-indigo-500/20'
                                : 'bg-white/10 backdrop-blur-md text-slate-100 rounded-bl-none border border-glass-border'
                            } ${msg.is_deleted ? 'opacity-40 italic text-xs' : ''}`}>
                              {msg.content}
                            </div>
                          </div>
                          <div className={`flex items-center gap-1.5 mt-1 px-1 ${
                            isMe ? 'justify-end' : 'justify-start'
                          }`}>
                            <span className="text-[10px] text-slate-600">{formatMsgTime(msg.created_at)}</span>
                            {isMe && <StatusIcon status={msg.status} />}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input bar */}
            <form onSubmit={sendMessage} className="px-4 py-3 border-t border-glass-border bg-white/5 flex items-center gap-3">
              <input
                ref={inputRef}
                className="flex-1 bg-black/40 border border-glass-border rounded-full px-5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-accent-indigo focus:ring-1 focus:ring-accent-indigo/20 transition-all"
                placeholder="Type a message…"
                value={msgInput}
                onChange={e => setMsgInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(e)}
                autoComplete="off"
              />
              <button
                type="submit"
                disabled={!msgInput.trim() || sending}
                className="w-10 h-10 rounded-full bg-accent-indigo hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center active:scale-95 shadow-lg shadow-indigo-500/20"
              >
                <SendIcon size={16} />
              </button>
            </form>
          </>
        )}
      </main>

      {/* ══ Group creation modal ══ */}
      {showGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-dark-800 border border-dark-600 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="font-display font-bold text-white text-lg mb-4">Create Group Chat</h2>
            <form onSubmit={createGroup} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase block mb-1">Group Name *</label>
                <input className="input" placeholder="e.g. CP Study Group" value={groupName} onChange={e => setGroupName(e.target.value)} required />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase block mb-1">Description</label>
                <input className="input" placeholder="Optional description" value={groupDesc} onChange={e => setGroupDesc(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase block mb-1">Search & Add Members</label>
                <input
                  className="input text-xs py-2 mb-2"
                  placeholder="Search users…"
                  value={searchQ}
                  onChange={e => setSearchQ(e.target.value)}
                />
                <div className="max-h-36 overflow-y-auto space-y-1">
                  {searchResults.filter(u => !selectedMembers.find(s => s.user_id === u.user_id)).map(u => (
                    <button type="button" key={u.user_id}
                      onClick={() => setSelectedMembers(prev => [...prev, u])}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-dark-600 text-left transition-colors">
                      <Avatar name={u.name} size={6} />
                      <span className="text-sm text-white">{u.name}</span>
                      <span className="text-xs text-slate-500">{u.branch} Y{u.year}</span>
                      <span className="ml-auto text-brand-400 text-xs">+ Add</span>
                    </button>
                  ))}
                </div>
                {selectedMembers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {selectedMembers.map(m => (
                      <span key={m.user_id} className="flex items-center gap-1 bg-brand-500/15 text-brand-300 text-xs px-2 py-0.5 rounded-full border border-brand-500/30">
                        {m.name}
                        <button type="button" onClick={() => setSelectedMembers(prev => prev.filter(s => s.user_id !== m.user_id))} className="hover:text-red-400 ml-0.5">×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-3 mt-2">
                <button type="button" onClick={() => { setShowGroupModal(false); setSelectedMembers([]); setGroupName(''); setGroupDesc('') }}
                  className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={!groupName.trim() || selectedMembers.length < 1}
                  className="btn-primary flex-1">Create Group</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Inline icons ── */
function ChatIcon({ size = 20, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  )
}
function EditIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  )
}
function UsersIcon({ size = 20, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )
}
function SendIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  )
}
function Spinner() {
  return <div className="w-6 h-6 border-2 border-accent-indigo border-t-transparent rounded-full animate-spin" />
}
function DotsIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
    </svg>
  )
}
function TrashIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
      <path d="M10 11v6"/><path d="M14 11v6"/>
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
    </svg>
  )
}
function SlashIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
    </svg>
  )
}
function AlertIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  )
}
