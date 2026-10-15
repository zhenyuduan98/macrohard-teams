import mongoose from 'mongoose';

export interface IChannelMessage {
  sender: mongoose.Types.ObjectId;
  channel: mongoose.Types.ObjectId;
  content: string;
  type: 'text' | 'image' | 'file' | 'forward' | 'merged_forward';
  timestamp: Date;
  editedAt?: Date;
  isDeleted: boolean;
  replyTo?: mongoose.Types.ObjectId;
  mentions: mongoose.Types.ObjectId[];
  fileInfo?: { filename: string; size: number; mimeType: string };
  forwardInfo?: {
    originalMessageId?: string;
    originalMessages?: Array<{
      originalMessageId: string;
      originalSender: string;
      originalSenderName: string;
      content: string;
      type: string;
      timestamp: Date;
      fileInfo?: { filename: string; size: number; mimeType: string };
    }>;
    sourceConversationId?: string;
    sourceChannelId?: string;
    originalSender?: string;
    originalSenderName?: string;
    originalTimestamp?: Date;
  };
}

const channelMessageSchema = new mongoose.Schema<IChannelMessage>({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  channel: { type: mongoose.Schema.Types.ObjectId, ref: 'Channel', required: true },
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
  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'ChannelMessage', default: null },
  mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  fileInfo: {
    type: { filename: String, size: Number, mimeType: String },
    default: null,
  },
});

channelMessageSchema.index({ channel: 1, timestamp: -1 });

export const ChannelMessage = mongoose.model('ChannelMessage', channelMessageSchema);
