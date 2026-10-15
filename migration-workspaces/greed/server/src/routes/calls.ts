import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { CallLog } from '../models/CallLog.js';

const router = Router();

router.get('/calls', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const calls = await CallLog.find({
      $or: [{ caller: req.userId }, { callee: req.userId }],
    })
      .sort({ startTime: -1 })
      .limit(50)
      .populate('caller', 'username avatar')
      .populate('callee', 'username avatar');
    res.json(calls);
  } catch (err) {
    res.status(500).json({ error: '获取通话记录失败' });
  }
});

export default router;
