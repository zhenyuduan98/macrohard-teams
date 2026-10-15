import mongoose from 'mongoose';

export interface ICallLog {
  caller: mongoose.Types.ObjectId;
  callee: mongoose.Types.ObjectId;
  callType: 'audio' | 'video';
  duration: number;
  startTime: Date;
  endTime?: Date;
  status: 'completed' | 'missed' | 'rejected';
}

const callLogSchema = new mongoose.Schema<ICallLog>({
  caller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  callee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  callType: { type: String, enum: ['audio', 'video'], required: true },
  duration: { type: Number, default: 0 },
  startTime: { type: Date, default: Date.now },
  endTime: { type: Date, default: null },
  status: { type: String, enum: ['completed', 'missed', 'rejected'], default: 'missed' },
});

callLogSchema.index({ caller: 1, startTime: -1 });
callLogSchema.index({ callee: 1, startTime: -1 });

export const CallLog = mongoose.model('CallLog', callLogSchema);
