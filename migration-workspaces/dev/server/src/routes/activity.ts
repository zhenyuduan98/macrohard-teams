import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { Activity } from '../models/Activity.js';

const router = Router();

router.get('/activity', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const activities = await Activity.find({ user: req.userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('actor', 'username avatar')
      .populate('message', 'content type');
    res.json(activities);
  } catch (err) {
    res.status(500).json({ error: '获取动态失败' });
  }
});

router.put('/activity/:id/read', authMiddleware, async (req: AuthRequest, res) => {
  try {
    await Activity.findOneAndUpdate({ _id: req.params.id, user: req.userId }, { read: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '标记失败' });
  }
});

router.put('/activity/read-all', authMiddleware, async (req: AuthRequest, res) => {
  try {
    await Activity.updateMany({ user: req.userId, read: false }, { read: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '标记失败' });
  }
});

export default router;
