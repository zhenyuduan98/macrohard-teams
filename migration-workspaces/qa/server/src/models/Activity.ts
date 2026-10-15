import mongoose from 'mongoose';

export interface IActivity {
  type: 'mention' | 'reply' | 'group_join' | 'event_reminder';
  user: mongoose.Types.ObjectId;
  actor: mongoose.Types.ObjectId;
  message?: mongoose.Types.ObjectId;
  conversation?: mongoose.Types.ObjectId;
  description: string;
  read: boolean;
  createdAt: Date;
}

const activitySchema = new mongoose.Schema<IActivity>({
  type: { type: String, enum: ['mention', 'reply', 'group_join', 'event_reminder'], required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
  conversation: { type: mongoose.Schema.Types.ObjectId, default: null },
  description: { type: String, required: true },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

activitySchema.index({ user: 1, createdAt: -1 });

export const Activity = mongoose.model('Activity', activitySchema);
