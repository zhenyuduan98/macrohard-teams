import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser {
  username: string;
  password: string;
  avatar: string;
  status: 'online' | 'offline' | 'away' | 'busy';
  statusText: string;
  statusType: 'available' | 'busy' | 'away' | 'offline';
  isBot: boolean;
  createdAt: Date;
}

const userSchema = new mongoose.Schema<IUser>({
  username: { type: String, required: true, unique: true, trim: true, minlength: 2, maxlength: 30 },
  password: { type: String, required: true, minlength: 6 },
  avatar: { type: String, default: '' },
  status: { type: String, enum: ['online', 'offline', 'away', 'busy'], default: 'offline' },
  statusText: { type: String, default: '' },
  statusType: { type: String, enum: ['available', 'busy', 'away', 'offline'], default: 'available' },
  isBot: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function (candidate: string) {
  return bcrypt.compare(candidate, this.password);
};

export const User = mongoose.model('User', userSchema);
