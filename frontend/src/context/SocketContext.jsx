import { createContext, useContext, useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import { useAuth } from './AuthContext'

const SocketContext = createContext(null)

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null)
  const [connected, setConnected] = useState(false)
  const { currentUser } = useAuth()

  useEffect(() => {
    if (currentUser) {
      const newSocket = io(import.meta.env.VITE_API_URL || 'http://localhost:4000', {
        auth: {
          token: currentUser.token
        }
      })

      newSocket.on('connect', () => {
        console.log('Connected to server')
        setConnected(true)
        
        // Join user to their personal room
        newSocket.emit('join-user', currentUser._id)
      })

      newSocket.on('disconnect', () => {
        console.log('Disconnected from server')
        setConnected(false)
      })

      newSocket.on('error', (error) => {
        console.error('Socket error:', error)
      })

      setSocket(newSocket)

      return () => {
        newSocket.close()
        setSocket(null)
        setConnected(false)
      }
    } else {
      if (socket) {
        socket.close()
        setSocket(null)
        setConnected(false)
      }
    }
  }, [currentUser])

  const joinChat = (chatId) => {
    if (socket) {
      socket.emit('join-chat', chatId)
    }
  }

  const leaveChat = (chatId) => {
    if (socket) {
      socket.emit('leave-chat', chatId)
    }
  }

  const sendMessage = (chatId, message) => {
    if (socket) {
      socket.emit('send-message', {
        chatId,
        message,
        senderId: currentUser._id
      })
    }
  }

  const sendTyping = (chatId, isTyping) => {
    if (socket) {
      socket.emit('typing', {
        chatId,
        userId: currentUser._id,
        username: currentUser.username,
        isTyping
      })
    }
  }

  const value = {
    socket,
    connected,
    joinChat,
    leaveChat,
    sendMessage,
    sendTyping
  }

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
}

export function useSocket() {
  const ctx = useContext(SocketContext)
  if (!ctx) throw new Error('useSocket must be used within SocketProvider')
  return ctx
}
