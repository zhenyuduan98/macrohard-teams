import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import { User } from '../models/User.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'teamchat-dev-secret';

// Avatar upload multer
const uploadsDir = path.join(import.meta.dirname || __dirname, '..', '..', 'uploads');
const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `avatar-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  },
});

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: '用户名和密码必填' });
    if (password.length < 6) return res.status(400).json({ error: '密码至少6位' });
    const exists = await User.findOne({ username });
    if (exists) return res.status(409).json({ error: '用户名已存在' });
    const user = await User.create({ username, password });
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { id: user._id, username: user.username, avatar: user.avatar, status: user.status, statusText: user.statusText || '', statusType: user.statusType || 'available' } });
  } catch (err) {
    res.status(500).json({ error: '注册失败' });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: '用户名和密码必填' });
    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ error: '用户名或密码错误' });
    const valid = await (user as any).comparePassword(password);
    if (!valid) return res.status(401).json({ error: '用户名或密码错误' });
    user.status = 'online';
    await user.save();
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, username: user.username, avatar: user.avatar, status: user.status, statusText: user.statusText || '', statusType: user.statusType || 'available' } });
  } catch (err) {
    res.status(500).json({ error: '登录失败' });
  }
});

router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    if (!user) return res.status(404).json({ error: '用户不存在' });
    res.json({ id: user._id, username: user.username, avatar: user.avatar, status: user.status, statusText: user.statusText || '', statusType: user.statusType || 'available' });
  } catch {
    res.status(500).json({ error: '获取用户信息失败' });
  }
});

// Avatar upload
router.put('/avatar', authMiddleware, avatarUpload.single('avatar'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: '未上传文件或格式不支持' });
    const url = `/uploads/${req.file.filename}`;
    await User.findByIdAndUpdate(req.userId, { avatar: url });
    res.json({ avatar: url });
  } catch {
    res.status(500).json({ error: '头像上传失败' });
  }
});

// Status update
router.put('/status', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { statusText, statusType } = req.body;
    const update: any = {};
    if (statusText !== undefined) update.statusText = statusText;
    if (statusType && ['available', 'busy', 'away', 'offline'].includes(statusType)) {
      update.statusType = statusType;
    }
    const user = await User.findByIdAndUpdate(req.userId, update, { new: true }).select('-password');
    if (!user) return res.status(404).json({ error: '用户不存在' });
    res.json({ statusText: user.statusText, statusType: user.statusType });
  } catch {
    res.status(500).json({ error: '状态更新失败' });
  }
});

export default router;
