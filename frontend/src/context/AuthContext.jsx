import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { apiLogin, apiRegister } from '../services/api'

const AuthContext = createContext(null)

// Generate or retrieve unique session ID for this browser tab/window
function getOrCreateSessionId() {
  const existingId = sessionStorage.getItem('chatapp_session_id')
  if (existingId) {
    return existingId
  }
  const newId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  sessionStorage.setItem('chatapp_session_id', newId)
  return newId
}

const SESSION_ID = getOrCreateSessionId()

// Session management functions
function getSessionKey() {
  return `chatapp_session_${SESSION_ID}`
}

function getAllSessions() {
  const sessions = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith('chatapp_session_')) {
      try {
        const sessionData = JSON.parse(localStorage.getItem(key))
        sessions.push({ key, data: sessionData })
      } catch (e) {
        // Clean up corrupted session data
        localStorage.removeItem(key)
      }
    }
  }
  return sessions
}

function cleanupOldSessions() {
  const sessions = getAllSessions()
  const now = Date.now()
  const maxAge = 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
  
  sessions.forEach(({ key, data }) => {
    if (data.timestamp && (now - data.timestamp) > maxAge) {
      localStorage.removeItem(key)
    }
  })
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    // Clean up old sessions on app start
    cleanupOldSessions()
    
    let sessionKey = getSessionKey()
    console.log('Looking for session with key:', sessionKey)
    const stored = localStorage.getItem(sessionKey)
    if (stored) {
      try {
        const sessionData = JSON.parse(stored)
        console.log('Found session data:', sessionData)
        if (sessionData.user && sessionData.timestamp) {
          // Check if session is still valid (not expired)
          const now = Date.now()
          const maxAge = 7 * 24 * 60 * 60 * 1000 // 7 days
          if ((now - sessionData.timestamp) < maxAge) {
            console.log('Session valid, setting current user:', sessionData.user.username)
            setCurrentUser(sessionData.user)
          } else {
            console.log('Session expired, cleaning up')
            localStorage.removeItem(sessionKey)
          }
        } else {
          console.log('Invalid session data structure')
        }
      } catch (error) {
        console.error('Error parsing session data:', error)
        localStorage.removeItem(sessionKey)
      }
    }
    setHydrated(true)
  }, [])

  const login = async (email, password) => {
    const { user, token } = await apiLogin({ identifier: email, password })
    const authUser = { ...user, token }
    const sessionData = {
      user: authUser,
      timestamp: Date.now()
    }
    setCurrentUser(authUser)
    localStorage.setItem(getSessionKey(), JSON.stringify(sessionData))
    return authUser
  }

  const signup = async (email, username, password) => {
    const { user, token } = await apiRegister({ email, username, password })
    const authUser = { ...user, token }
    const sessionData = {
      user: authUser,
      timestamp: Date.now()
    }
    setCurrentUser(authUser)
    localStorage.setItem(getSessionKey(), JSON.stringify(sessionData))
    return authUser
  }

  const logout = () => {
    setCurrentUser(null)
    localStorage.removeItem(getSessionKey())
    // Also clear the session ID from sessionStorage
    sessionStorage.removeItem('chatapp_session_id')
  }

  const value = useMemo(() => ({ currentUser, hydrated, login, signup, logout }), [currentUser, hydrated])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}


