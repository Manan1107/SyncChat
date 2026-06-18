// Simple localStorage-backed mock API for demoing the UI without a backend

const USERS_KEY = 'chatapp_users'
const MESSAGES_KEY = 'chatapp_messages'
const GROUPS_KEY = 'chatapp_groups'

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw)
  } catch (_) {
    return fallback
  }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function ensureSeed() {
  const users = read(USERS_KEY, null)
  if (!users) {
    const seeded = [
      { id: 'u_alice', email: 'alice@example.com', name: 'Alice Johnson', username: 'alice', passwordHash: hash('alice123') },
      { id: 'u_bob', email: 'bob@example.com', name: 'Bob Smith', username: 'bob', passwordHash: hash('bob123') },
      { id: 'u_carol', email: 'carol@example.com', name: 'Carol Lee', username: 'carol', passwordHash: hash('carol123') }
    ]
    write(USERS_KEY, seeded)
  }
  if (!read(MESSAGES_KEY, null)) write(MESSAGES_KEY, {})
  if (!read(GROUPS_KEY, null)) write(GROUPS_KEY, [])
}

function hash(password) {
  // Mock hashing for demo only
  try {
    return 'hash_' + btoa(password)
  } catch (_) {
    return 'hash_' + password
  }
}

export async function register({ email, username, password }) {
  ensureSeed()
  const users = read(USERS_KEY, [])
  if (users.some(u => (u.username || '').toLowerCase() === String(username).toLowerCase())) {
    throw new Error('Username already exists')
  }
  if (users.some(u => (u.email || '').toLowerCase() === String(email).toLowerCase())) {
    throw new Error('Email already exists')
  }
  // Password policy: 8-128 chars, at least one uppercase and one special
  const errors = []
  const pwd = String(password)
  if (pwd.length < 8 || pwd.length > 128) errors.push('8-128 characters')
  if (!/[A-Z]/.test(pwd)) errors.push('one uppercase')
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>\/?`~]/.test(pwd)) errors.push('one special')
  if (errors.length) throw new Error('Weak password: ' + errors.join(', '))
  const user = { id: uid('u'), email, username, passwordHash: hash(password) }
  users.push(user)
  write(USERS_KEY, users)
  const token = uid('token')
  return { user: sanitizeUser(user), token }
}

export async function login(identifier, password) {
  ensureSeed()
  const users = read(USERS_KEY, [])
  const id = String(identifier).toLowerCase()
  const user = users.find(u =>
    (u.username && u.username.toLowerCase() === id) ||
    (u.email && u.email.toLowerCase() === id)
  )
  if (!user || user.passwordHash !== hash(password)) {
    throw new Error('Invalid credentials')
  }
  const token = uid('token')
  return { user: sanitizeUser(user), token }
}

export function listUsers() {
  ensureSeed()
  const users = read(USERS_KEY, [])
  return users.map(u => ({ ...sanitizeUser(u), online: Math.random() > 0.4 }))
}

export function findUserByUsername(username) {
  const users = read(USERS_KEY, [])
  return users.find(u => (u.username || '').toLowerCase() === String(username).toLowerCase())
}

export function findUserById(id) {
  const users = read(USERS_KEY, [])
  return users.find(u => u.id === id)
}

export function getOrCreateDirectChatId(userIdA, userIdB) {
  const [a, b] = [userIdA, userIdB].sort()
  return `dm_${a}_${b}`
}

export function listChatsForUser(userId) {
  ensureSeed()
  const users = read(USERS_KEY, [])
  const groups = read(GROUPS_KEY, [])
  const others = users.filter(u => u.id !== userId)
  const dms = others.map(u => ({
    id: getOrCreateDirectChatId(userId, u.id),
    type: 'dm',
    title: `@${u.username}`,
    peerId: u.id,
    online: Math.random() > 0.4
  }))
  const memberGroups = groups.filter(g => g.memberIds.includes(userId)).map(g => ({
    id: g.id,
    type: 'group',
    title: g.name,
    memberIds: g.memberIds
  }))
  return [...dms, ...memberGroups]
}

export function getMessages(chatId) {
  ensureSeed()
  const all = read(MESSAGES_KEY, {})
  return all[chatId] || []
}

export function sendMessage(chatId, senderId, text) {
  ensureSeed()
  const all = read(MESSAGES_KEY, {})
  const msg = { id: uid('m'), chatId, senderId, text, createdAt: Date.now() }
  const list = all[chatId] || []
  list.push(msg)
  all[chatId] = list
  write(MESSAGES_KEY, all)
  return msg
}

export function createGroup(name, memberIds) {
  ensureSeed()
  const groups = read(GROUPS_KEY, [])
  const id = uid('grp')
  const distinct = Array.from(new Set(memberIds))
  const group = { id, name, memberIds: distinct }
  groups.push(group)
  write(GROUPS_KEY, groups)
  return group
}

function sanitizeUser(u) {
  const { passwordHash, ...rest } = u
  return rest
}


