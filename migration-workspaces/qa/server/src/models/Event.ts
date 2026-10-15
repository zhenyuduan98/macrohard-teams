import mongoose from 'mongoose';

export interface IEvent {
  title: string;
  date: Date;
  startTime: string;
  endTime: string;
  description: string;
  participants: mongoose.Types.ObjectId[];
  creator: mongoose.Types.ObjectId;
  createdAt: Date;
}

const eventSchema = new mongoose.Schema<IEvent>({
  title: { type: String, required: true },
  date: { type: Date, required: true },
  startTime: { type: String, default: '' },
  endTime: { type: String, default: '' },
  description: { type: String, default: '' },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
});

eventSchema.index({ date: 1 });

export const Event = mongoose.model('Event', eventSchema);
