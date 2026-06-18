

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { SocketProvider } from './context/SocketContext'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Home from './pages/Home'
import ChatHome from './pages/ChatHome'
import './index.css'

function PrivateRoute({ children }) {
  const { currentUser, hydrated } = useAuth()
  if (!hydrated) return null
  if (!currentUser) return <Navigate to="/login" replace />
  return children
}

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/app" element={<PrivateRoute><Home /></PrivateRoute>} />
            <Route path="/chat" element={<PrivateRoute><ChatHome /></PrivateRoute>} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </BrowserRouter>
      </SocketProvider>
    </AuthProvider>
  )
}

export default App
