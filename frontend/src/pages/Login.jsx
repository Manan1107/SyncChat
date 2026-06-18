import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const onSubmit = async e => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(form.email.trim(), form.password)
      navigate('/app')
    } catch (err) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h2>ChatApp Realtime</h2>
        <p className="muted">Sign in to continue</p>
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
            <span>Password</span>
            <input
              type="password"
              placeholder="Enter your password"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              required
            />
          </label>
          <button disabled={loading} className="primary-btn" type="submit">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <p className="muted small">
          No account? <Link to="/signup">Create one</Link>
        </p>
      </div>
    </div>
  )
}


