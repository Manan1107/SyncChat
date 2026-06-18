import Chat from '../models/Chat.js'
import Message from '../models/Message.js'
import User from '../models/User.js'

// Socket.IO instance will be passed from the main server
let io = null
export function setSocketIO(socketIO) {
  io = socketIO
}

export async function listUsers(req, res) {
  const me = req.user.id
  const users = await User.find({ _id: { $ne: me } }).select('_id email username name').sort({ username: 1 }).lean()
  res.json(users)
}

export async function listChats(req, res) {
  const userId = req.user.id
  const chats = await Chat.find({ memberIds: userId }).lean()
  const userMap = new Map()
  async function getUser(id) {
    if (!userMap.has(String(id))) {
      const u = await User.findById(id).select('_id username email').lean()
      userMap.set(String(id), u || null)
    }
    return userMap.get(String(id))
  }
  const withTitles = await Promise.all(
    chats.map(async c => {
      if (c.type === 'dm') {
        const peerId = (c.memberIds || []).map(String).find(id => id !== String(userId))
        const peer = peerId ? await getUser(peerId) : null
        return { ...c, title: peer ? `@${peer.username}` : '@direct' }
      }
      return c
    })
  )
  res.json(withTitles)
}

export async function createGroup(req, res) {
  const currentUserId = String(req.user.id)
  const { name, memberUsernames = [] } = req.body || {}
  if (!name) return res.status(400).json({ message: 'Missing group name' })
  const usernames = Array.from(new Set((memberUsernames || []).map(u => String(u).toLowerCase())))
  const users = await User.find({ username: { $in: usernames } }).select('_id username').lean()
  const foundUsernames = new Set(users.map(u => u.username))
  const missing = usernames.filter(u => !foundUsernames.has(u))
  if (missing.length) return res.status(400).json({ message: `Unknown usernames: ${missing.join(', ')}` })
  const memberIds = Array.from(new Set([currentUserId, ...users.map(u => String(u._id))]))
  const chat = await Chat.create({ type: 'group', title: name, memberIds, creatorId: currentUserId })
  res.status(201).json(chat)
}

export async function getMessages(req, res) {
  const { chatId } = req.params
  const messages = await Message.find({ chatId }).sort({ createdAt: 1 }).lean()
  res.json(messages)
}

export async function sendMessage(req, res) {
  const userId = req.user.id
  const { chatId } = req.params
  const { text } = req.body || {}
  if (!text) return res.status(400).json({ message: 'Missing text' })
  const msg = await Message.create({ chatId, senderId: userId, text })
  
  // Emit real-time message to all users in the chat
  if (io) {
    io.to(`chat-${chatId}`).emit('new-message', {
      id: msg._id,
      chatId: msg.chatId,
      senderId: msg.senderId,
      text: msg.text,
      createdAt: msg.createdAt
    })
  }
  
  res.status(201).json(msg)
}

export async function getOrCreateDm(req, res) {
  const userId = req.user.id
  const { peerId } = req.body || {}
  if (!peerId) return res.status(400).json({ message: 'Missing peerId' })
  let chat = await Chat.findOne({ type: 'dm', memberIds: { $all: [userId, peerId] } })
  if (!chat) chat = await Chat.create({ type: 'dm', memberIds: [userId, peerId], title: null })
  res.json(chat)
}

export async function deleteGroup(req, res) {
  const userId = String(req.user.id)
  const { chatId } = req.params
  const chat = await Chat.findById(chatId)
  if (!chat) return res.status(404).json({ message: 'Not found' })
  if (chat.type !== 'group') return res.status(400).json({ message: 'Not a group' })
  if (String(chat.creatorId) !== userId) return res.status(403).json({ message: 'Only creator can delete group' })
  await Message.deleteMany({ chatId })
  await Chat.deleteOne({ _id: chatId })
  res.json({ ok: true })
}

