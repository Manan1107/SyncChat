import mongoose from 'mongoose'

const chatSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['dm', 'group'], required: true },
    title: { type: String },
    memberIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    creatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
)

export default mongoose.model('Chat', chatSchema)


