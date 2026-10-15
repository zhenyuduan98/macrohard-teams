import { Router, Response } from 'express';
import { Server } from 'socket.io';
import { Message } from '../models/Message.js';
import { ChannelMessage } from '../models/ChannelMessage.js';
import { Conversation } from '../models/Conversation.js';
import { Channel } from '../models/Channel.js';
import { Team } from '../models/Team.js';
import { User } from '../models/User.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

// ============================================================
// Helper: verify user has access to target conversation/channel
// ============================================================

async function verifyConversationAccess(userId: string, conversationId: string) {
  const convo = await Conversation.findById(conversationId);
  if (!convo) return null;
  if (!convo.participants.some(p => p.toString() === userId)) return null;
  return convo;
}

async function verifyChannelAccess(userId: string, channelId: string) {
  const channel = await Channel.findById(channelId);
  if (!channel) return null;
  const team = await Team.findById(channel.team);
  if (!team || !team.members.some(m => m.toString() === userId)) return null;
  return { channel, team };
}

// ============================================================
// Helper: fetch source message (from conversation or channel)
// ============================================================

async function fetchSourceMessage(messageId: string, sourceType: 'conversation' | 'channel', userId: string) {
  if (sourceType === 'conversation') {
    const msg = await Message.findById(messageId).populate('sender', 'username avatar');
    if (!msg || msg.isDeleted) return null;
    const convo = await Conversation.findById(msg.conversation);
    if (!convo || !convo.participants.some(p => p.toString() === userId)) return null;
    return msg;
  } else {
    const msg = await ChannelMessage.findById(messageId).populate('sender', 'username avatar');
    if (!msg || msg.isDeleted) return null;
    const channel = await Channel.findById(msg.channel);
    if (!channel) return null;
    const team = await Team.findById(channel.team);
    if (!team || !team.members.some(m => m.toString() === userId)) return null;
    return msg;
  }
}

// ============================================================
// Factory: create forward router with Socket.IO instance
// ============================================================

