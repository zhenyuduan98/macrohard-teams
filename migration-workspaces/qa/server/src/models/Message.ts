import mongoose from 'mongoose';

export interface IFileInfo {
  filename: string;
  size: number;
  mimeType: string;
}

export interface IMessage {
  sender: mongoose.Types.ObjectId;
  conversation: mongoose.Types.ObjectId;
  content: string;
  type: 'text' | 'image' | 'file';
  timestamp: Date;
  editedAt?: Date;
  isDeleted: boolean;
  replyTo?: mongoose.Types.ObjectId;
  mentions: mongoose.Types.ObjectId[];
  fileInfo?: IFileInfo;
  readBy: { user: mongoose.Types.ObjectId; readAt: Date }[];
}

const messageSchema = new mongoose.Schema<IMessage>({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
  content: { type: String, required: true },
  type: { type: String, enum: ['text', 'image', 'file'], default: 'text' },
  timestamp: { type: Date, default: Date.now },
  editedAt: { type: Date, default: null },
  isDeleted: { type: Boolean, default: false },
  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
  mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  fileInfo: {
    type: {
      filename: String,
      size: Number,
      mimeType: String,
    },
    default: null,
  },
  readBy: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    readAt: { type: Date, default: Date.now },
  }],
});

messageSchema.index({ conversation: 1, timestamp: -1 });

export const Message = mongoose.model('Message', messageSchema);
