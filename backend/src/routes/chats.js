import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { listChats, createGroup, getMessages, sendMessage, getOrCreateDm, listUsers, devSeedUsers, deleteGroup, leaveGroup, addMembersToGroup, removeMemberFromGroup } from '../controllers/chatController.js'

const router = Router()

router.use(requireAuth)

router.get('/users', listUsers)
router.get('/chats', listChats)
router.post('/chats/group', createGroup)
router.post('/chats/dm', getOrCreateDm)
router.get('/chats/:chatId/messages', getMessages)
router.post('/chats/:chatId/messages', sendMessage)
router.delete('/chats/:chatId', deleteGroup)
router.post('/chats/:chatId/leave', leaveGroup)
router.post('/chats/:chatId/add-members', addMembersToGroup)
router.delete('/chats/:chatId/members/:memberId', removeMemberFromGroup)

// Dev-only: seed some users for testing
router.post('/dev/seed-users', devSeedUsers)

export default router


