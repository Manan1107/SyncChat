import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import { apiListChats, apiGetMessages, apiSendMessage, apiCreateGroup, apiListUsers, apiEnsureDm, apiDeleteGroup, apiLeaveGroup, apiAddMembersToGroup, apiRemoveMemberFromGroup, apiSeedUsers } from '../services/api'

export default function ChatHome() {
  const { currentUser, logout } = useAuth()
  const { socket, connected, joinChat, leaveChat, sendMessage: socketSendMessage, sendTyping } = useSocket()
  const navigate = useNavigate()
  const [chats, setChats] = useState([])
  const [users, setUsers] = useState([])
  const [activeChatId, setActiveChatId] = useState(null)
  const [showGroupInfo, setShowGroupInfo] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [groupForm, setGroupForm] = useState({ name: '', members: '' })
  const [typingUsers, setTypingUsers] = useState([])
  const [isTyping, setIsTyping] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState({ users: [], groups: [] })
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [addMembersInput, setAddMembersInput] = useState('')
  const [showAddMembers, setShowAddMembers] = useState(false)
  const [selectedMemberToRemove, setSelectedMemberToRemove] = useState(null)
  const typingTimeoutRef = useRef(null)
  const scrollRef = useRef(null)

  useEffect(() => {
    if (!currentUser) return
    ;(async () => {
      try {
        const [chatsRes, usersRes] = await Promise.allSettled([
          apiListChats(),
          apiListUsers()
        ])

        if (chatsRes.status === 'fulfilled') {
          const mapped = chatsRes.value.map(c => ({
            id: c._id,
            type: c.type,
            title: c.type === 'group' ? (c.title || 'Group') : c.title || 'Direct Message',
            memberIds: c.memberIds,
            creatorId: c.creatorId,
            createdAt: c.createdAt,
          }))
          setChats(mapped)
          const storedChatId = localStorage.getItem('chatapp_active_chat_id')
          if (storedChatId && mapped.find(c => c.id === storedChatId)) {
            setActiveChatId(storedChatId)
          } else if (mapped.length) {
            setActiveChatId(mapped[0].id)
          }
        } else {
          console.error('Failed to load chats:', chatsRes.reason)
        }

        if (usersRes.status === 'fulfilled') {
          setUsers(usersRes.value)
        } else {
          console.warn('First attempt to load users failed, retrying...', usersRes.reason)
          try {
            const retry = await apiListUsers()
            setUsers(retry)
          } catch (err) {
            console.error('Failed to load users after retry:', err)
            setUsers([])
          }
        }
      } catch (err) {
        console.error('Error initializing data:', err)
      }
    })()
  }, [currentUser])

  useEffect(() => {
    if (!activeChatId) return
    setShowGroupInfo(false)
    ;(async () => {
      try {
        const data = await apiGetMessages(activeChatId)
        const mapped = data.map(m => ({ id: m._id, senderId: m.senderId, text: m.text, createdAt: m.createdAt }))
        setMessages(mapped)
      } catch (_) {}
    })()
  }, [activeChatId])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages])

  const activeChat = useMemo(() => chats.find(c => c.id === activeChatId) || null, [chats, activeChatId])

  // Store active chat ID in localStorage whenever it changes
  useEffect(() => {
    if (activeChatId) {
      localStorage.setItem('chatapp_active_chat_id', activeChatId)
    }
  }, [activeChatId])

  // Socket.IO event listeners
  useEffect(() => {
    if (!socket) return

    const handleNewMessage = (message) => {
      setMessages(prev => [...prev, message])
    }

    const handleUserTyping = (data) => {
      if (data.isTyping) {
        setTypingUsers(prev => [...prev.filter(u => u.userId !== data.userId), data])
      } else {
        setTypingUsers(prev => prev.filter(u => u.userId !== data.userId))
      }
    }

    socket.on('new-message', handleNewMessage)
    socket.on('user-typing', handleUserTyping)

    return () => {
      socket.off('new-message', handleNewMessage)
      socket.off('user-typing', handleUserTyping)
    }
  }, [socket])

  // Join/leave chat rooms when active chat changes
  useEffect(() => {
    if (activeChatId && connected) {
      joinChat(activeChatId)
      return () => leaveChat(activeChatId)
    }
  }, [activeChatId, connected, joinChat, leaveChat])

  const userIdToUsername = useMemo(() => {
    const map = new Map()
    users.forEach(u => map.set(String(u._id), u.username))
    if (currentUser?._id) map.set(String(currentUser._id), currentUser.username)
    return map
  }, [users, currentUser])

  // Search functionality
  const handleSearch = (query) => {
    setSearchQuery(query)
    if (!query.trim()) {
      setShowSearchResults(false)
      setSearchResults({ users: [], groups: [] })
      return
    }

    const searchTerm = query.toLowerCase().trim()
    
    // Filter users
    const filteredUsers = users.filter(user => 
      user.username.toLowerCase().includes(searchTerm) ||
      user.email.toLowerCase().includes(searchTerm)
    )

    // Filter groups
    const filteredGroups = chats.filter(chat => 
      chat.type === 'group' && 
      (chat.title.toLowerCase().includes(searchTerm) ||
       userIdToUsername.get(String(chat.creatorId))?.toLowerCase().includes(searchTerm))
    )

    setSearchResults({ users: filteredUsers, groups: filteredGroups })
    setShowSearchResults(true)
  }

  const clearSearch = () => {
    setSearchQuery('')
    setShowSearchResults(false)
    setSearchResults({ users: [], groups: [] })
  }

  const handleTyping = (e) => {
    setInput(e.target.value)
    
    if (!isTyping) {
      setIsTyping(true)
      sendTyping(activeChatId, true)
    }
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }
    
    // Set new timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false)
      sendTyping(activeChatId, false)
    }, 1000)
  }

  const onSend = async () => {
    const text = input.trim()
    if (!text || !activeChatId) return
    
    // Stop typing indicator
    if (isTyping) {
      setIsTyping(false)
      sendTyping(activeChatId, false)
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }
    
    try {
      const msg = await apiSendMessage(activeChatId, text)
      // Message will be added via Socket.IO event, no need to add manually
      setInput('')
    } catch (error) {
      console.error('Error sending message:', error)
    }
  }

  const onCreateGroup = e => {
    e.preventDefault()
    const name = groupForm.name.trim()
    if (!name) return
    const usernameInputs = groupForm.members.split(',').map(s => s.trim()).filter(Boolean)
    ;(async () => {
      try {
        const group = await apiCreateGroup({ name, memberUsernames: usernameInputs })
        const list = await apiListChats()
        const mapped = list.map(c => ({ id: c._id, type: c.type, title: c.type === 'group' ? (c.title || 'Group') : c.title || 'Direct Message', memberIds: c.memberIds, creatorId: c.creatorId, createdAt: c.createdAt }))
        setChats(mapped)
        setActiveChatId(group._id)
        setShowCreateGroup(false)
        setGroupForm({ name: '', members: '' })
      } catch (_) {}
    })()
  }

  const startDm = async peerId => {
    try {
      console.log('Starting DM with peerId:', peerId)
      const dm = await apiEnsureDm({ peerId })
      console.log('DM created/retrieved:', dm)
      const list = await apiListChats()
      const mapped = list.map(c => ({ id: c._id, type: c.type, title: c.type === 'group' ? (c.title || 'Group') : c.title || 'Direct Message', memberIds: c.memberIds, creatorId: c.creatorId, createdAt: c.createdAt }))
      setChats(mapped)
      setActiveChatId(dm._id)
    } catch (error) {
      console.error('Error starting DM:', error)
    }
  }

  const addUserToGroupField = user => {
    setGroupForm(f => ({ ...f, members: (f.members ? f.members + ', ' : '') + user.username }))
    setShowCreateGroup(true)
  }

  const onDeleteGroup = async () => {
    if (!activeChat || activeChat.type !== 'group') return
    try {
      await apiDeleteGroup(activeChat.id)
      const list = await apiListChats()
      const mapped = list.map(c => ({ id: c._id, type: c.type, title: c.type === 'group' ? (c.title || 'Group') : c.title || 'Direct Message', memberIds: c.memberIds, creatorId: c.creatorId, createdAt: c.createdAt }))
      setChats(mapped)
      setActiveChatId(mapped[0]?.id || null)
    } catch (_) {}
  }

  const onLeaveGroup = async () => {
    if (!activeChat || activeChat.type !== 'group') return
    try {
      const result = await apiLeaveGroup(activeChat.id)
      const list = await apiListChats()
      const mapped = list.map(c => ({ id: c._id, type: c.type, title: c.type === 'group' ? (c.title || 'Group') : c.title || 'Direct Message', memberIds: c.memberIds, creatorId: c.creatorId, createdAt: c.createdAt }))
      setChats(mapped)
      
      // If group was deleted (last member left) or user left, switch to another chat
      if (result.deleted || !mapped.find(c => c.id === activeChat.id)) {
        setActiveChatId(mapped[0]?.id || null)
      }
    } catch (error) {
      console.error('Error leaving group:', error)
    }
  }

  const onAddMembers = async (e) => {
    e.preventDefault()
    if (!activeChat || activeChat.type !== 'group' || !addMembersInput.trim()) return
    
    try {
      const usernames = addMembersInput.split(',').map(s => s.trim()).filter(Boolean)
      await apiAddMembersToGroup(activeChat.id, usernames)
      
      // Refresh chat list to show updated members
      const list = await apiListChats()
      const mapped = list.map(c => ({ id: c._id, type: c.type, title: c.type === 'group' ? (c.title || 'Group') : c.title || 'Direct Message', memberIds: c.memberIds, creatorId: c.creatorId, createdAt: c.createdAt }))
      setChats(mapped)
      
      setAddMembersInput('')
      setShowAddMembers(false)
    } catch (error) {
      console.error('Error adding members:', error)
    }
  }

  const onRemoveMember = async (memberId) => {
    if (!activeChat || activeChat.type !== 'group') return
    
    try {
      await apiRemoveMemberFromGroup(activeChat.id, memberId)
      
      // Refresh chat list to show updated members
      const list = await apiListChats()
      const mapped = list.map(c => ({ id: c._id, type: c.type, title: c.type === 'group' ? (c.title || 'Group') : c.title || 'Direct Message', memberIds: c.memberIds, creatorId: c.creatorId, createdAt: c.createdAt }))
      setChats(mapped)
      
      setSelectedMemberToRemove(null)
    } catch (error) {
      console.error('Error removing member:', error)
    }
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="app-title">ChatApp Realtime</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ 
              width: '8px', 
              height: '8px', 
              borderRadius: '50%', 
              backgroundColor: connected ? '#4caf50' : '#f44336' 
            }}></div>
            <span style={{ fontSize: '0.8rem', color: connected ? '#4caf50' : '#f44336' }}>
              {connected ? 'Connected' : 'Disconnected'}
            </span>
            <button className="secondary-btn small" onClick={() => { 
              localStorage.removeItem('chatapp_active_chat_id')
              logout(); 
              navigate('/login') 
            }}>Logout</button>
          </div>
        </div>
        <div className="user-badge">
          <div className="avatar">{currentUser.username?.[0]?.toUpperCase()}</div>
          <div>
            <div className="user-name">@{currentUser.username}</div>
            <div className="muted small">{currentUser.email}</div>
          </div>
        </div>
        <div className="sidebar-actions">
          <button className="primary-btn full" onClick={() => setShowCreateGroup(true)}>+ New Group</button>
        </div>
        <div className="search-container">
          <div className="search-input-wrapper">
            <input
              type="text"
              placeholder="Search users and groups..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="search-input"
            />
            {searchQuery && (
              <button className="search-clear" onClick={clearSearch}>
                ✕
              </button>
            )}
          </div>
        </div>
        {showSearchResults ? (
          <>
            {searchResults.users.length > 0 && (
              <div className="sidebar-section">
                <div className="section-title">Search Results - Users</div>
                <div className="chat-list">
                  {searchResults.users.map(u => (
                    <div key={u._id} className="chat-list-item search-result">
                      <div className="title">@{u.username}</div>
                      <div className="muted tiny">{u.email}</div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                        <button className="secondary-btn tiny" onClick={() => { startDm(u._id); clearSearch(); }}>Message</button>
                        <button className="secondary-btn tiny" onClick={() => { addUserToGroupField(u); clearSearch(); }}>Add to Group</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {searchResults.groups.length > 0 && (
              <div className="sidebar-section groups">
                <div className="section-title">Search Results - Groups</div>
                <div className="chat-list">
                  {searchResults.groups.map(c => (
                    <div key={c.id} style={{ position: 'relative' }}>
                      <button
                        className={`chat-list-item search-result ${activeChatId === c.id ? 'active' : ''}`}
                        onClick={() => { setActiveChatId(c.id); clearSearch(); }}
                        style={{ width: '100%' }}
                      >
                        <div className="title">{c.title}</div>
                        <div className="muted tiny">Admin: @{userIdToUsername.get(String(c.creatorId)) || 'unknown'}</div>
                      </button>
                      {c.type === 'group' && String(c.creatorId) === String(currentUser._id) ? (
                        <button
                          className="secondary-btn small"
                          title="Delete group"
                          onClick={async e => {
                            e.stopPropagation()
                            try {
                              await apiDeleteGroup(c.id)
                              const list = await apiListChats()
                              const mapped = list.map(x => ({ id: x._id, type: x.type, title: x.type === 'group' ? (x.title || 'Group') : x.title || 'Direct Message', memberIds: x.memberIds, creatorId: String(x.creatorId || '') }))
                              setChats(mapped)
                              if (activeChatId === c.id) setActiveChatId(mapped[0]?.id || null)
                              clearSearch()
                            } catch (_) {}
                          }}
                          style={{ position: 'absolute', right: 8, top: 8 }}
                        >
                          🗑
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {searchResults.users.length === 0 && searchResults.groups.length === 0 && (
              <div className="sidebar-section">
                <div className="section-title">No Results</div>
                <div className="chat-list">
                  <div className="muted small">No users or groups found matching "{searchQuery}"</div>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="sidebar-section">
              <div className="section-title">Users</div>
              <div className="chat-list">
                {users.map(u => (
                  <div key={u._id} className="chat-list-item">
                    <div className="title">@{u.username}</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                      <button className="secondary-btn tiny" onClick={() => startDm(u._id)}>Message</button>
                      <button className="secondary-btn tiny" onClick={() => addUserToGroupField(u)}>Add to Group</button>
                    </div>
                  </div>
                ))}
                {users.length === 0 ? <div className="muted small">No other users</div> : null}
              </div>
            </div>
            <div className="sidebar-section groups">
              <div className="section-title">Groups</div>
              <div className="chat-list">
                {chats.filter(c => c.type === 'group').map(c => (
                  <div key={c.id} style={{ position: 'relative' }}>
                    <button
                      className={`chat-list-item ${activeChatId === c.id ? 'active' : ''}`}
                      onClick={() => setActiveChatId(c.id)}
                      style={{ width: '100%' }}
                    >
                      <div className="title">{c.title}</div>
                      <div className="muted tiny">Admin: @{userIdToUsername.get(String(c.creatorId)) || 'unknown'}</div>
                    </button>
                    {c.type === 'group' && String(c.creatorId) === String(currentUser._id) ? (
                      <button
                        className="secondary-btn small"
                        title="Delete group"
                        onClick={async e => {
                          e.stopPropagation()
                          try {
                            await apiDeleteGroup(c.id)
                            const list = await apiListChats()
                            const mapped = list.map(x => ({ id: x._id, type: x.type, title: x.type === 'group' ? (x.title || 'Group') : x.title || 'Direct Message', memberIds: x.memberIds, creatorId: String(x.creatorId || '') }))
                            setChats(mapped)
                            if (activeChatId === c.id) setActiveChatId(mapped[0]?.id || null)
                          } catch (_) {}
                        }}
                        style={{ position: 'absolute', right: 8, top: 8 }}
                      >
                        🗑
                      </button>
                    ) : null}
                  </div>
                ))}
                {chats.filter(c => c.type === 'group').length === 0 ? <div className="muted small">No groups yet</div> : null}
              </div>
            </div>
          </>
        )}
      </aside>
      <main className="chat">
        {activeChat ? (
          <>
            <div className="chat-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div className="title" style={{ cursor: activeChat.type === 'group' ? 'pointer' : 'default' }} onClick={() => { if (activeChat.type === 'group') setShowGroupInfo(v => !v) }}>{activeChat.title}</div>
                <div className="muted small">{activeChat.type === 'group' ? 'Group chat' : 'Direct message'}</div>
              </div>
              {activeChat.type === 'group' && String(activeChat.creatorId) === String(currentUser._id) ? (
                <button className="secondary-btn small" onClick={onDeleteGroup}>Delete Group</button>
              ) : null}
            </div>
            {activeChat.type === 'group' && showGroupInfo ? (
              <div className="group-info">
                <div className="created">📅 Created: {activeChat.createdAt ? new Date(activeChat.createdAt).toLocaleString() : '—'}</div>
                <div className="admin">👑 Admin: @{userIdToUsername.get(String(activeChat.creatorId)) || 'unknown'}</div>
                <div className="members-section">
                  <div className="members-header">
                    <span>👥 Members ({activeChat.memberIds?.length || 0})</span>
                    {String(activeChat.creatorId) === String(currentUser._id) ? (
                      <button 
                        className="add-members-btn" 
                        onClick={() => setShowAddMembers(!showAddMembers)}
                      >
                        {showAddMembers ? '✕' : '+ Add Members'}
                      </button>
                    ) : null}
                  </div>
                  
                  {showAddMembers && String(activeChat.creatorId) === String(currentUser._id) && (
                    <form onSubmit={onAddMembers} className="add-members-form">
                      <input
                        type="text"
                        placeholder="Enter usernames separated by commas (e.g., alice, bob, carol)"
                        value={addMembersInput}
                        onChange={(e) => setAddMembersInput(e.target.value)}
                        className="add-members-input"
                      />
                      <div className="add-members-actions">
                        <button type="button" className="secondary-btn small" onClick={() => { setShowAddMembers(false); setAddMembersInput(''); }}>Cancel</button>
                        <button type="submit" className="primary-btn small">Add Members</button>
                      </div>
                    </form>
                  )}
                  
                  <div className="members-list">
                    {activeChat.memberIds?.map(id => {
                      const isAdmin = String(id) === String(activeChat.creatorId)
                      const isCurrentUser = String(id) === String(currentUser._id)
                      const canRemove = String(activeChat.creatorId) === String(currentUser._id) && !isCurrentUser
                      
                      return (
                        <div key={id} className={`member-item ${canRemove ? 'removable' : ''} ${isAdmin ? 'admin' : ''}`}>
                          <span className="member-name">
                            @{userIdToUsername.get(String(id)) || 'unknown'}
                            {isAdmin && <span className="admin-badge">👑</span>}
                            {isCurrentUser && <span className="you-badge">(You)</span>}
                          </span>
                          {canRemove && (
                            <button 
                              className="remove-member-btn"
                              onClick={() => setSelectedMemberToRemove(selectedMemberToRemove === id ? null : id)}
                              title="Click to remove member"
                            >
                              🗑️
                            </button>
                          )}
                          {selectedMemberToRemove === id && (
                            <div className="remove-confirmation">
                              <span>Remove @{userIdToUsername.get(String(id))}?</span>
                              <div className="remove-actions">
                                <button className="secondary-btn tiny" onClick={() => setSelectedMemberToRemove(null)}>Cancel</button>
                                <button className="remove-confirm-btn" onClick={() => onRemoveMember(id)}>Remove</button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
                
                <div className="group-actions">
                  <button className="leave-btn" onClick={onLeaveGroup}>
                    🚪 Leave Group
                  </button>
                </div>
              </div>
            ) : null}
            <div className="messages" ref={scrollRef}>
              {messages.map((m, idx) => {
                const own = String(m.senderId) === String(currentUser._id)
                const sender = userIdToUsername.get(String(m.senderId))
                const prev = messages[idx - 1]
                const isFirstOfBlock = !prev || String(prev.senderId) !== String(m.senderId)
                return (
                  <div key={m.id}>
                    {activeChat?.type === 'group' && isFirstOfBlock ? (
                      <div className="muted tiny" style={{ margin: '0 0 4px 0', textAlign: own ? 'right' : 'left' }}>@{sender || 'unknown'}</div>
                    ) : null}
                    <div className={`msg-row ${own ? 'own' : ''}`}>
                      <div className="msg">
                        <div className="text">{m.text}</div>
                        <div className="muted tiny">{new Date(m.createdAt).toLocaleTimeString()}</div>
                      </div>
                    </div>
                  </div>
                )
              })}
              {messages.length === 0 ? <div className="empty">No messages yet. Say hi!</div> : null}
              {typingUsers.length > 0 && (
                <div className="typing-indicator">
                  <div className="muted small">
                    {typingUsers.map(u => u.username).join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
                  </div>
                </div>
              )}
            </div>
            <div className="composer">
              <input
                placeholder="Type a message"
                value={input}
                onChange={handleTyping}
                onKeyDown={e => { if (e.key === 'Enter') onSend() }}
              />
              <button className="primary-btn" onClick={onSend}>Send</button>
            </div>
          </>
        ) : (
          <div className="empty">Select or create a chat to start messaging</div>
        )}
      </main>

      {showCreateGroup ? (
        <div className="modal-backdrop" onClick={() => setShowCreateGroup(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Create group</h3>
            <form onSubmit={onCreateGroup} className="form">
              <label>
                <span>Group name</span>
                <input value={groupForm.name} onChange={e => setGroupForm(f => ({ ...f, name: e.target.value }))} required />
              </label>
              <label>
                <span>Members (comma separated usernames)</span>
                <input value={groupForm.members} onChange={e => setGroupForm(f => ({ ...f, members: e.target.value }))} placeholder="alice, bob, carol" />
              </label>
              <div className="modal-actions">
                <button type="button" className="secondary-btn" onClick={() => setShowCreateGroup(false)}>Cancel</button>
                <button type="submit" className="primary-btn">Create</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}


