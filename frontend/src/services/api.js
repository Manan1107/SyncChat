const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

function getToken() {
  try {
    // Try the current tab session first, then fall back to the most recent session
    const sessionId = sessionStorage.getItem('chatapp_session_id')
    const tryKeys = []
    if (sessionId) tryKeys.push(`chatapp_session_${sessionId}`)
    // add most recent as fallback
    let latestKey = null
    let latestTs = 0
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('chatapp_session_')) {
        const raw = localStorage.getItem(key)
        try {
          const data = JSON.parse(raw)
          if (data && data.timestamp && data.timestamp > latestTs) {
            latestTs = data.timestamp
            latestKey = key
          }
        } catch (_) {}
      }
    }
    if (latestKey && !tryKeys.includes(latestKey)) tryKeys.push(latestKey)

    let sessionData = null
    let usedKey = null
    for (const key of tryKeys) {
      const raw = localStorage.getItem(key)
      if (!raw) continue
      try {
        const parsed = JSON.parse(raw)
        if (parsed && parsed.user && parsed.timestamp) {
          sessionData = parsed
          usedKey = key
          break
        }
      } catch (_) {}
    }
    if (!sessionData) return null
    if (sessionData.user && sessionData.user.token && sessionData.timestamp) {
      // Check if session is still valid
      const now = Date.now()
      const maxAge = 7 * 24 * 60 * 60 * 1000 // 7 days
      if ((now - sessionData.timestamp) < maxAge) {
        console.log('Token found and valid')
        // align this tab's session id with the used key
        try {
          const idFromKey = usedKey.replace('chatapp_session_', '')
          sessionStorage.setItem('chatapp_session_id', idFromKey)
        } catch (_) {}
        return sessionData.user.token
      } else {
        console.log('Session expired')
      }
    } else {
      console.log('Invalid session data structure')
    }
    return null
  } catch (error) {
    console.error('Error getting token:', error)
    return null
  }
}

async function request(path, { method = 'GET', body, auth = false } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (auth) {
    const token = getToken()
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    } else {
      console.error('No token found for authenticated request to:', path)
    }
  }
  
  console.log(`Making ${method} request to:`, `${BASE_URL}${path}`, { headers, body })
  
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    console.error(`Request failed: ${res.status}`, err)
    throw new Error(err.message || `Request failed: ${res.status}`)
  }
  return res.json()
}

// Auth
export function apiRegister({ email, username, password }) {
  return request('/api/auth/register', { method: 'POST', body: { email, username, password } })
}

export function apiLogin({ identifier, password }) {
  return request('/api/auth/login', { method: 'POST', body: { identifier, password } })
}

// Chats
export function apiListChats() {
  return request('/api/chats', { auth: true })
}

export function apiCreateGroup({ name, memberUsernames }) {
  return request('/api/chats/group', { method: 'POST', auth: true, body: { name, memberUsernames } })
}

export function apiEnsureDm({ peerId }) {
  return request('/api/chats/dm', { method: 'POST', auth: true, body: { peerId } })
}

export function apiGetMessages(chatId) {
  return request(`/api/chats/${chatId}/messages`, { auth: true })
}

export function apiSendMessage(chatId, text) {
  return request(`/api/chats/${chatId}/messages`, { method: 'POST', auth: true, body: { text } })
}

export function apiListUsers() {
  return request('/api/users', { auth: true })
}

export function apiDeleteGroup(chatId) {
  return request(`/api/chats/${chatId}`, { method: 'DELETE', auth: true })
}

export function apiLeaveGroup(chatId) {
  return request(`/api/chats/${chatId}/leave`, { method: 'POST', auth: true })
}

export function apiAddMembersToGroup(chatId, memberUsernames) {
  return request(`/api/chats/${chatId}/add-members`, { method: 'POST', auth: true, body: { memberUsernames } })
}

export function apiRemoveMemberFromGroup(chatId, memberId) {
  return request(`/api/chats/${chatId}/members/${memberId}`, { method: 'DELETE', auth: true })
}

export function apiSeedUsers() {
  return request('/api/dev/seed-users', { method: 'POST', auth: true })
}