export default function createForwardRouter(io: Server) {
  const router = Router();

  // ==========================================================
  // POST /forward — Single message forward
  // ==========================================================

  router.post('/forward', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { messageId, targetConversationIds, targetChannelIds, sourceType } = req.body;

      if (!messageId || !sourceType) {
        return res.status(400).json({ error: '缺少 messageId 或 sourceType' });
      }
      if ((!targetConversationIds || targetConversationIds.length === 0) &&
          (!targetChannelIds || targetChannelIds.length === 0)) {
        return res.status(400).json({ error: '至少需要一个转发目标' });
      }

      const srcMsg = await fetchSourceMessage(messageId, sourceType, req.userId!);
      if (!srcMsg) {
        return res.status(404).json({ error: '消息不存在或无权访问' });
      }

      const sender = srcMsg.sender as any;
      const senderName = sender?.username || '未知用户';
      const senderId = (sender?._id || sender).toString();

      const forwardedMessages: Array<{ _id: string; targetType: string; targetId: string }> = [];

      const forwardInfo = {
        originalMessageId: messageId,
        sourceConversationId: sourceType === 'conversation' ? (srcMsg as any).conversation?.toString() : undefined,
        sourceChannelId: sourceType === 'channel' ? (srcMsg as any).channel?.toString() : undefined,
        originalSender: senderId,
        originalSenderName: senderName,
        originalTimestamp: srcMsg.timestamp,
      };

      // Forward to conversations
      if (targetConversationIds && Array.isArray(targetConversationIds)) {
        for (const convoId of targetConversationIds) {
          const convo = await verifyConversationAccess(req.userId!, convoId);
          if (!convo) continue;

          const newMsg = await Message.create({
            sender: req.userId,
            conversation: convoId,
            content: srcMsg.content,
            type: 'forward',
            fileInfo: (srcMsg as any).fileInfo || null,
            forwardInfo,
          });

          await Conversation.findByIdAndUpdate(convoId, {
            lastMessage: newMsg._id,
            updatedAt: new Date(),
          });

          const populated = await newMsg.populate('sender', '-password');
          io.to(convoId).emit('receive_message', populated);

          forwardedMessages.push({
            _id: newMsg._id.toString(),
            targetType: 'conversation',
            targetId: convoId,
          });
        }
      }

      // Forward to channels
      if (targetChannelIds && Array.isArray(targetChannelIds)) {
        for (const channelId of targetChannelIds) {
          const access = await verifyChannelAccess(req.userId!, channelId);
          if (!access) continue;

          const newMsg = await ChannelMessage.create({
            sender: req.userId,
            channel: channelId,
            content: srcMsg.content,
            type: 'forward',
            fileInfo: (srcMsg as any).fileInfo || null,
            forwardInfo,
          });

          const populated = await newMsg.populate('sender', '-password');
          io.to(`channel:${channelId}`).emit('receive_channel_message', populated);

          forwardedMessages.push({
            _id: newMsg._id.toString(),
            targetType: 'channel',
            targetId: channelId,
          });
        }
      }

      if (forwardedMessages.length === 0) {
        return res.status(403).json({ error: '无权转发到任何目标' });
      }

      res.json({ success: true, forwardedMessages });
    } catch (err) {
      console.error('Forward error:', err);
      res.status(500).json({ error: '转发失败' });
    }
  });

  // ==========================================================
  // POST /forward/merge — Merged forward
  // ==========================================================

  router.post('/forward/merge', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { messageIds, targetConversationIds, targetChannelIds, sourceType, title } = req.body;

      if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0 || !sourceType) {
        return res.status(400).json({ error: '缺少 messageIds 或 sourceType' });
      }
      if (messageIds.length > 30) {
        return res.status(400).json({ error: '合并转发最多30条消息' });
      }
      if ((!targetConversationIds || targetConversationIds.length === 0) &&
          (!targetChannelIds || targetChannelIds.length === 0)) {
        return res.status(400).json({ error: '至少需要一个转发目标' });
      }

      // Fetch all source messages
      const originalMessages: Array<{
        originalMessageId: string;
        originalSender: string;
        originalSenderName: string;
        content: string;
        type: string;
        timestamp: Date;
        fileInfo?: { filename: string; size: number; mimeType: string };
      }> = [];

      let sourceConversationId: string | undefined;
      let sourceChannelId: string | undefined;

      for (const msgId of messageIds) {
        const srcMsg = await fetchSourceMessage(msgId, sourceType, req.userId!);
        if (!srcMsg) continue;

        const sender = srcMsg.sender as any;
        const senderName = sender?.username || '未知用户';
        const senderId = (sender?._id || sender).toString();

        if (sourceType === 'conversation' && !sourceConversationId) {
          sourceConversationId = (srcMsg as any).conversation?.toString();
        }
        if (sourceType === 'channel' && !sourceChannelId) {
          sourceChannelId = (srcMsg as any).channel?.toString();
        }

        originalMessages.push({
          originalMessageId: msgId,
          originalSender: senderId,
          originalSenderName: senderName,
          content: srcMsg.content,
          type: srcMsg.type,
          timestamp: srcMsg.timestamp,
          fileInfo: (srcMsg as any).fileInfo || undefined,
        });
      }

      if (originalMessages.length === 0) {
        return res.status(404).json({ error: '无有效消息可转发' });
      }

      // Build display content (summary)
      const displayTitle = title || '聊天记录';
      const previewLines = originalMessages.slice(0, 3).map(m => `${m.originalSenderName}: ${m.content}`);
      const displayContent = `[${displayTitle}]\n${previewLines.join('\n')}${originalMessages.length > 3 ? '\n...' : ''}`;

      const forwardInfo = {
        originalMessages,
        sourceConversationId,
        sourceChannelId,
      };

      const forwardedMessages: Array<{ _id: string; targetType: string; targetId: string }> = [];

      // Forward to conversations
      if (targetConversationIds && Array.isArray(targetConversationIds)) {
        for (const convoId of targetConversationIds) {
          const convo = await verifyConversationAccess(req.userId!, convoId);
          if (!convo) continue;

          const newMsg = await Message.create({
            sender: req.userId,
            conversation: convoId,
            content: displayContent,
            type: 'merged_forward',
            forwardInfo,
          });

          await Conversation.findByIdAndUpdate(convoId, {
            lastMessage: newMsg._id,
            updatedAt: new Date(),
          });

          const populated = await newMsg.populate('sender', '-password');
          io.to(convoId).emit('receive_message', populated);

          forwardedMessages.push({
            _id: newMsg._id.toString(),
            targetType: 'conversation',
            targetId: convoId,
          });
        }
      }

      // Forward to channels
      if (targetChannelIds && Array.isArray(targetChannelIds)) {
        for (const channelId of targetChannelIds) {
          const access = await verifyChannelAccess(req.userId!, channelId);
          if (!access) continue;

          const newMsg = await ChannelMessage.create({
            sender: req.userId,
            channel: channelId,
            content: displayContent,
            type: 'merged_forward',
            forwardInfo,
          });

          const populated = await newMsg.populate('sender', '-password');
          io.to(`channel:${channelId}`).emit('receive_channel_message', populated);

          forwardedMessages.push({
            _id: newMsg._id.toString(),
            targetType: 'channel',
            targetId: channelId,
          });
        }
      }

      if (forwardedMessages.length === 0) {
        return res.status(403).json({ error: '无权转发到任何目标' });
      }

      res.json({ success: true, forwardedMessages });
    } catch (err) {
      console.error('Merge forward error:', err);
      res.status(500).json({ error: '合并转发失败' });
    }
  });

  // ==========================================================
  // GET /forward/targets — List forwardable targets
  // ==========================================================

  router.get('/forward/targets', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const conversations = await Conversation.find({ participants: req.userId })
        .populate('participants', 'username avatar')
        .sort({ updatedAt: -1 });

      const teams = await Team.find({ members: req.userId }).populate('channels');
      const channels: Array<{ _id: string; name: string; teamId: string; teamName: string }> = [];
      for (const team of teams) {
        for (const ch of team.channels) {
          const channel = ch as any;
          channels.push({
            _id: (channel._id || channel).toString(),
            name: channel.name || '',
            teamId: team._id.toString(),
            teamName: team.name,
          });
        }
      }

      res.json({
        conversations: conversations.map(c => ({
          _id: c._id.toString(),
          name: c.name || undefined,
          isGroup: c.isGroup,
          participants: (c.participants as any[]).map(p => ({
            _id: (p._id || p).toString(),
            username: p.username || '',
            avatar: p.avatar || undefined,
          })),
        })),
        channels,
      });
    } catch (err) {
      console.error('Get forward targets error:', err);
      res.status(500).json({ error: '获取转发目标列表失败' });
    }
  });

  return router;
}
