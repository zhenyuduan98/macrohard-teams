import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { User } from './models/User.js';
import { Message } from './models/Message.js';
import { Conversation } from './models/Conversation.js';
import { Activity } from './models/Activity.js';
import { CallLog } from './models/CallLog.js';
import { getBotUserId, getGptBotUserId, processBotCommand, isGptConversation, handleGptMessage } from './bot.js';

const JWT_SECRET = process.env.JWT_SECRET || 'teamchat-dev-secret';
const onlineUsers = new Map<string, string>();

export function setupSocket(io: Server) {
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('未授权'));
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
      (socket as any).userId = decoded.userId;
      next();
    } catch {
      next(new Error('Token 无效'));
    }
  });

  io.on('connection', async (socket: Socket) => {
    const userId = (socket as any).userId as string;
    console.log('Socket connected:', socket.id, 'user:', userId);

    onlineUsers.set(userId, socket.id);
    await User.findByIdAndUpdate(userId, { status: 'online' }).catch(() => {});
    io.emit('user_online', { userId });

    try {
      const convos = await Conversation.find({ participants: userId });
      convos.forEach((c: any) => socket.join(c._id.toString()));
    } catch {}

    // Send message (with optional replyTo, mentions, fileInfo)
    socket.on('send_message', async (data: { conversationId: string; content: string; type?: string; replyTo?: string; fileInfo?: { filename: string; size: number; mimeType: string } }, ack?: Function) => {
      try {
        const msgData: any = {
          sender: userId,
          conversation: data.conversationId,
          content: data.content,
          type: data.type || 'text',
        };
        if (data.replyTo) msgData.replyTo = data.replyTo;
        if (data.fileInfo) msgData.fileInfo = data.fileInfo;

        // Parse @mentions
        const mentionPattern = /@(\S+)/g;
        let match;
        const mentionedUsernames: string[] = [];
        while ((match = mentionPattern.exec(data.content)) !== null) {
          mentionedUsernames.push(match[1]);
        }

        const convo = await Conversation.findById(data.conversationId).populate('participants', '-password');
        const participants = convo?.participants || [];
        const mentionedIds: string[] = [];
        const isAllMention = mentionedUsernames.includes('所有人');

        if (isAllMention) {
          participants.forEach((p: any) => {
            const pid = (p._id || p.id).toString();
            if (pid !== userId) mentionedIds.push(pid);
          });
        } else {
          for (const uname of mentionedUsernames) {
            const found = participants.find((p: any) => p.username === uname);
            if (found) {
              const fid = ((found as any)._id || (found as any).id).toString();
              if (fid !== userId) mentionedIds.push(fid);
            }
          }
        }

        msgData.mentions = mentionedIds;
        const message = await Message.create(msgData);

        await Conversation.findByIdAndUpdate(data.conversationId, {
          lastMessage: message._id,
          updatedAt: new Date(),
        });

        let populated = await message.populate('sender', '-password');
        if (data.replyTo) {
          populated = await populated.populate({ path: 'replyTo', populate: { path: 'sender', select: '-password' } });
        }
        io.to(data.conversationId).emit('receive_message', populated);

        // Emit mentioned event to mentioned users
        for (const mentionedId of mentionedIds) {
          const mentionedSocketId = onlineUsers.get(mentionedId);
          if (mentionedSocketId) {
            io.to(mentionedSocketId).emit('mentioned', {
              message: populated,
              conversationName: convo?.isGroup ? (convo?.name || '群聊') : '对话',
            });
          }
          // Create activity record for mention
          try {
            const senderUser = await User.findById(userId).select('username').lean();
            await Activity.create({
              type: 'mention',
              user: mentionedId,
              actor: userId,
              message: message._id,
              conversation: data.conversationId,
              description: `${(senderUser as any)?.username || '某人'} 在 ${convo?.isGroup ? (convo?.name || '群聊') : '对话'} 中提到了你`,
            });
            if (mentionedSocketId) {
              io.to(mentionedSocketId).emit('new_activity');
            }
          } catch {}
        }

        // Create activity for reply
        if (data.replyTo) {
          try {
            const originalMsg = await Message.findById(data.replyTo);
            if (originalMsg && originalMsg.sender.toString() !== userId) {
              const senderUser = await User.findById(userId).select('username').lean();
              await Activity.create({
                type: 'reply',
                user: originalMsg.sender,
                actor: userId,
                message: message._id,
                conversation: data.conversationId,
                description: `${(senderUser as any)?.username || '某人'} 回复了你的消息`,
              });
              const replySocketId = onlineUsers.get(originalMsg.sender.toString());
              if (replySocketId) {
                io.to(replySocketId).emit('new_activity');
              }
            }
          } catch {}
        }

        if (ack) ack({ success: true, message: populated });

        // Bot response
        const botId = getBotUserId();
        if (botId && userId !== botId) {
          const botResponse = processBotCommand(data.content);
          if (botResponse) {
            setTimeout(async () => {
              try {
                const botMsg = await Message.create({
                  sender: botId,
                  conversation: data.conversationId,
                  content: botResponse,
                  type: 'text',
                });
                const botPopulated = await botMsg.populate('sender', '-password');
                io.to(data.conversationId).emit('receive_message', botPopulated);
              } catch {}
            }, 500);
          }
        }

        // GPT-5.2 bot response
        const gptId = getGptBotUserId();
        if (gptId && userId !== gptId) {
          const isGpt = await isGptConversation(data.conversationId);
          if (isGpt) {
            setTimeout(() => handleGptMessage(data.conversationId, io), 500);
          } else if (data.content?.includes('@GPT-5.2')) {
            // @GPT-5.2 mention in any conversation
            setTimeout(() => handleGptMessage(data.conversationId, io, true), 500);
          }
        }
      } catch (err) {
        if (ack) ack({ success: false, error: '发送失败' });
      }
    });

    // Edit message
    socket.on('edit_message', async (data: { messageId: string; content: string }, ack?: Function) => {
      try {
        const msg = await Message.findById(data.messageId);
        if (!msg || msg.sender.toString() !== userId) {
          if (ack) ack({ success: false, error: '无权编辑' });
          return;
        }
        if (msg.isDeleted) {
          if (ack) ack({ success: false, error: '消息已撤回' });
          return;
        }
        const fiveMin = 5 * 60 * 1000;
        if (Date.now() - msg.timestamp.getTime() > fiveMin) {
          if (ack) ack({ success: false, error: '超过编辑时限' });
          return;
        }

        msg.content = data.content;
        msg.editedAt = new Date();
        await msg.save();
        const populated = await msg.populate('sender', '-password');

        io.to(msg.conversation.toString()).emit('message_edited', populated);
        if (ack) ack({ success: true, message: populated });
      } catch {
        if (ack) ack({ success: false, error: '编辑失败' });
      }
    });

    // Delete message
    socket.on('delete_message', async (data: { messageId: string }, ack?: Function) => {
      try {
        const msg = await Message.findById(data.messageId);
        if (!msg || msg.sender.toString() !== userId) {
          if (ack) ack({ success: false, error: '无权撤回' });
          return;
        }

        msg.isDeleted = true;
        msg.content = '';
        await msg.save();

        io.to(msg.conversation.toString()).emit('message_deleted', { messageId: msg._id, conversationId: msg.conversation.toString() });
        if (ack) ack({ success: true });
      } catch {
        if (ack) ack({ success: false, error: '撤回失败' });
      }
    });

    // Status change
    socket.on('status_change', async (data: { statusText?: string; statusType?: string }) => {
      try {
        const update: any = {};
        if (data.statusText !== undefined) update.statusText = data.statusText;
        if (data.statusType && ['available', 'busy', 'away', 'offline'].includes(data.statusType)) {
          update.statusType = data.statusType;
        }
        await User.findByIdAndUpdate(userId, update);
        io.emit('status_change', { userId, ...data });
      } catch {}
    });

    // Typing
    socket.on('typing', (data: { conversationId: string }) => {
      socket.to(data.conversationId).emit('user_typing', { userId, conversationId: data.conversationId });
    });

    socket.on('join_conversation', (data: { conversationId: string }) => {
      socket.join(data.conversationId);
    });

    socket.on('leave_conversation', (data: { conversationId: string }) => {
      socket.leave(data.conversationId);
    });

    // Mark messages as read
    socket.on('mark_read', async (data: { conversationId: string }) => {
      try {
        await Message.updateMany(
          {
            conversation: data.conversationId,
            sender: { $ne: userId },
            'readBy.user': { $ne: userId },
          },
          { $push: { readBy: { user: userId, readAt: new Date() } } }
        );
        io.to(data.conversationId).emit('messages_read', {
          conversationId: data.conversationId,
          userId,
        });
      } catch {}
    });

    // WebRTC signaling
    const pendingCalls = new Map<string, string>(); // callee -> callLogId

    socket.on('call_user', async (data: { targetUserId: string; conversationId: string; callType: 'audio' | 'video'; offer: any }) => {
      const targetSocketId = onlineUsers.get(data.targetUserId);
      // Create call log
      try {
        const callLog = await CallLog.create({
          caller: userId,
          callee: data.targetUserId,
          callType: data.callType,
          status: 'missed',
          startTime: new Date(),
        });
        pendingCalls.set(data.targetUserId, callLog._id.toString());
      } catch {}
      if (!targetSocketId) return;
      const caller = await User.findById(userId).select('username avatar').lean();
      io.to(targetSocketId).emit('incoming_call', {
        callerId: userId,
        callerName: (caller as any)?.username || '',
        callerAvatar: (caller as any)?.avatar || '',
        conversationId: data.conversationId,
        callType: data.callType,
        offer: data.offer,
      });
    });

    socket.on('call_answer', async (data: { callerId: string; answer: any }) => {
      const targetSocketId = onlineUsers.get(data.callerId);
      if (targetSocketId) io.to(targetSocketId).emit('call_answered', { answer: data.answer });
      // Update call log
      try {
        await CallLog.findOneAndUpdate(
          { caller: data.callerId, callee: userId, status: 'missed' },
          { status: 'completed', startTime: new Date() },
          { sort: { startTime: -1 } }
        );
      } catch {}
    });

    socket.on('ice_candidate', (data: { targetUserId: string; candidate: any }) => {
      const targetSocketId = onlineUsers.get(data.targetUserId);
      if (targetSocketId) io.to(targetSocketId).emit('ice_candidate', { candidate: data.candidate });
    });

    socket.on('call_reject', async (data: { callerId: string }) => {
      const targetSocketId = onlineUsers.get(data.callerId);
      if (targetSocketId) io.to(targetSocketId).emit('call_rejected');
      try {
        await CallLog.findOneAndUpdate(
          { caller: data.callerId, callee: userId, status: 'missed' },
          { status: 'rejected', endTime: new Date() },
          { sort: { startTime: -1 } }
        );
      } catch {}
    });

    socket.on('call_end', async (data: { targetUserId: string }) => {
      const targetSocketId = onlineUsers.get(data.targetUserId);
      if (targetSocketId) io.to(targetSocketId).emit('call_ended');
      try {
        const now = new Date();
        const log = await CallLog.findOne({
          $or: [
            { caller: userId, callee: data.targetUserId },
            { caller: data.targetUserId, callee: userId },
          ],
          status: 'completed',
          endTime: null,
        }).sort({ startTime: -1 });
        if (log) {
          log.endTime = now;
          log.duration = Math.round((now.getTime() - log.startTime.getTime()) / 1000);
          await log.save();
        }
      } catch {}
    });

    socket.on('disconnect', async () => {
      console.log('Socket disconnected:', socket.id);
      onlineUsers.delete(userId);
      await User.findByIdAndUpdate(userId, { status: 'offline' }).catch(() => {});
      io.emit('user_offline', { userId });
    });
  });

  return { onlineUsers };
}
