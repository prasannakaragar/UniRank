import { useEffect, useState, useRef, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useSearchParams } from 'react-router-dom'
import api from '../api/axios'
import { io } from 'socket.io-client'

/* ── helpers ── */

function parseUTC(iso) {
  if (!iso) return new Date(NaN)
  return new Date(iso.endsWith('Z') ? iso : iso + 'Z')
}

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

function formatMsgTime(iso) {
  if (!iso) return ''
  const d    = parseUTC(iso)
  const diff = (Date.now() - d) / 1000
  const hm   = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
  if (diff < 86400)  return hm
  if (diff < 604800) return `${d.toLocaleDateString('en-IN', { weekday: 'short' })} ${hm}`
  return `${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} ${hm}`
}

function Avatar({ name = '', size = 10 }) {
  return (
    <div className={`w-${size} h-${size} rounded-full bg-gray-100 border border-border-dim flex items-center justify-center shrink-0`}>
      <span className="text-primary font-bold text-sm">{name?.[0]?.toUpperCase()}</span>
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
  const [convMenu, setConvMenu]           = useState(false)

  // Selection & Forwarding
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds]     = useState([])
  const [showForwardPicker, setShowForwardPicker] = useState(false)
  const [forwardMsgId, setForwardMsgId]   = useState(null)

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
  
  // Info Panel & Media
  const [showInfoPanel, setShowInfoPanel] = useState(false)
  const [sharedMedia, setSharedMedia]     = useState([])
  const [loadingMedia, setLoadingMedia]   = useState(false)
  const [lightboxImage, setLightboxImage] = useState(null)
  const [otherProfile, setOtherProfile]   = useState(null)
  
  // Group editing
  const [editingGroup, setEditingGroup] = useState(false)
  const [editName, setEditName]         = useState('')
  const [editDesc, setEditDesc]         = useState('')

  const bottomRef  = useRef(null)
  const inputRef   = useRef(null)
  const socketRef  = useRef(null)

  /* ── socket setup ── */
  useEffect(() => {
    if (!user) return
    
    // Connect to socket - strip /api suffix to get root server URL for Socket.IO
    const apiUrl = import.meta.env.VITE_API_URL || ''
    const socketUrl = apiUrl ? apiUrl.replace(/\/api$/, '') : '/'
    const socket = io(socketUrl, { path: '/socket.io' })
    socketRef.current = socket

    socket.on('connect', () => {
      // Join personal room for unread updates and self-only deletions
      socket.emit('join', { room: `user_${user.id}` })
    })

    socket.on('new_message', (data) => {
      // If message is for the active conversation, add to list
      if (activeConv && data.conversation_id === activeConv.id) {
        setMessages(prev => {
            // Avoid duplicates
            if (prev.find(m => m.messageId === data.message.messageId)) return prev
            return [...prev, data.message]
        })
        api.post(`/chats/${data.conversation_id}/read`).catch(() => {})
      }
      
      // Update conversation preview in the list
      setConversations(prev => {
        const idx = prev.findIndex(c => c.id === data.conversation_id)
        if (idx === -1) {
            // Might be a new conversation started by someone else, reload
            loadConversations()
            return prev
        }
        const updated = [...prev]
        updated[idx] = {
          ...updated[idx],
          last_message: data.message.text,
          last_sender: data.message.senderName,
          updated_at: data.message.timestamp,
          unread_count: (activeConv?.id === data.conversation_id) ? 0 : updated[idx].unread_count + 1
        }
        // Move to top
        return [updated[idx], ...updated.filter((_, i) => i !== idx)]
      })
    })

    socket.on('message_deleted', (data) => {
      setMessages(prev => prev.filter(m => {
        // If message is the one being deleted
        if (m.messageId === data.message_id) {
          // If deleted for everyone, we remove it from UI (it's hard deleted in DB now)
          if (data.mode === 'everyone') return false
          // If deleted for me, we remove it from UI
          return false
        }
        return true
      }))
    })

    socket.on('unread_update', (data) => {
        setConversations(prev => prev.map(c => 
            c.id === data.conversation_id ? { ...c, unread_count: data.unread_count } : c
        ))
        // Update total unread
        api.get('/chats/unread').then(r => setUnread(r.data.unread || 0)).catch(() => {})
    })

    socket.on('messages_read', (data) => {
        if (activeConv?.id === data.conversation_id) {
            setMessages(prev => prev.map(m => 
                m.senderId !== data.user_id ? { ...m, status: 'seen' } : m
            ))
        }
    })

    socket.on('group_updated', (data) => {
        setConversations(prev => prev.map(c => 
            c.id === data.conversation_id ? { ...c, name: data.name, description: data.description } : c
        ))
        if (activeConv?.id === data.conversation_id) {
            setActiveConv(prev => ({ ...prev, name: data.name, description: data.description }))
        }
    })

    return () => {
      socket.disconnect()
    }
  }, [user, activeConv?.id])

  /* ── join/leave conversation rooms ── */
  useEffect(() => {
    if (!activeConv || !socketRef.current) return
    socketRef.current.emit('join', { room: activeConv.id })
    return () => {
        if (socketRef.current) socketRef.current.emit('leave', { room: activeConv.id })
    }
  }, [activeConv?.id])

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
    setSelectionMode(false)
    setSelectedIds([])
  }, [activeConv?.id])

  /* ── scroll to bottom on new messages ── */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  /* ── info panel data ── */
  useEffect(() => {
    if (!activeConv || !showInfoPanel) return
    
    // Fetch media
    setLoadingMedia(true)
    api.get(`/chats/${activeConv.id}/media`)
      .then(r => setSharedMedia(r.data || []))
      .finally(() => setLoadingMedia(false))
    
    // If DM, fetch the other user's profile info
    if (activeConv.kind === 'dm') {
      const other = activeConv.members?.find(m => m.user_id !== user?.id)
      if (other) {
        api.get(`/profile/${other.user_id}`).then(r => setOtherProfile(r.data)).catch(() => {})
      }
    } else {
      setOtherProfile(null)
    }
  }, [activeConv?.id, showInfoPanel])

  /* ── escape key to close overlays ── */
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        if (lightboxImage) setLightboxImage(null)
        else if (showInfoPanel) setShowInfoPanel(false)
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [lightboxImage, showInfoPanel])

  /* ── send message ── */
  const sendMessage = async (e, mediaUrl = null) => {
    e?.preventDefault()
    const content = msgInput.trim()
    if (!content && !mediaUrl || !activeConv || sending) return
    setSending(true)
    try {
      await api.post(`/chats/${activeConv.id}/messages`, { 
        content: content, 
        media_url: mediaUrl 
      })
      setMsgInput('')
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to send message')
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  const handleImageUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    
    const formData = new FormData()
    formData.append('file', file)
    
    try {
      setSending(true)
      const res = await api.post('/upload/image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      // Send message with the uploaded image URL
      await sendMessage(null, res.data.url)
    } catch (err) {
      alert(err.response?.data?.error || 'Upload failed')
    } finally {
      setSending(false)
    }
  }

  /* ── delete message ── */
  const deleteMessage = async (msgId, mode = 'me') => {
    const label = mode === 'everyone' ? 'Delete for everyone?' : 'Delete for me?'
    if (!window.confirm(label)) return
    try {
      await api.delete(`/chats/${activeConv.id}/messages/${msgId}?mode=${mode}`)
      // State updated via socket
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete message')
    }
  }

  const deleteSelected = async (mode = 'me') => {
      const label = mode === 'everyone' ? `Delete ${selectedIds.length} messages for everyone?` : `Delete ${selectedIds.length} messages for me?`
      if (!window.confirm(label)) return
      
      try {
          await api.delete(`/chats/${activeConv.id}/messages/bulk-delete`, {
              data: { message_ids: selectedIds, mode }
          })
          setSelectionMode(false)
          setSelectedIds([])
      } catch (err) {
          alert(err.response?.data?.error || 'Failed to delete messages')
      }
  }

  /* ── forward message ── */
  const openForwardPicker = (msgId) => {
    setForwardMsgId(msgId)
    setShowForwardPicker(true)
  }

  const forwardMessage = async (targetChatId) => {
    if (!forwardMsgId) return
    try {
        await api.post(`/chats/messages/${forwardMsgId}/forward`, { target_chat_id: targetChatId })
        setShowForwardPicker(false)
        setForwardMsgId(null)
        alert('Message forwarded!')
    } catch (err) {
        alert(err.response?.data?.error || 'Failed to forward')
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
  
  const saveGroupInfo = async () => {
    try {
        await api.patch(`/chats/${activeConv.id}`, { name: editName, description: editDesc })
        setEditingGroup(false)
    } catch (err) {
        alert(err.response?.data?.error || 'Failed to update group')
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
      setConversations(prev => prev.filter(c => c.id !== activeConv.id))
      setActiveConv(null)
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to block')
    } finally {
      setConvMenu(false)
    }
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
    if (status === 'seen')      return <span className="text-white opacity-80 text-[10px]">✓✓</span>
    if (status === 'delivered') return <span className="text-white opacity-50 text-[10px]">✓✓</span>
    return <span className="text-white opacity-30 text-[10px]">✓</span>
  }

  const toggleSelection = (id) => {
      setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] -mt-10 -mx-10 overflow-hidden bg-white border border-border-dim shadow-card rounded-2xl relative">
      
      {/* Lightbox Overlay */}
      {lightboxImage && (
        <div 
          className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex items-center justify-center p-8 animate-in fade-in duration-300"
          onClick={() => setLightboxImage(null)}
        >
          <button className="absolute top-8 right-8 text-white/70 hover:text-white transition-colors">
            <span className="text-4xl">✕</span>
          </button>
          <img 
            src={lightboxImage} 
            className="max-w-full max-h-full object-contain shadow-2xl animate-in zoom-in-95 duration-300" 
            alt="Fullscreen"
            onClick={e => e.stopPropagation()} 
          />
        </div>
      )}

      {/* ══ LEFT: Conversation list ══ */}
      <aside className="w-[320px] bg-white border-r border-border-dim flex flex-col shrink-0">
        {/* Header */}
        <div className="px-6 py-6 border-b border-border-dim">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
              Chats
              {unread > 0 && (
                <span className="bg-primary text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </h1>
            <div className="flex gap-2">
              <button
                onClick={() => { setShowSearch(s => !s); setShowGroupModal(false) }}
                className="w-9 h-9 rounded-lg bg-primary text-white hover:brightness-125 transition-all flex items-center justify-center"
                title="New chat"
              >
                <EditIcon size={16} />
              </button>
              <button
                onClick={() => { setShowGroupModal(s => !s); setShowSearch(false) }}
                className="w-9 h-9 rounded-lg bg-text-primary text-white hover:brightness-125 transition-all flex items-center justify-center"
                title="New group"
              >
                <UsersIcon size={16} />
              </button>
            </div>
          </div>

          {/* User search panel */}
          {showSearch && (
            <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
              <input
                className="input py-2 text-sm"
                placeholder="Search by name or email…"
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                autoFocus
              />
              <div className="max-h-60 overflow-y-auto space-y-1 bg-gray-50 rounded-xl border border-border-dim p-1">
                {searching && <p className="text-xs text-text-secondary p-2 font-medium">Searching…</p>}
                {searchResults.map(u => (
                  <button
                    key={u.user_id}
                    onClick={() => startDM(u.user_id)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white transition-colors text-left border border-transparent hover:border-border-dim"
                  >
                    <Avatar name={u.name} size={8} />
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold text-text-primary truncate">{u.name}</p>
                      <p className="text-[11px] text-text-secondary font-medium">{u.branch} · Y{u.year}</p>
                    </div>
                  </button>
                ))}
                {!searching && searchQ && searchResults.length === 0 && (
                  <p className="text-xs text-text-secondary p-2 font-medium">No users found</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto divide-y divide-dashed divide-border-dim">
          {loadingConvs ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-primary/10 border-t-primary rounded-full animate-spin" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="px-10 py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-4 border border-border-dim">
                <ChatIcon size={24} className="text-gray-300" />
              </div>
              <p className="text-text-secondary font-bold text-[15px]">No conversations yet</p>
              <p className="text-text-secondary text-xs mt-2 font-medium">Click ✏ to start a new chat</p>
            </div>
          ) : (
            conversations.map(conv => (
              <button
                key={conv.id}
                onClick={() => setActiveConv(conv)}
                className={`w-full flex items-center gap-4 px-6 py-5 hover:bg-accent-pill transition-all text-left ${
                  activeConv?.id === conv.id ? 'bg-accent-pill relative before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-primary' : ''
                }`}
              >
                {conv.kind === 'group' ? (
                  <div className="w-11 h-11 rounded-full bg-gray-100 border border-border-dim flex items-center justify-center shrink-0">
                    <UsersIcon size={18} className="text-primary" />
                  </div>
                ) : (
                  <Avatar name={convName(conv)} size={11} />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[14px] font-bold text-text-primary truncate">{convName(conv)}</p>
                    <span className="text-[11px] font-bold text-text-secondary shrink-0 ml-2">{timeAgo(conv.updated_at)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-[13px] text-text-secondary truncate font-medium">
                      {conv.last_message
                        ? (conv.last_sender ? `${conv.last_sender}: ` : '') + conv.last_message
                        : convSub(conv)
                      }
                    </p>
                    {conv.unread_count > 0 && (
                      <span className="bg-primary text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ml-2">
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
      <main className="flex-1 flex flex-col bg-page min-w-0 relative">
        {!activeConv ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-10">
            <div className="w-24 h-24 rounded-3xl bg-white border border-border-dim flex items-center justify-center mb-6 shadow-card">
              <ChatIcon size={40} className="text-primary" strokeWidth={1.5} />
            </div>
            <h2 className="text-2xl font-bold text-text-primary mb-2">Your Messages</h2>
            <p className="text-text-secondary text-[15px] font-medium max-w-xs leading-relaxed">
              Select a conversation from the left or click the <strong className="text-primary font-bold">✏</strong> button to start messaging.
            </p>
          </div>
        ) : (
          <>
            {/* Thread header */}
            <div className="px-8 py-4 border-b border-border-dim bg-white flex items-center gap-4">
              <div 
                className="flex flex-1 items-center gap-4 cursor-pointer hover:bg-gray-50 transition-colors -ml-4 pl-4 py-2 rounded-xl"
                onClick={() => setShowInfoPanel(!showInfoPanel)}
              >
                {activeConv.kind === 'group' ? (
                  <div className="w-10 h-10 rounded-full bg-gray-50 border border-border-dim flex items-center justify-center">
                    <UsersIcon size={18} className="text-primary" />
                  </div>
                ) : (
                  <Avatar name={convName(activeConv)} size={10} />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-text-primary leading-none truncate">{convName(activeConv)}</p>
                  <p className="text-[11px] text-text-secondary font-bold uppercase tracking-wider mt-1.5">{convSub(activeConv)}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => { setSelectionMode(!selectionMode); setSelectedIds([]) }}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                    selectionMode ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {selectionMode ? 'CANCEL' : 'SELECT'}
                </button>

                <div className="relative">
                    <button
                      onClick={() => setConvMenu(v => !v)}
                      className="w-10 h-10 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center justify-center transition-colors"
                    >
                      <DotsIcon size={18} />
                    </button>
                    {convMenu && (
                    <div className="absolute right-0 top-12 bg-white border border-border-dim rounded-xl shadow-card z-50 overflow-hidden min-w-[180px] animate-in fade-in slide-in-from-top-2 duration-200">
                        <button
                          onClick={deleteConversation}
                          className="w-full flex items-center gap-3 px-4 py-3.5 text-[13px] font-bold text-danger hover:bg-danger/5 transition-colors text-left"
                        >
                          <TrashIcon size={14} />
                          {activeConv.kind === 'group' ? 'Leave Group' : 'Delete Chat'}
                        </button>
                        {activeConv.kind === 'dm' && (
                        <button
                            onClick={handleBlock}
                            className="w-full flex items-center gap-3 px-4 py-3.5 text-[13px] font-bold text-gray-600 hover:bg-gray-50 transition-colors text-left"
                        >
                            <SlashIcon size={14} />
                            Block User
                        </button>
                        )}
                    </div>
                    )}
                </div>
              </div>
            </div>

            {/* Selection Toolbar */}
            {selectionMode && selectedIds.length > 0 && (
                <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-text-primary px-6 py-3 rounded-full shadow-2xl flex items-center gap-8 z-40 animate-in slide-in-from-top-4 duration-300">
                    <span className="text-white text-xs font-bold uppercase tracking-widest">{selectedIds.length} SELECTED</span>
                    <div className="flex items-center gap-5">
                        <button onClick={() => deleteSelected('me')} className="text-white/70 hover:text-white transition-colors" title="Delete for Me">
                            <TrashIcon size={16} />
                        </button>
                        {/* Only show 'Delete for Everyone' if all selected messages are from me */}
                        {selectedIds.every(id => messages.find(m => m.messageId === id)?.senderId === user?.id) && (
                            <button 
                                onClick={() => deleteSelected('everyone')} 
                                className="bg-danger text-white text-[9px] font-black px-2 py-1 rounded hover:brightness-110 transition-all"
                                title="Delete for Everyone"
                            >
                                EVERYONE
                            </button>
                        )}
                        <button onClick={() => alert('Forwarding multiple messages is coming soon!')} className="text-white/70 hover:text-white transition-colors" title="Forward selected">
                            <ShareIcon size={16} />
                        </button>
                    </div>
                </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-8 py-8 space-y-4">
              {loadingMsgs ? (
                <div className="flex justify-center py-24">
                  <div className="w-10 h-10 border-4 border-primary/10 border-t-primary rounded-full animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <div className="w-16 h-16 rounded-3xl bg-white border border-border-dim flex items-center justify-center">
                    <ChatIcon size={24} className="text-gray-200" />
                  </div>
                  <p className="text-text-secondary font-bold text-[15px]">No messages yet — say hello! 👋</p>
                </div>
              ) : (
                messages.map((msg, i) => {
                  const isMe = msg.senderId === user?.id
                  const prevMsg   = messages[i - 1]
                  const thisDay   = parseUTC(msg.timestamp).toDateString()
                  const prevDay   = prevMsg ? parseUTC(prevMsg.timestamp).toDateString() : null
                  const showDivider = thisDay !== prevDay
                  const todayStr  = new Date().toDateString()
                  const dividerLabel = thisDay === todayStr ? 'TODAY'
                    : parseUTC(msg.timestamp).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' }).toUpperCase()
                  
                  const isSelected = selectedIds.includes(msg.messageId)

                  return (
                    <div key={msg.messageId}>
                      {showDivider && (
                        <div className="flex items-center gap-4 my-8">
                          <div className="flex-1 h-px bg-border-dim" />
                          <span className="text-[10px] text-text-secondary font-extrabold tracking-widest px-2">{dividerLabel}</span>
                          <div className="flex-1 h-px bg-border-dim" />
                        </div>
                      )}
                      <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} items-end gap-3 group`}>
                        {selectionMode && (
                            <input 
                                type="checkbox" 
                                checked={isSelected} 
                                onChange={() => toggleSelection(msg.messageId)}
                                className="mb-4 accent-primary w-4 h-4 rounded-full border-border-dim cursor-pointer"
                            />
                        )}

                        {!isMe && <Avatar name={msg.senderName} size={8} />}
                        <div className={`max-w-[75%] ${isMe ? 'flex flex-col items-end' : ''}`}>
                          {!isMe && (
                            <p className="text-[11px] text-text-secondary mb-1.5 ml-1 font-bold uppercase tracking-wider">{msg.senderName}</p>
                          )}
                          
                          <div className="flex items-end gap-2 relative group/msg">
                            {/* Message actions */}
                            {!selectionMode && !msg.isDeletedForEveryone && (
                                <div className={`absolute bottom-full ${isMe ? 'right-0' : 'left-0'} mb-2 flex gap-1 opacity-0 group-hover/msg:opacity-100 transition-opacity bg-white/90 backdrop-blur rounded-lg border border-border-dim shadow-card p-1 z-10`}>
                                    <button onClick={() => openForwardPicker(msg.messageId)} className="p-1.5 hover:bg-gray-100 rounded text-text-secondary hover:text-primary transition-colors" title="Forward">
                                        <ShareIcon size={13} />
                                    </button>
                                    <button onClick={() => deleteMessage(msg.messageId, 'me')} className="p-1.5 hover:bg-gray-100 rounded text-text-secondary hover:text-danger transition-colors" title="Delete for Me">
                                        <TrashIcon size={13} />
                                    </button>
                                    {isMe && (
                                        <button onClick={() => deleteMessage(msg.messageId, 'everyone')} className="p-1.5 hover:bg-gray-100 rounded text-danger font-extrabold text-[9px] px-2 tracking-tighter" title="Delete for Everyone">
                                            EVERYONE
                                        </button>
                                    )}
                                </div>
                            )}

                            <div className={`px-5 py-3.5 rounded-2xl text-[14px] leading-relaxed break-words shadow-sm relative ${
                              isMe
                                ? 'bg-primary text-white rounded-br-none'
                                : 'bg-white text-text-primary rounded-bl-none border border-border-dim'
                            } ${msg.isDeletedForEveryone ? 'opacity-50 italic text-[13px] bg-gray-50 border-dashed' : ''}`}>
                              {msg.forwarded && (
                                  <div className="flex items-center gap-1 text-[10px] opacity-70 mb-1.5 font-bold italic tracking-wider">
                                      <ShareIcon size={11} /> FORWARDED
                                  </div>
                              )}
                              
                              {msg.media_url && (
                                <img 
                                  src={msg.media_url} 
                                  className="rounded-lg mb-2 max-w-full cursor-pointer hover:brightness-90 transition-all border border-black/5 shadow-sm" 
                                  alt="Shared"
                                  onClick={() => setLightboxImage(msg.media_url)}
                                />
                              )}
                              
                              {msg.text && <div>{msg.text}</div>}
                            </div>
                          </div>
                          <div className={`flex items-center gap-2 mt-1.5 px-1 ${
                            isMe ? 'justify-end' : 'justify-start'
                          }`}>
                            <span className="text-[10px] text-text-secondary font-bold">{formatMsgTime(msg.timestamp)}</span>
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
            <form onSubmit={sendMessage} className="px-6 py-5 border-t border-border-dim bg-white flex items-center gap-4">
              <label className="w-10 h-10 rounded-xl bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors flex items-center justify-center cursor-pointer shrink-0">
                <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={sending} />
                <CameraIcon size={18} />
              </label>
              
              <input
                ref={inputRef}
                className="flex-1 bg-gray-50 border border-border-dim rounded-xl px-6 py-3.5 text-sm text-text-primary placeholder-gray-400 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/5 transition-all font-medium"
                placeholder="Write your message here…"
                value={msgInput}
                onChange={e => setMsgInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(e)}
                autoComplete="off"
              />
              <button
                type="submit"
                disabled={(!msgInput.trim() && !sending) || sending}
                className="w-12 h-12 rounded-xl bg-primary text-white hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center active:scale-95 shadow-md"
              >
                <SendIcon size={20} />
              </button>
            </form>
          </>
        )}
      </main>

      {/* ══ RIGHT: Info Panel ══ */}
      {showInfoPanel && activeConv && (
        <aside className="w-[340px] bg-white border-l border-border-dim flex flex-col shrink-0 animate-in slide-in-from-right duration-300">
          <div className="px-6 py-5 border-b border-border-dim flex items-center justify-between bg-white sticky top-0 z-10">
            <h3 className="font-bold text-text-primary uppercase tracking-widest text-[11px]">Chat Info</h3>
            <button 
              onClick={() => setShowInfoPanel(false)}
              className="w-8 h-8 rounded-lg hover:bg-gray-100 text-text-secondary transition-colors"
            >✕</button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Header / Avatar */}
            <div className="flex flex-col items-center py-10 px-8 text-center border-b border-dashed border-border-dim">
              {activeConv.kind === 'dm' ? (
                <>
                  <div className="w-24 h-24 rounded-full bg-primary/5 border-2 border-primary/20 flex items-center justify-center mb-4 overflow-hidden shadow-lg">
                    {otherProfile?.avatar_url ? (
                      <img src={otherProfile.avatar_url} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-3xl font-black text-primary">{convName(activeConv)[0]}</span>
                    )}
                  </div>
                  <h4 className="text-xl font-bold text-text-primary">{convName(activeConv)}</h4>
                  <p className="text-sm font-medium text-text-secondary mt-1">{otherProfile?.cf_handle ? `@${otherProfile.cf_handle}` : ''}</p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <span className="px-3 py-1 rounded-full bg-gray-100 text-[10px] font-bold text-text-secondary border border-border-dim uppercase tracking-wider">
                      {convSub(activeConv).replace('·', '|')}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-24 h-24 rounded-2xl bg-primary text-white flex items-center justify-center mb-4 shadow-lg text-4xl">
                    <UsersIcon size={40} />
                  </div>
                  {editingGroup ? (
                    <div className="space-y-3 w-full">
                      <input 
                        className="input text-center font-bold" 
                        value={editName} 
                        onChange={e => setEditName(e.target.value)} 
                        placeholder="Group Name"
                      />
                      <textarea 
                        className="input text-center text-sm min-h-[80px]" 
                        value={editDesc} 
                        onChange={e => setEditDesc(e.target.value)} 
                        placeholder="Description"
                      />
                      <div className="flex gap-2">
                        <button onClick={saveGroupInfo} className="btn-primary flex-1 py-2 text-xs">SAVE</button>
                        <button onClick={() => setEditingGroup(false)} className="btn-secondary flex-1 py-2 text-xs">CANCEL</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xl font-bold text-text-primary">{activeConv.name}</h4>
                        {activeConv.members?.find(m => m.user_id === user?.id)?.is_admin && (
                          <button 
                            onClick={() => { setEditName(activeConv.name); setEditDesc(activeConv.description || ''); setEditingGroup(true) }}
                            className="text-text-secondary hover:text-primary transition-colors"
                          >
                            <EditIcon size={14} />
                          </button>
                        )}
                      </div>
                      <p className="text-sm font-medium text-text-secondary mt-2 max-w-[200px] leading-relaxed italic">{activeConv.description || 'No description set'}</p>
                    </>
                  )}
                </>
              )}
            </div>

            {/* Group Members List */}
            {activeConv.kind === 'group' && (
              <div className="p-6 border-b border-dashed border-border-dim">
                <div className="flex items-center justify-between mb-4">
                  <h5 className="section-label">MEMBERS ({activeConv.members?.length})</h5>
                </div>
                <div className="space-y-3">
                  {activeConv.members?.map(m => (
                    <div key={m.user_id} className="flex items-center gap-3">
                      <Avatar name={m.name} size={8} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-bold text-text-primary truncate">{m.name}</p>
                        <p className="text-[11px] text-text-secondary font-medium truncate">{m.branch} · Y{m.year}</p>
                      </div>
                      {m.is_admin && (
                        <span className="text-[9px] font-black bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/20 uppercase tracking-tighter">Admin</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Shared Media */}
            <div className="p-6">
              <h5 className="section-label mb-4">SHARED MEDIA</h5>
              
              {loadingMedia ? (
                <div className="grid grid-cols-3 gap-2">
                  {[1,2,3,4,5,6].map(i => (
                    <div key={i} className="aspect-square bg-gray-100 rounded-lg animate-pulse border border-border-dim" />
                  ))}
                </div>
              ) : sharedMedia.length === 0 ? (
                <div className="bg-gray-50 rounded-xl py-10 px-6 text-center border border-border-dim border-dashed">
                  <p className="text-xs font-bold text-text-secondary/50 italic">No media shared yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {sharedMedia.map(m => (
                    <div 
                      key={m.messageId} 
                      className="aspect-square rounded-lg overflow-hidden border border-border-dim bg-gray-100 cursor-pointer hover:brightness-75 transition-all group relative"
                      onClick={() => setLightboxImage(m.media_url)}
                    >
                      <img src={m.media_url} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-1">
                        <span className="text-[8px] text-white font-bold truncate">{m.sender_name}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </aside>
      )}

      {/* ══ Forward Picker Modal ══ */}
      {showForwardPicker && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
          <div className="bg-white border border-border-dim rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-border-dim flex justify-between items-center">
              <h3 className="text-text-primary font-bold text-lg">Forward Message</h3>
              <button onClick={() => setShowForwardPicker(false)} className="w-8 h-8 rounded-lg bg-gray-100 text-text-secondary hover:bg-gray-200 flex items-center justify-center transition-colors">✕</button>
            </div>
            <div className="max-h-96 overflow-y-auto divide-y divide-dashed divide-border-dim">
              {conversations.map(c => (
                <button
                  key={c.id}
                  onClick={() => forwardMessage(c.id)}
                  className="w-full px-6 py-4 hover:bg-gray-50 text-left flex items-center gap-4 transition-colors"
                >
                  <Avatar name={convName(c)} size={9} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-text-primary truncate">{convName(c)}</p>
                    <p className="text-xs text-text-secondary font-medium mt-0.5">{c.kind === 'group' ? 'Group' : 'Direct Message'}</p>
                  </div>
                  <span className="text-primary text-xs font-black uppercase tracking-wider">Send</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══ Group creation modal ══ */}
      {showGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
          <div className="bg-white border border-border-dim rounded-2xl p-8 w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-bold text-text-primary">Create Group Chat</h2>
              <button onClick={() => { setShowGroupModal(false); setSelectedMembers([]); setGroupName(''); setGroupDesc('') }}
                className="w-8 h-8 rounded-lg bg-gray-100 text-text-secondary hover:bg-gray-200 flex items-center justify-center transition-colors">✕</button>
            </div>
            <form onSubmit={createGroup} className="space-y-6">
              <div>
                <label className="section-label block mb-2">Group Name *</label>
                <input className="input" placeholder="e.g. CP Study Group" value={groupName} onChange={e => setGroupName(e.target.value)} required />
              </div>
              <div>
                <label className="section-label block mb-2">Description</label>
                <input className="input" placeholder="What is this group about?" value={groupDesc} onChange={e => setGroupDesc(e.target.value)} />
              </div>
              <div>
                <label className="section-label block mb-2">Search & Add Members</label>
                <input
                  className="input mb-3"
                  placeholder="Search users by name…"
                  value={searchQ}
                  onChange={e => setSearchQ(e.target.value)}
                />
                <div className="max-h-40 overflow-y-auto space-y-1 border border-border-dim rounded-xl p-1 bg-gray-50">
                  {searchResults.filter(u => !selectedMembers.find(s => s.user_id === u.user_id)).map(u => (
                    <button type="button" key={u.user_id}
                      onClick={() => setSelectedMembers(prev => [...prev, u])}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white border border-transparent hover:border-border-dim text-left transition-all">
                      <Avatar name={u.name} size={8} />
                      <div className="min-w-0">
                        <span className="text-sm font-bold text-text-primary block truncate">{u.name}</span>
                        <span className="text-xs text-text-secondary font-medium">{u.branch} · Y{u.year}</span>
                      </div>
                      <span className="ml-auto text-primary text-xs font-black">+ ADD</span>
                    </button>
                  ))}
                </div>
                {selectedMembers.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-4">
                    {selectedMembers.map(m => (
                      <span key={m.user_id} className="flex items-center gap-1.5 bg-primary/5 text-primary text-xs px-3 py-1.5 rounded-full border border-primary/20 font-bold">
                        {m.name}
                        <button type="button" onClick={() => setSelectedMembers(prev => prev.filter(s => s.user_id !== m.user_id))} className="hover:text-danger transition-colors ml-0.5 font-extrabold">×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-4 pt-2">
                <button type="button" onClick={() => { setShowGroupModal(false); setSelectedMembers([]); setGroupName(''); setGroupDesc('') }}
                  className="btn-secondary flex-1 py-3">Cancel</button>
                <button type="submit" disabled={!groupName.trim() || selectedMembers.length < 1}
                  className="btn-primary flex-1 py-3">Create Group</button>
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
  return <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
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
function ShareIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>
    </svg>
  )
}
function CameraIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
    </svg>
  )
}
