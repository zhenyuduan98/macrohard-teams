import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { Message } from '../models/Message.js';
import { Conversation } from '../models/Conversation.js';

const router = Router();

router.get('/files', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const typeFilter = req.query.type as string || 'all';
    const convos = await Conversation.find({ participants: req.userId }).select('_id name isGroup');
    const convoIds = convos.map(c => c._id);
    const convoMap = new Map(convos.map(c => [c._id.toString(), c]));

    const typeQuery: any = { conversation: { $in: convoIds }, isDeleted: false };
    if (typeFilter === 'image') {
      typeQuery.type = 'image';
    } else if (typeFilter === 'file') {
      typeQuery.type = 'file';
    } else {
      typeQuery.type = { $in: ['image', 'file'] };
    }

    const messages = await Message.find(typeQuery)
      .sort({ timestamp: -1 })
      .limit(100)
      .populate('sender', 'username avatar');

    const files = messages.map(m => {
      const convo = convoMap.get(m.conversation.toString());
      return {
        _id: m._id,
        url: m.content,
        type: m.type,
        fileInfo: m.fileInfo,
        sender: m.sender,
        conversationName: convo?.isGroup ? (convo?.name || '群聊') : '私聊',
        timestamp: m.timestamp,
      };
    });

    res.json(files);
  } catch (err) {
    res.status(500).json({ error: '获取文件失败' });
  }
});

export default router;
