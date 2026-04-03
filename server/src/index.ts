import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import path from 'path';
import multer from 'multer';
import authRoutes from './routes/auth.js';
import chatRoutes from './routes/chat.js';
import teamRoutes from './routes/teams.js';
import activityRoutes from './routes/activity.js';
import eventRoutes from './routes/events.js';
import callRoutes from './routes/calls.js';
import fileRoutes from './routes/files.js';
import adminRoutes from './routes/admin.js';
import { setupSocket } from './socket.js';
import { ensureBotUser } from './bot.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

// Multer setup
const uploadsDir = path.join(import.meta.dirname || __dirname, '..', 'uploads');
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
});

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadsDir));
app.use('/api/auth', authRoutes);
app.use('/api', chatRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api', activityRoutes);
app.use('/api', eventRoutes);
app.use('/api', callRoutes);
app.use('/api', fileRoutes);
app.use('/api/admin', adminRoutes);

// File upload endpoint
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '未上传文件' });
  const url = `/uploads/${req.file.filename}`;
  res.json({
    url,
    filename: req.file.originalname,
    size: req.file.size,
    mimeType: req.file.mimetype,
  });
});

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

setupSocket(io);

const PORT = parseInt(process.env.PORT || '3001', 10);
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/teamchat';

async function start() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('MongoDB connected');
    await ensureBotUser();
    console.log('MacroBot ready');
  } catch (err) {
    console.warn('MongoDB not available, running without database:', (err as Error).message);
  }
  httpServer.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
}

start();
