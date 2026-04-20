import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { User } from './models/User.js';
import { Message } from './models/Message.js';
import { ChannelMessage } from './models/ChannelMessage.js';
import { Conversation } from './models/Conversation.js';
import { Channel } from './models/Channel.js';
import { Team } from './models/Team.js';
import { Activity } from './models/Activity.js';
import { CallLog } from './models/CallLog.js';
import { Meeting } from './models/Meeting.js';
import { getBotUserId, getGptBotUserId, getOpusBotUserId, processBotCommand, isGptConversation, handleGptMessage, isOpusConversation, handleOpusMessage } from './bot.js';

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

    // Send current online users list to the newly connected client
    socket.emit('online_users', Array.from(onlineUsers.keys()));

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

        // GPT-5.4-mini bot response — auto-reply in dedicated GPT conversation, @mention in others
        const gptId = getGptBotUserId();
        if (gptId && userId !== gptId) {
          const isGpt = await isGptConversation(data.conversationId);
          if (isGpt) {
            setTimeout(() => handleGptMessage(data.conversationId, io), 500);
          } else if (data.content?.includes('@GPT-5.4-mini')) {
            setTimeout(() => handleGptMessage(data.conversationId, io, true), 500);
          }
        }

        // Opus 4.6 bot response
        const opusId = getOpusBotUserId();
        if (opusId && userId !== opusId) {
          const isOpus = await isOpusConversation(data.conversationId);
          if (isOpus) {
            if (data.content?.trim() === '/newsession') {
              // Send a confirmation message from Opus bot
              setTimeout(async () => {
                try {
                  const confirmMsg = await Message.create({
                    sender: opusId,
                    conversation: data.conversationId,
                    content: '🔄 **新会话已创建！** 之前的对话上下文已清除，我们从头开始吧~',
                    type: 'text',
                  });
                  await Conversation.findByIdAndUpdate(data.conversationId, { lastMessage: confirmMsg._id, updatedAt: new Date() });
                  const populated = await confirmMsg.populate('sender', '-password');
                  io.to(data.conversationId).emit('receive_message', populated);
                } catch {}
              }, 300);
            } else {
              setTimeout(() => handleOpusMessage(data.conversationId, io), 500);
            }
          } else if (data.content?.includes('@Opus 4.6')) {
            setTimeout(() => handleOpusMessage(data.conversationId, io, true), 500);
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

    // ========================
    // 频道聊天 Socket 事件
    // ========================

    // Join channel room
    socket.on('join_channel', (data: { channelId: string }) => {
      socket.join(`channel:${data.channelId}`);
    });

    // Leave channel room
    socket.on('leave_channel', (data: { channelId: string }) => {
      socket.leave(`channel:${data.channelId}`);
    });

    // Send channel message
    socket.on('send_channel_message', async (data: { channelId: string; content: string; type?: string; replyTo?: string; fileInfo?: { filename: string; size: number; mimeType: string } }, ack?: Function) => {
      try {
        const channel = await Channel.findById(data.channelId);
        if (!channel) { if (ack) ack({ success: false, error: '频道不存在' }); return; }

        const team = await Team.findById(channel.team).populate('members', '-password');
        if (!team || !team.members.some((m: any) => (m._id || m).toString() === userId)) {
          if (ack) ack({ success: false, error: '无权发送' }); return;
        }

        const msgData: any = {
          sender: userId,
          channel: data.channelId,
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
        const members = team.members as any[];
        const mentionedIds: string[] = [];
        const isAllMention = mentionedUsernames.includes('所有人');
        if (isAllMention) {
          members.forEach((m: any) => { const mid = (m._id || m).toString(); if (mid !== userId) mentionedIds.push(mid); });
        } else {
          for (const uname of mentionedUsernames) {
            const found = members.find((m: any) => m.username === uname);
            if (found) { const fid = ((found as any)._id || found).toString(); if (fid !== userId) mentionedIds.push(fid); }
          }
        }
        msgData.mentions = mentionedIds;

        const message = await ChannelMessage.create(msgData);
        let populated = await message.populate('sender', '-password');
        if (data.replyTo) {
          populated = await populated.populate({ path: 'replyTo', populate: { path: 'sender', select: '-password' } });
        }

        io.to(`channel:${data.channelId}`).emit('receive_channel_message', populated);

        // Activity for mentions
        const senderUser = await User.findById(userId).select('username').lean();
        for (const mentionedId of mentionedIds) {
          try {
            await Activity.create({
              type: 'mention',
              user: mentionedId,
              actor: userId,
              message: message._id,
              description: `${(senderUser as any)?.username || '某人'} 在频道 #${channel.name} 中提到了你`,
            });
            const mentionedSocketId = onlineUsers.get(mentionedId);
            if (mentionedSocketId) {
              io.to(mentionedSocketId).emit('mentioned', { message: populated, conversationName: `#${channel.name}` });
              io.to(mentionedSocketId).emit('new_activity');
            }
          } catch {}
        }

        if (ack) ack({ success: true, message: populated });
      } catch {
        if (ack) ack({ success: false, error: '发送失败' });
      }
    });

    // Edit channel message
    socket.on('edit_channel_message', async (data: { messageId: string; content: string }, ack?: Function) => {
      try {
        const msg = await ChannelMessage.findById(data.messageId);
        if (!msg || msg.sender.toString() !== userId) { if (ack) ack({ success: false, error: '无权编辑' }); return; }
        if (msg.isDeleted) { if (ack) ack({ success: false, error: '消息已撤回' }); return; }
        const fiveMin = 5 * 60 * 1000;
        if (Date.now() - msg.timestamp.getTime() > fiveMin) { if (ack) ack({ success: false, error: '超过编辑时限' }); return; }

        msg.content = data.content;
        msg.editedAt = new Date();
        await msg.save();
        const populated = await msg.populate('sender', '-password');
        io.to(`channel:${msg.channel.toString()}`).emit('channel_message_edited', populated);
        if (ack) ack({ success: true, message: populated });
      } catch { if (ack) ack({ success: false, error: '编辑失败' }); }
    });

    // Delete channel message
    socket.on('delete_channel_message', async (data: { messageId: string }, ack?: Function) => {
      try {
        const msg = await ChannelMessage.findById(data.messageId);
        if (!msg || msg.sender.toString() !== userId) { if (ack) ack({ success: false, error: '无权撤回' }); return; }
        msg.isDeleted = true;
        msg.content = '';
        await msg.save();
        io.to(`channel:${msg.channel.toString()}`).emit('channel_message_deleted', { messageId: msg._id, channelId: msg.channel.toString() });
        if (ack) ack({ success: true });
      } catch { if (ack) ack({ success: false, error: '撤回失败' }); }
    });

    // Typing in channel
    socket.on('channel_typing', (data: { channelId: string }) => {
      socket.to(`channel:${data.channelId}`).emit('channel_user_typing', { userId, channelId: data.channelId });
    });

    // ========================
    // 多人视频会议 Socket 事件 (WebRTC Mesh)
    // ========================

    // Join meeting room
    socket.on('meeting_join', async (data: { meetingId: string }, ack?: Function) => {
      try {
        const meeting = await Meeting.findById(data.meetingId);
        if (!meeting || meeting.status === 'ended') {
          if (ack) ack({ success: false, error: '会议不存在或已结束' }); return;
        }

        socket.join(`meeting:${data.meetingId}`);

        // Get other participants already in the room
        const room = io.sockets.adapter.rooms.get(`meeting:${data.meetingId}`);
        const existingSocketIds = room ? Array.from(room).filter(id => id !== socket.id) : [];

        // Map socket ids to user ids
        const existingUsers: string[] = [];
        for (const sid of existingSocketIds) {
          const s = io.sockets.sockets.get(sid);
          if (s) existingUsers.push((s as any).userId);
        }

        // Notify existing participants about new joiner
        socket.to(`meeting:${data.meetingId}`).emit('meeting_participant_joined', {
          meetingId: data.meetingId,
          userId,
          socketId: socket.id,
        });

        // Tell the new joiner about existing participants (so they can create offers)
        if (ack) ack({
          success: true,
          existingParticipants: existingUsers.map(uid => ({ userId: uid })),
        });
      } catch {
        if (ack) ack({ success: false, error: '加入会议房间失败' });
      }
    });

    // Leave meeting room
    socket.on('meeting_leave', (data: { meetingId: string }) => {
      socket.leave(`meeting:${data.meetingId}`);
      socket.to(`meeting:${data.meetingId}`).emit('meeting_participant_left', {
        meetingId: data.meetingId,
        userId,
      });
    });

    // WebRTC offer (mesh: peer-to-peer between each pair)
    socket.on('meeting_offer', (data: { meetingId: string; targetUserId: string; offer: any }) => {
      const targetSocketId = onlineUsers.get(data.targetUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('meeting_offer', {
          meetingId: data.meetingId,
          fromUserId: userId,
          offer: data.offer,
        });
      }
    });

    // WebRTC answer
    socket.on('meeting_answer', (data: { meetingId: string; targetUserId: string; answer: any }) => {
      const targetSocketId = onlineUsers.get(data.targetUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('meeting_answer', {
          meetingId: data.meetingId,
          fromUserId: userId,
          answer: data.answer,
        });
      }
    });

    // ICE candidate for meeting
    socket.on('meeting_ice_candidate', (data: { meetingId: string; targetUserId: string; candidate: any }) => {
      const targetSocketId = onlineUsers.get(data.targetUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('meeting_ice_candidate', {
          meetingId: data.meetingId,
          fromUserId: userId,
          candidate: data.candidate,
        });
      }
    });

    // Toggle camera/mic status broadcast
    socket.on('meeting_toggle_camera', (data: { meetingId: string; enabled: boolean }) => {
      socket.to(`meeting:${data.meetingId}`).emit('meeting_camera_toggled', {
        userId, enabled: data.enabled,
      });
    });

    socket.on('meeting_toggle_mic', (data: { meetingId: string; enabled: boolean }) => {
      socket.to(`meeting:${data.meetingId}`).emit('meeting_mic_toggled', {
        userId, enabled: data.enabled,
      });
    });

    // Screen share start
    socket.on('meeting_screen_share_start', async (data: { meetingId: string }, ack?: Function) => {
      try {
        const meeting = await Meeting.findById(data.meetingId);
        if (!meeting) { if (ack) ack({ success: false, error: '会议不存在' }); return; }
        if (meeting.screenSharer && meeting.screenSharer.toString() !== userId) {
          if (ack) ack({ success: false, error: '已有人在共享屏幕' }); return;
        }
        meeting.screenSharer = userId as any;
        await meeting.save();

        socket.to(`meeting:${data.meetingId}`).emit('meeting_screen_share_started', {
          meetingId: data.meetingId,
          userId,
        });
        if (ack) ack({ success: true });
      } catch {
        if (ack) ack({ success: false, error: '开启屏幕共享失败' });
      }
    });

    // Screen share stop
    socket.on('meeting_screen_share_stop', async (data: { meetingId: string }) => {
      try {
        const meeting = await Meeting.findById(data.meetingId);
        if (meeting && meeting.screenSharer?.toString() === userId) {
          meeting.screenSharer = undefined;
          await meeting.save();
        }
      } catch {}
      socket.to(`meeting:${data.meetingId}`).emit('meeting_screen_share_stopped', {
        meetingId: data.meetingId,
        userId,
      });
    });

    // End meeting broadcast (host)
    socket.on('meeting_end', async (data: { meetingId: string }) => {
      try {
        const meeting = await Meeting.findById(data.meetingId);
        if (meeting && meeting.host.toString() === userId) {
          meeting.status = 'ended';
          meeting.endedAt = new Date();
          meeting.participants.forEach(p => { if (!p.leftAt) p.leftAt = new Date(); });
          meeting.screenSharer = undefined;
          await meeting.save();
        }
      } catch {}
      io.to(`meeting:${data.meetingId}`).emit('meeting_ended', { meetingId: data.meetingId });
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
