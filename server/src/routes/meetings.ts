import { Router, Response } from 'express';
import { Meeting } from '../models/Meeting.js';
import { User } from '../models/User.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Create meeting
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { title, channelId, conversationId } = req.body;
    if (!title) return res.status(400).json({ error: '会议标题必填' });

    const meeting = await Meeting.create({
      title,
      host: req.userId,
      participants: [{ user: req.userId }],
      status: 'active',
      channel: channelId || null,
      conversation: conversationId || null,
    });

    const populated = await Meeting.findById(meeting._id)
      .populate('host', '-password')
      .populate('participants.user', '-password');
    res.status(201).json(populated);
  } catch {
    res.status(500).json({ error: '创建会议失败' });
  }
});

// Get meeting info
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const meeting = await Meeting.findById(req.params.id)
      .populate('host', '-password')
      .populate('participants.user', '-password')
      .populate('screenSharer', '-password');
    if (!meeting) return res.status(404).json({ error: '会议不存在' });
    res.json(meeting);
  } catch {
    res.status(500).json({ error: '获取会议信息失败' });
  }
});

// List active meetings (optional: filter by channel/conversation)
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const query: any = { status: { $in: ['waiting', 'active'] } };
    if (req.query.channelId) query.channel = req.query.channelId;
    if (req.query.conversationId) query.conversation = req.query.conversationId;

    const meetings = await Meeting.find(query)
      .populate('host', '-password')
      .populate('participants.user', '-password')
      .sort({ createdAt: -1 });
    res.json(meetings);
  } catch {
    res.status(500).json({ error: '获取会议列表失败' });
  }
});

// Join meeting
router.post('/:id/join', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) return res.status(404).json({ error: '会议不存在' });
    if (meeting.status === 'ended') return res.status(400).json({ error: '会议已结束' });

    const activeParticipants = meeting.participants.filter(p => !p.leftAt);
    if (activeParticipants.length >= meeting.maxParticipants) {
      return res.status(400).json({ error: '会议人数已满' });
    }

    const existing = meeting.participants.find(p => p.user.toString() === req.userId && !p.leftAt);
    if (!existing) {
      // Re-join or new join
      meeting.participants.push({ user: req.userId as any, joinedAt: new Date() });
      await meeting.save();
    }

    const populated = await Meeting.findById(meeting._id)
      .populate('host', '-password')
      .populate('participants.user', '-password');
    res.json(populated);
  } catch {
    res.status(500).json({ error: '加入会议失败' });
  }
});

// Leave meeting
router.post('/:id/leave', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) return res.status(404).json({ error: '会议不存在' });

    const participant = meeting.participants.find(p => p.user.toString() === req.userId && !p.leftAt);
    if (participant) {
      participant.leftAt = new Date();
    }

    // If screen sharer leaves, clear it
    if (meeting.screenSharer?.toString() === req.userId) {
      meeting.screenSharer = undefined;
    }

    // If all left, end meeting
    const activeCount = meeting.participants.filter(p => !p.leftAt).length;
    if (activeCount === 0) {
      meeting.status = 'ended';
      meeting.endedAt = new Date();
    }

    await meeting.save();
    const populated = await Meeting.findById(meeting._id)
      .populate('host', '-password')
      .populate('participants.user', '-password');
    res.json(populated);
  } catch {
    res.status(500).json({ error: '离开会议失败' });
  }
});

// End meeting (host only)
router.post('/:id/end', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) return res.status(404).json({ error: '会议不存在' });
    if (meeting.host.toString() !== req.userId) {
      return res.status(403).json({ error: '只有主持人可以结束会议' });
    }

    meeting.status = 'ended';
    meeting.endedAt = new Date();
    // Mark all active participants as left
    meeting.participants.forEach(p => { if (!p.leftAt) p.leftAt = new Date(); });
    meeting.screenSharer = undefined;
    await meeting.save();

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: '结束会议失败' });
  }
});

export default router;
