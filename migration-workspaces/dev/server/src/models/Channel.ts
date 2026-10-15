import mongoose from 'mongoose';

export interface IChannel {
  name: string;
  team: mongoose.Types.ObjectId;
  type: 'general' | 'announcement';
  description: string;
}

const channelSchema = new mongoose.Schema<IChannel>({
  name: { type: String, required: true, trim: true },
  team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
  type: { type: String, enum: ['general', 'announcement'], default: 'general' },
  description: { type: String, default: '' },
});

export const Channel = mongoose.model('Channel', channelSchema);
