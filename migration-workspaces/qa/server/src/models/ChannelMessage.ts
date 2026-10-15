import mongoose from 'mongoose';

export interface IChannelMessage {
  sender: mongoose.Types.ObjectId;
  channel: mongoose.Types.ObjectId;
  content: string;
  type: 'text' | 'image' | 'file';
  timestamp: Date;
  editedAt?: Date;
  isDeleted: boolean;
  replyTo?: mongoose.Types.ObjectId;
  mentions: mongoose.Types.ObjectId[];
  fileInfo?: { filename: string; size: number; mimeType: string };
}

const channelMessageSchema = new mongoose.Schema<IChannelMessage>({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  channel: { type: mongoose.Schema.Types.ObjectId, ref: 'Channel', required: true },
  content: { type: String, required: true },
  type: { type: String, enum: ['text', 'image', 'file'], default: 'text' },
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
