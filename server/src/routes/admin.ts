import { Router, Response, NextFunction } from 'express';
import { User } from '../models/User.js';
import { ContactVisibility } from '../models/ContactVisibility.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

const adminOnly = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await User.findById(req.userId);
    if (!user || user.username !== 'zhenyuduan') return res.status(403).json({ error: '无权限' });
    next();
  } catch {
    res.status(500).json({ error: '权限检查失败' });
  }
};

// GET /api/admin/users
router.get('/users', authMiddleware, adminOnly, async (_req: AuthRequest, res: Response) => {
  try {
    const users = await User.find().select('-password');
    res.json(users.map(u => ({ id: u._id, username: u.username, avatar: u.avatar, isBot: u.isBot || false })));
  } catch {
    res.status(500).json({ error: '获取用户列表失败' });
  }
});

// GET /api/admin/visibility/:userId
router.get('/visibility/:userId', authMiddleware, adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const record = await ContactVisibility.findOne({ userId: req.params.userId });
    res.json({ hiddenUsers: record?.hiddenUsers || [] });
  } catch {
    res.status(500).json({ error: '获取可见性失败' });
  }
});

// PUT /api/admin/visibility/:userId
router.put('/visibility/:userId', authMiddleware, adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const { hiddenUsers } = req.body;
    await ContactVisibility.findOneAndUpdate(
      { userId: req.params.userId },
      { hiddenUsers: hiddenUsers || [] },
      { upsert: true, new: true }
    );
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: '更新可见性失败' });
  }
});

export default router;
