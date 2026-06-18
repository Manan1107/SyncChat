import jwt from 'jsonwebtoken'

export function signJwt(payload) {
  const secret = process.env.JWT_SECRET || 'change-me'
  return jwt.sign(payload, secret, { expiresIn: '7d' })
}

export function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : null
    if (!token) return res.status(401).json({ message: 'Unauthorized' })
    const secret = process.env.JWT_SECRET || 'change-me'
    const decoded = jwt.verify(token, secret)
    req.user = decoded
    next()
  } catch (err) {
    return res.status(401).json({ message: 'Unauthorized' })
  }
}


