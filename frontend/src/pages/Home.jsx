import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Home() {
  const { currentUser } = useAuth()
  
  return (
    <div className="home">
      <div className="hero">
        <div className="badge">Welcome {currentUser ? `@${currentUser.username}` : ''}</div>
        <h1>ChatApp Realtime</h1>
        <p className="muted">Fast, reliable text chat with 1-to-1 and groups. Create groups by username, see presence, and view your chat history.</p>
        <div className="hero-actions">
          <Link className="primary-btn" to="/chat">Open Chats</Link>
        </div>
      </div>
    </div>
  )
}


