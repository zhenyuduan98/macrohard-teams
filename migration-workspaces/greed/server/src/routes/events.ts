import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { Event } from '../models/Event.js';

const router = Router();

router.post('/events', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { title, date, startTime, endTime, description, participants } = req.body;
    const event = await Event.create({
      title, date, startTime, endTime, description,
      participants: participants || [],
      creator: req.userId,
    });
    const populated = await event.populate('creator', 'username avatar');
    res.json(populated);
  } catch (err) {
    res.status(500).json({ error: '创建事件失败' });
  }
});

router.get('/events', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { month, year } = req.query;
    const query: any = {
      $or: [{ creator: req.userId }, { participants: req.userId }],
    };
    if (month && year) {
      const m = parseInt(month as string) - 1;
      const y = parseInt(year as string);
      query.date = {
        $gte: new Date(y, m, 1),
        $lt: new Date(y, m + 1, 1),
      };
    }
    const events = await Event.find(query)
      .sort({ date: 1 })
      .populate('creator', 'username avatar')
      .populate('participants', 'username avatar');
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: '获取事件失败' });
  }
});

router.delete('/events/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ error: '事件不存在' });
    if (event.creator.toString() !== req.userId) return res.status(403).json({ error: '无权删除' });
    await event.deleteOne();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '删除失败' });
  }
});

export default router;