export async function leaveGroup(req, res) {
  const userId = String(req.user.id)
  const { chatId } = req.params
  const chat = await Chat.findById(chatId)
  
  if (!chat) return res.status(404).json({ message: 'Group not found' })
  if (chat.type !== 'group') return res.status(400).json({ message: 'Not a group' })
  if (!chat.memberIds.includes(userId)) return res.status(403).json({ message: 'You are not a member of this group' })
  
  // Remove user from memberIds
  const updatedMemberIds = chat.memberIds.filter(id => String(id) !== userId)
  
  // If no members left, delete the group
  if (updatedMemberIds.length === 0) {
    await Message.deleteMany({ chatId })
    await Chat.deleteOne({ _id: chatId })
    return res.json({ ok: true, deleted: true })
  }
  
  // If admin is leaving, transfer admin to next member
  let newCreatorId = chat.creatorId
  if (String(chat.creatorId) === userId) {
    newCreatorId = updatedMemberIds[0] // Transfer to first remaining member
  }
  
  // Update the chat
  await Chat.findByIdAndUpdate(chatId, {
    memberIds: updatedMemberIds,
    creatorId: newCreatorId
  })
  
  res.json({ ok: true, newAdmin: String(newCreatorId) })
}

export async function addMembersToGroup(req, res) {
  const userId = String(req.user.id)
  const { chatId } = req.params
  const { memberUsernames = [] } = req.body || {}
  
  const chat = await Chat.findById(chatId)
  if (!chat) return res.status(404).json({ message: 'Group not found' })
  if (chat.type !== 'group') return res.status(400).json({ message: 'Not a group' })
  // Only the admin (creator) can add members
  if (String(chat.creatorId) !== userId) return res.status(403).json({ message: 'Only admin can add members' })
  
  if (!memberUsernames.length) return res.status(400).json({ message: 'No usernames provided' })
  
  // Find users by usernames
  const usernames = Array.from(new Set(memberUsernames.map(u => String(u).toLowerCase())))
  const users = await User.find({ username: { $in: usernames } }).select('_id username').lean()
  const foundUsernames = new Set(users.map(u => u.username))
  const missing = usernames.filter(u => !foundUsernames.has(u))
  
  if (missing.length) return res.status(400).json({ message: `Unknown usernames: ${missing.join(', ')}` })
  
  // Get new member IDs that aren't already in the group
  const newMemberIds = users.map(u => String(u._id)).filter(id => !chat.memberIds.includes(id))
  
  if (newMemberIds.length === 0) return res.status(400).json({ message: 'All users are already members of this group' })
  
  // Add new members to the group
  const updatedMemberIds = [...chat.memberIds, ...newMemberIds]
  await Chat.findByIdAndUpdate(chatId, { memberIds: updatedMemberIds })
  
  res.json({ ok: true, addedCount: newMemberIds.length, addedUsernames: users.filter(u => newMemberIds.includes(String(u._id))).map(u => u.username) })
}

export async function removeMemberFromGroup(req, res) {
  const userId = String(req.user.id)
  const { chatId, memberId } = req.params
  const chat = await Chat.findById(chatId)
  
  if (!chat) return res.status(404).json({ message: 'Group not found' })
  if (chat.type !== 'group') return res.status(400).json({ message: 'Not a group' })
  if (String(chat.creatorId) !== userId) return res.status(403).json({ message: 'Only admin can remove members' })
  if (!chat.memberIds.includes(memberId)) return res.status(400).json({ message: 'User is not a member of this group' })
  if (String(memberId) === userId) return res.status(400).json({ message: 'Admin cannot remove themselves. Use leave group instead.' })
  
  // Remove member from group
  const updatedMemberIds = chat.memberIds.filter(id => String(id) !== memberId)
  
  // Update the chat
  await Chat.findByIdAndUpdate(chatId, { memberIds: updatedMemberIds })
  
  res.json({ ok: true, removedUserId: memberId })
}

export async function devSeedUsers(req, res) {
  if (process.env.NODE_ENV === 'production') return res.status(403).json({ message: 'Forbidden' })
  const seeds = [
    { email: 'alice@example.com', username: 'alice', name: 'Alice' },
    { email: 'bob@example.com', username: 'bob', name: 'Bob' },
    { email: 'carol@example.com', username: 'carol', name: 'Carol' }
  ]
  for (const s of seeds) {
    const exists = await User.findOne({ $or: [{ email: s.email }, { username: s.username }] })
    if (!exists) {
      await User.create({ ...s, passwordHash: 'seeded' })
    }
  }
  const users = await User.find().select('_id email username name').lean()
  res.json({ count: users.length })
}


