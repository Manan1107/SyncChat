import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Signup() {
  const { signup } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', username: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [passwordHint, setPasswordHint] = useState('')

  const onSubmit = async e => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      // simplified client-side password validation mirrors backend
      const pwd = form.password
      const errs = []
      if (pwd.length < 8 || pwd.length > 128) errs.push('8-128 chars')
      if (!/[A-Z]/.test(pwd)) errs.push('uppercase')
      if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>\/?`~]/.test(pwd)) errs.push('special')
      if (errs.length) {
        setError('Weak password: ' + errs.join(', '))
        setLoading(false)
        return
      }
      await signup(form.email.trim(), form.username.trim(), form.password)
      navigate('/app')
    } catch (err) {
      setError(err.message || 'Signup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h2>Create your account</h2>
        <p className="muted">Join ChatApp Realtime</p>
        {error ? <div className="error-banner">{error}</div> : null}
        <form onSubmit={onSubmit} className="form">
          <label>
            <span>Email</span>
            <input
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              required
            />
          </label>
          <label>
            <span>Username</span>
            <input
              placeholder="Choose a username"
              value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              required
            />
          </label>
          <label>
            <span>Password</span>
            <input
              type="password"
              placeholder="Create a password"
              value={form.password}
              onChange={e => {
                const val = e.target.value
                setForm(f => ({ ...f, password: val }))
                // live hint
                const errs = []
                if (val.length < 8) errs.push('8+ chars')
                if (!/[A-Z]/.test(val)) errs.push('uppercase')
                if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>\/?`~]/.test(val)) errs.push('special')
                setPasswordHint(errs.length ? 'Needs: ' + errs.join(', ') : 'Looks good')
              }}
              required
            />
            {passwordHint ? <div className="muted small">{passwordHint}</div> : null}
          </label>
          <button disabled={loading} className="primary-btn" type="submit">
            {loading ? 'Creating...' : 'Create Account'}
          </button>
        </form>
        <p className="muted small">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  )
}


