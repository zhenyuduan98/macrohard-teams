import mongoose from 'mongoose';

export interface IMeeting {
  title: string;
  host: mongoose.Types.ObjectId;
  participants: { user: mongoose.Types.ObjectId; joinedAt: Date; leftAt?: Date }[];
  status: 'waiting' | 'active' | 'ended';
  channel?: mongoose.Types.ObjectId;
  conversation?: mongoose.Types.ObjectId;
  screenSharer?: mongoose.Types.ObjectId;
  maxParticipants: number;
  createdAt: Date;
  endedAt?: Date;
}

const meetingSchema = new mongoose.Schema<IMeeting>({
  title: { type: String, required: true, trim: true },
  host: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  participants: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    joinedAt: { type: Date, default: Date.now },
    leftAt: { type: Date, default: null },
  }],
  status: { type: String, enum: ['waiting', 'active', 'ended'], default: 'waiting' },
  channel: { type: mongoose.Schema.Types.ObjectId, ref: 'Channel', default: null },
  conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', default: null },
  screenSharer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  maxParticipants: { type: Number, default: 8 },
  createdAt: { type: Date, default: Date.now },
  endedAt: { type: Date, default: null },
});

meetingSchema.index({ status: 1, createdAt: -1 });

export const Meeting = mongoose.model('Meeting', meetingSchema);
