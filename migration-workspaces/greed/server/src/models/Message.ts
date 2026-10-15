import mongoose from 'mongoose';

export interface IFileInfo {
  filename: string;
  size: number;
  mimeType: string;
}

export interface IForwardMessageItem {
  originalMessageId: string;
  originalSender: string;
  originalSenderName: string;
  content: string;
  type: string;
  timestamp: Date;
  fileInfo?: IFileInfo;
}

export interface IForwardInfo {
  originalMessageId?: string;
  originalMessages?: IForwardMessageItem[];
  sourceConversationId?: string;
  sourceChannelId?: string;
  originalSender?: string;
  originalSenderName?: string;
  originalTimestamp?: Date;
}

export interface IMessage {
  sender: mongoose.Types.ObjectId;
  conversation: mongoose.Types.ObjectId;
  content: string;
  type: 'text' | 'image' | 'file' | 'forward' | 'merged_forward';
  forwardInfo?: IForwardInfo;
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
  type: { type: String, enum: ['text', 'image', 'file', 'forward', 'merged_forward'], default: 'text' },
  forwardInfo: {
    type: {
      originalMessageId: { type: String, default: null },
      originalMessages: [{
        originalMessageId: String,
        originalSender: String,
        originalSenderName: String,
        content: String,
        type: String,
        timestamp: Date,
        fileInfo: {
          type: { filename: String, size: Number, mimeType: String },
          default: null,
        },
      }],
      sourceConversationId: { type: String, default: null },
      sourceChannelId: { type: String, default: null },
      originalSender: { type: String, default: null },
      originalSenderName: { type: String, default: null },
      originalTimestamp: { type: Date, default: null },
    },
    default: null,
  },
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
