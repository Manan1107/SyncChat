import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import mongoose from 'mongoose'
import { createServer } from 'http'
import { Server } from 'socket.io'
import authRoutes from './routes/auth.js'
import chatRoutes from './routes/chats.js'
import { setSocketIO } from './controllers/chatController.js'

const app = express()
const server = createServer(app)

// Allow Vite dev server on common ports and optional FRONTEND_URL
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  process.env.FRONTEND_URL
].filter(Boolean)

app.use(cors({ origin: allowedOrigins, credentials: true }))
app.use(express.json())
app.use(morgan('dev'))

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
})

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/chatapp'
const PORT = process.env.PORT || 4000

mongoose.set('strictQuery', true)
mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log('MongoDB connected')
  })
  .catch(err => {
    console.error('Mongo connection error', err)
    process.exit(1)
  })

app.get('/api/health', (req, res) => {
  res.json({ ok: true })
})

app.use('/api/auth', authRoutes)
app.use('/api', chatRoutes)

// Pass Socket.IO instance to chat controller
setSocketIO(io)

app.use((err, req, res, _next) => {
  console.error(err)
  res.status(err.status || 500).json({ message: err.message || 'Server error' })
})

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id)

  // Join user to their personal room
  socket.on('join-user', (userId) => {
    socket.join(`user-${userId}`)
    console.log(`User ${userId} joined their room`)
  })

  // Join chat room
  socket.on('join-chat', (chatId) => {
    socket.join(`chat-${chatId}`)
    console.log(`User joined chat: ${chatId}`)
  })

  // Leave chat room
  socket.on('leave-chat', (chatId) => {
    socket.leave(`chat-${chatId}`)
    console.log(`User left chat: ${chatId}`)
  })

  // Handle new message
  socket.on('send-message', async (data) => {
    try {
      const { chatId, message, senderId } = data
      
      // Broadcast message to all users in the chat room
      io.to(`chat-${chatId}`).emit('new-message', {
        id: message._id,
        chatId: message.chatId,
        senderId: message.senderId,
        text: message.text,
        createdAt: message.createdAt
      })
      
      console.log(`Message sent in chat ${chatId}:`, message.text)
    } catch (error) {
      console.error('Error handling message:', error)
      socket.emit('error', { message: 'Failed to send message' })
    }
  })

  // Handle user typing
  socket.on('typing', (data) => {
    socket.to(`chat-${data.chatId}`).emit('user-typing', {
      userId: data.userId,
      username: data.username,
      isTyping: data.isTyping
    })
  })

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id)
  })
})

server.listen(PORT, () => {
  console.log(`API server listening on http://localhost:${PORT}`)
  console.log(`Socket.IO server running on port ${PORT}`)
})


