import { Router, Response } from 'express';
import { User } from '../models/User.js';
import { Conversation } from '../models/Conversation.js';
import { Message } from '../models/Message.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { getGptBotUserId } from '../bot.js';

const router = Router();

// List all users (except current)
router.get('/users', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const users = await User.find({ _id: { $ne: req.userId } }).select('-password');
    res.json(users.map(u => ({ id: u._id, username: u.username, avatar: u.avatar, status: u.status })));
  } catch {
    res.status(500).json({ error: '获取用户列表失败' });
  }
});

// List user's conversations
router.get('/conversations', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    // Auto-create GPT-5.2 conversation if not exists
    const gptBotId = getGptBotUserId();
    if (gptBotId && req.userId !== gptBotId) {
      const existing = await Conversation.findOne({
        isGroup: { $ne: true },
        participants: { $all: [req.userId, gptBotId], $size: 2 },
      });
      if (!existing) {
        await Conversation.create({ participants: [req.userId, gptBotId], isGroup: false });
      }
    }

    const convos = await Conversation.find({ participants: req.userId })
      .populate('participants', '-password')
      .populate('lastMessage')
      .populate('admin', '-password')
      .sort({ updatedAt: -1 });
    res.json(convos);
  } catch {
    res.status(500).json({ error: '获取对话列表失败' });
  }
});

// Create or find 1-on-1 conversation
router.post('/conversations', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { participantId } = req.body;
    if (!participantId) return res.status(400).json({ error: '缺少参与者' });

    let convo = await Conversation.findOne({
      isGroup: { $ne: true },
      participants: { $all: [req.userId, participantId], $size: 2 },
    })
      .populate('participants', '-password')
      .populate('lastMessage');

    if (!convo) {
      convo = await Conversation.create({ participants: [req.userId, participantId], isGroup: false });
      convo = await convo.populate('participants', '-password');
    }

    res.json(convo);
  } catch {
    res.status(500).json({ error: '创建对话失败' });
  }
});

// Create group conversation
router.post('/conversations/group', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { name, participants } = req.body;
    if (!name || !participants || !Array.isArray(participants) || participants.length < 1) {
      return res.status(400).json({ error: '需要群名和至少一个参与者' });
    }

    const allParticipants = [req.userId, ...participants.filter((p: string) => p !== req.userId)];

    let convo = await Conversation.create({
      name,
      isGroup: true,
      admin: req.userId,
      participants: allParticipants,
    });
    convo = await convo.populate('participants', '-password');

    res.json(convo);
  } catch {
    res.status(500).json({ error: '创建群聊失败' });
  }
});

// Update group conversation
router.put('/conversations/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { name, addMembers, removeMembers } = req.body;
    const convo = await Conversation.findById(req.params.id);
    if (!convo || !convo.isGroup) return res.status(404).json({ error: '群聊不存在' });

    if (name) convo.name = name;
    if (addMembers && Array.isArray(addMembers)) {
      for (const id of addMembers) {
        if (!convo.participants.some(p => p.toString() === id)) {
          convo.participants.push(id);
        }
      }
    }
    if (removeMembers && Array.isArray(removeMembers)) {
      convo.participants = convo.participants.filter(
        p => !removeMembers.includes(p.toString())
      ) as any;
    }

    await convo.save();
    const populated = await convo.populate('participants', '-password');
    res.json(populated);
  } catch {
    res.status(500).json({ error: '更新群聊失败' });
  }
});

// Get group members
router.get('/conversations/:id/members', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const convo = await Conversation.findById(req.params.id).populate('participants', '-password');
    if (!convo) return res.status(404).json({ error: '对话不存在' });
    res.json(convo.participants);
  } catch {
    res.status(500).json({ error: '获取成员失败' });
  }
});

// Search messages
router.get('/messages/search', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const q = req.query.q as string;
    if (!q) return res.status(400).json({ error: '缺少搜索关键词' });

    const convos = await Conversation.find({ participants: req.userId });
    const convoIds = convos.map(c => c._id);

    const messages = await Message.find({
      conversation: { $in: convoIds },
      content: { $regex: q, $options: 'i' },
      isDeleted: false,
    })
      .populate('sender', '-password')
      .populate('conversation')
      .sort({ timestamp: -1 })
      .limit(50);

    res.json(messages);
  } catch {
    res.status(500).json({ error: '搜索失败' });
  }
});

// Get messages with pagination
router.get('/messages/:conversationId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { conversationId } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const before = req.query.before as string;

    const query: any = { conversation: conversationId };
    if (before) query.timestamp = { $lt: new Date(before) };

    const typeFilter = req.query.type as string;
    if (typeFilter) {
      const types = typeFilter.split(',');
      query.type = { $in: types };
      query.isDeleted = false;
    }

    const messages = await Message.find(query)
      .populate('sender', '-password')
      .populate({ path: 'replyTo', populate: { path: 'sender', select: '-password' } })
      .sort({ timestamp: -1 })
      .limit(limit);

    res.json(messages.reverse());
  } catch {
    res.status(500).json({ error: '获取消息失败' });
  }
});

// Edit message
router.put('/messages/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const msg = await Message.findById(req.params.id);
    if (!msg) return res.status(404).json({ error: '消息不存在' });
    if (msg.sender.toString() !== req.userId) return res.status(403).json({ error: '只能编辑自己的消息' });
    if (msg.isDeleted) return res.status(400).json({ error: '消息已撤回' });

    const fiveMin = 5 * 60 * 1000;
    if (Date.now() - msg.timestamp.getTime() > fiveMin) {
      return res.status(400).json({ error: '只能在5分钟内编辑消息' });
    }

    msg.content = req.body.content;
    msg.editedAt = new Date();
    await msg.save();

    const populated = await msg.populate('sender', '-password');
    res.json(populated);
  } catch {
    res.status(500).json({ error: '编辑消息失败' });
  }
});

// Delete message
router.delete('/messages/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const msg = await Message.findById(req.params.id);
    if (!msg) return res.status(404).json({ error: '消息不存在' });
    if (msg.sender.toString() !== req.userId) return res.status(403).json({ error: '只能撤回自己的消息' });

    msg.isDeleted = true;
    msg.content = '';
    await msg.save();

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: '撤回消息失败' });
  }
});

export default router;
