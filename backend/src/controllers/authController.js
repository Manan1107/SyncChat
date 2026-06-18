import bcrypt from 'bcrypt'
import User from '../models/User.js'
import { signJwt } from '../middleware/auth.js'
import { validatePasswordPolicy } from '../utils/password.js'

export async function register(req, res) {
  const { email, username, password, name } = req.body || {}
  if (!email || !username || !password) return res.status(400).json({ message: 'Missing fields' })
  const validation = validatePasswordPolicy(password, { username, email })
  if (!validation.ok) return res.status(400).json({ message: validation.errors.join('. ') })
  const exists = await User.findOne({ $or: [{ email: email.toLowerCase() }, { username: username.toLowerCase() }] })
  if (exists) return res.status(409).json({ message: 'Email or username already exists' })
  const passwordHash = await bcrypt.hash(password, 10)
  const user = await User.create({ email: email.toLowerCase(), username: username.toLowerCase(), name, passwordHash })
  const token = signJwt({ id: user._id, email: user.email, username: user.username })
  res.status(201).json({ user: sanitize(user), token })
}

export async function login(req, res) {
  const { identifier, password } = req.body || {}
  if (!identifier || !password) return res.status(400).json({ message: 'Missing fields' })
  const id = String(identifier).toLowerCase()
  const user = await User.findOne({ $or: [{ email: id }, { username: id }] })
  if (!user) return res.status(401).json({ message: 'Invalid credentials' })
  const ok = await bcrypt.compare(password, user.passwordHash)
  if (!ok) return res.status(401).json({ message: 'Invalid credentials' })
  const token = signJwt({ id: user._id, email: user.email, username: user.username })
  res.json({ user: sanitize(user), token })
}

function sanitize(user) {
  const obj = user.toObject()
  delete obj.passwordHash
  return obj
}


