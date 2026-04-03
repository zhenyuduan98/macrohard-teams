import mongoose from 'mongoose';

const contactVisibilitySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  hiddenUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
});

export const ContactVisibility = mongoose.model('ContactVisibility', contactVisibilitySchema);
