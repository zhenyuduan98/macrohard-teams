import { imageUrl } from '../utils/config';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { fetchMessages, uploadImage, uploadFile, fetchGroupMembers } from '../api';
import ProfileCard from './ProfileCard';
import { MarkdownMessage } from '../utils/formatMessage';
import { useCall } from '../contexts/CallContext';
import { useAuth } from '../contexts/AuthContext';
import { CallIcon, VideoCallIcon, AttachIcon, EmojiIcon, SendIcon, TeamsIcon, ChatIcon } from './Icons';
import { useMeeting } from '../contexts/MeetingContext';

const EMOJI_LIST = [
  ['😀','😁','😂','🤣','😃','😄','😅','😆','😉','😊','😋','😎','🤩','😍','🥰','😘'],
  ['😗','😙','😚','🙂','🤗','🤔','🤨','😐','😑','😶','🙄','😏','😣','😥','😮','🤐'],
  ['😯','😪','😫','🥱','😴','😌','😛','😜','😝','🤤','😒','😓','😔','😕','🙃','🤑'],
  ['👍','👎','👏','🙌','🤝','✌️','🤟','🤙','💪','❤️','🧡','💛','💚','💙','💜','🖤'],
  ['🎉','🎊','🎈','🔥','⭐','💯','✅','❌','⚡','💡','🎯','🚀','💻','📱','🎵','🌈'],
];

interface Props {
  conversationId: string;
  currentUserId: string;
  conversation?: any;
  onStartChat?: (userId: string) => void;
  isMobile?: boolean;
  onMobileBack?: () => void;
}

const chatTabs = ['聊天', '已共享', '组织'];

export default function ChatArea({ conversationId, currentUserId, conversation, onStartChat, isMobile, onMobileBack }: Props) {
  const [input, setInput] = useState('');
  const [activeTab, setActiveTab] = useState('聊天');
  const [messages, setMessages] = useState<any[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [typingUser, setTypingUser] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [replyTo, setReplyTo] = useState<any>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; msg: any } | null>(null);
  const [profileCard, setProfileCard] = useState<{ user: any; position: { x: number; y: number } } | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<{ name: string; size: number } | null>(null);
  const [mentionDropdown, setMentionDropdown] = useState<any[] | null>(null);
  const [mentionFilter, setMentionFilter] = useState('');
  const [mentionStartIdx, setMentionStartIdx] = useState(-1);
  const [mentionSelectedIdx, setMentionSelectedIdx] = useState(0);
  const [participants, setParticipants] = useState<any[]>([]);
  const [sharedFiles, setSharedFiles] = useState<any[]>([]);
  const [loadingShared, setLoadingShared] = useState(false);
  const [streamingContent, setStreamingContent] = useState<string | null>(null);
  const { socket, userStatuses } = useSocket();
  const { startCall, callState } = useCall();
  const { user: authUser } = useAuth();
  const { createMeeting, joinMeeting, meetingState } = useMeeting();
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isGroup = conversation?.isGroup;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
      setContextMenu(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => { document.removeEventListener('mousedown', handleClickOutside); };
  }, [showEmojiPicker]);

  const onEmojiClick = useCallback((emoji: string) => {
    setInput(prev => prev + emoji);
    setShowEmojiPicker(false);
  }, []);

  useEffect(() => {
    if (!conversationId) return;
    setMessages([]);
    setReplyTo(null);
    setEditingId(null);
    setLoadingMessages(true);
    fetchMessages(conversationId).then(setMessages).catch(() => {}).finally(() => setLoadingMessages(false));
    socket?.emit('join_conversation', { conversationId });
  }, [conversationId, socket]);

  // Refresh messages when page becomes visible again
  useEffect(() => {
    if (!conversationId) return;
    const handleVisibility = () => {
      if (!document.hidden) {
        fetchMessages(conversationId).then(setMessages).catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [conversationId]);

  // Load participants for mentions
  useEffect(() => {
    if (!conversationId) return;
    fetchGroupMembers(conversationId).then(setParticipants).catch(() => setParticipants([]));
  }, [conversationId]);

  useEffect(() => {
    if (!socket || !conversationId) return;
    const handler = (msg: any) => {
      if ((msg.conversation || msg.conversation?._id) === conversationId ||
          msg.conversation === conversationId) {
        setMessages(prev => {
          if (prev.some(m => m._id === msg._id)) return prev;
          return [...prev, msg];
        });
      }
    };
    const editHandler = (msg: any) => {
      setMessages(prev => prev.map(m => m._id === msg._id ? { ...m, content: msg.content, editedAt: msg.editedAt } : m));
    };
    const deleteHandler = (data: { messageId: string }) => {
      setMessages(prev => prev.map(m => m._id === data.messageId ? { ...m, isDeleted: true, content: '' } : m));
    };
    socket.on('receive_message', handler);
    socket.on('message_edited', editHandler);
    socket.on('message_deleted', deleteHandler);
    return () => {
      socket.off('receive_message', handler);
      socket.off('message_edited', editHandler);
      socket.off('message_deleted', deleteHandler);
    };
  }, [socket, conversationId]);

  // GPT streaming listener
  useEffect(() => {
    if (!socket || !conversationId) return;
    const streamHandler = (data: { conversationId: string; content: string; done: boolean }) => {
      if (data.conversationId === conversationId) {
        if (data.done) {
          setStreamingContent(null);
        } else {
          setStreamingContent(data.content);
        }
      }
    };
    socket.on('gpt_stream_chunk', streamHandler);
    return () => { socket.off('gpt_stream_chunk', streamHandler); };
  }, [socket, conversationId]);

  // Opus streaming listener
  useEffect(() => {
    if (!socket || !conversationId) return;
    const streamHandler = (data: { conversationId: string; content: string; done: boolean }) => {
      if (data.conversationId === conversationId) {
        if (data.done) {
          setStreamingContent(null);
        } else {
          setStreamingContent(data.content);
        }
      }
    };
    socket.on('opus_stream_chunk', streamHandler);
    return () => { socket.off('opus_stream_chunk', streamHandler); };
  }, [socket, conversationId]);

  useEffect(() => {
    if (!socket || !conversationId) return;
    const handler = (data: { userId: string; conversationId: string }) => {
      if (data.conversationId === conversationId && data.userId !== currentUserId) {
        setTypingUser('对方');
        clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => setTypingUser(''), 2000);
      }
    };
    socket.on('user_typing', handler);
    return () => { socket.off('user_typing', handler); };
  }, [socket, conversationId, currentUserId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUser, streamingContent]);

  if (!conversationId) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: 16, background: 'var(--bg-primary)', gap: 8 }}>
        <ChatIcon size={16} />
        <span>选择一个对话开始聊天</span>
      </div>
    );
  }

  const send = () => {
    if (!input.trim() || !socket) return;
    const data: any = { conversationId, content: input.trim(), type: 'text' };
    if (replyTo) data.replyTo = replyTo._id;
    socket.emit('send_message', data);
    setInput('');
    setReplyTo(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isImage = file.type.startsWith('image/');
    if (isImage) {
      setSelectedImage(file);
      setImagePreview(URL.createObjectURL(file));
      setSelectedFile(null);
      setFilePreview(null);
    } else {
      setSelectedFile(file);
      setFilePreview({ name: file.name, size: file.size });
      setSelectedImage(null);
      setImagePreview(null);
    }
    e.target.value = '';
  };

  const cancelFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
  };

  const sendFile = async () => {
    if (!selectedFile || !socket || uploading) return;
    setUploading(true);
    try {
      const result = await uploadFile(selectedFile);
      socket.emit('send_message', {
        conversationId,
        content: result.url,
        type: 'file',
        fileInfo: { filename: result.filename, size: result.size, mimeType: result.mimeType },
      });
      cancelFile();
    } catch { alert('文件上传失败'); }
    finally { setUploading(false); }
  };

  const cancelImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setSelectedImage(null);
    setImagePreview(null);
  };

  const sendImage = async () => {
    if (!selectedImage || !socket || uploading) return;
    setUploading(true);
    try {
      const url = await uploadImage(selectedImage);
      socket.emit('send_message', { conversationId, content: url, type: 'image' });
      cancelImage();
    } catch {
      alert('图片上传失败');
    } finally {
      setUploading(false);
    }
  };

  const handleTyping = () => { socket?.emit('typing', { conversationId }); };

  const startEdit = (msg: any) => {
    setEditingId(msg._id);
    setEditContent(msg.content);
    setContextMenu(null);
  };

  const saveEdit = () => {
    if (!editContent.trim() || !socket || !editingId) return;
    socket.emit('edit_message', { messageId: editingId, content: editContent.trim() });
    setEditingId(null);
    setEditContent('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditContent('');
  };

  const handleDelete = (msg: any) => {
    if (!socket) return;
    socket.emit('delete_message', { messageId: msg._id });
    setContextMenu(null);
  };

  const handleReply = (msg: any) => {
    setReplyTo(msg);
    setContextMenu(null);
  };

  const handleContextMenu = (e: React.MouseEvent, msg: any) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, msg });
  };

  const handleAvatarClick = (e: React.MouseEvent, msg: any) => {
    e.stopPropagation();
    const sender = msg.sender;
    if (!sender || typeof sender === 'string') return;
    const senderId = sender._id || sender.id;
    const st = userStatuses.get(senderId);
    setProfileCard({
      user: { ...sender, statusText: st?.statusText || sender.statusText || '', statusType: st?.statusType || sender.statusType || 'available' },
      position: { x: e.clientX, y: e.clientY },
    });
  };

  const getSenderId = (msg: any) => msg.sender?._id || msg.sender?.id || msg.sender;
  const getSenderName = (msg: any) => msg.sender?.username || '';
  const getSenderAvatar = (msg: any) => msg.sender?.avatar || '';
  const isBot = (msg: any) => getSenderName(msg) === 'MacroBot' || getSenderName(msg) === 'GPT-5.4-mini' || getSenderName(msg) === 'Opus 4.6' || msg.sender?.isBot;
  const formatTime = (ts: string) => new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };
  const getFileIcon = (mime: string) => {
    if (mime?.includes('pdf')) return '📄';
    if (mime?.includes('excel') || mime?.includes('spreadsheet')) return '📊';
    if (mime?.includes('word') || mime?.includes('document')) return '📝';
    if (mime?.includes('zip') || mime?.includes('compressed') || mime?.includes('archive')) return '📦';
    return '📄';
  };
  const renderMentions = (text: string) => {
    const parts = text.split(/(@\S+)/g);
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        return <span key={i} style={{ color: '#6264a7', fontWeight: 600 }}>{part}</span>;
      }
      return part;
    });
  };
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInput(val);
    handleTyping();
    // Check for @ mention
    const cursorPos = e.target.selectionStart || val.length;
    const textBefore = val.substring(0, cursorPos);
    const atIdx = textBefore.lastIndexOf('@');
    if (atIdx >= 0 && (atIdx === 0 || textBefore[atIdx - 1] === ' ')) {
      const filter = textBefore.substring(atIdx + 1);
      if (!filter.includes(' ')) {
        setMentionStartIdx(atIdx);
        setMentionFilter(filter);
        const gptEntry = { _id: 'gpt', username: 'GPT-5.4-mini', isBot: true, avatar: '/uploads/gpt-avatar.png' };
        const opusEntry = { _id: 'opus', username: 'Opus 4.6', isBot: true, avatar: '/uploads/opus-avatar.png' };
        const allOptions = [{ _id: 'all', username: '所有人' }, ...participants.filter((p: any) => (p._id || p.id) !== currentUserId), ...(participants.some((p: any) => p.username === 'GPT-5.4-mini') ? [] : [gptEntry]), ...(participants.some((p: any) => p.username === 'Opus 4.6') ? [] : [opusEntry])]
          .filter(p => p.username.toLowerCase().includes(filter.toLowerCase()));
        setMentionDropdown(allOptions.length > 0 ? allOptions : null);
        setMentionSelectedIdx(0);
        return;
      }
    }
    setMentionDropdown(null);
  };
  const selectMention = (user: any) => {
    const before = input.substring(0, mentionStartIdx);
    const after = input.substring(mentionStartIdx + 1 + mentionFilter.length);
    setInput(before + '@' + user.username + ' ' + after);
    setMentionDropdown(null);
    inputRef.current?.focus();
  };
  const loadSharedFiles = async () => {
    if (!conversationId) return;
    setLoadingShared(true);
    try {
      const msgs = await fetchMessages(conversationId + '?type=file,image');
      setSharedFiles(msgs);
    } catch { setSharedFiles([]); }
    finally { setLoadingShared(false); }
  };

  const canEdit = (msg: any) => {
    if (getSenderId(msg) !== currentUserId) return false;
    if (msg.isDeleted) return false;
    const fiveMin = 5 * 60 * 1000;
    return Date.now() - new Date(msg.timestamp).getTime() < fiveMin;
  };

  const headerTitle = isGroup ? (conversation?.name || '群聊') : '对话';
  const headerSub = isGroup ? `${conversation?.participants?.length || 0} 位成员` : '';

  return (
    <div className={isMobile ? 'chat-area-mobile' : ''} style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)', ...(isMobile ? { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 } : {}) }}>
      {/* Header */}
      <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-primary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {isMobile && onMobileBack && (
            <button onClick={onMobileBack} style={{ background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', padding: '4px 8px', color: '#6264a7', fontWeight: 600 }}>返回</button>
          )}
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: isGroup ? '#464775' : '#6264a7',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600,
            fontSize: isGroup ? 18 : 16,
          }}>{isGroup ? <TeamsIcon size={20} /> : <ChatIcon size={20} />}</div>
          <div>
            <span style={{ fontWeight: 600, fontSize: 16 }}>{headerTitle}</span>
            {headerSub && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{headerSub}</div>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {!isGroup && conversation && (() => {
            const other = conversation.participants?.find((p: any) => (p._id || p.id || p) !== currentUserId);
            const isOtherBot = other?.isBot || other?.username === 'GPT-5.4-mini';
            return !isOtherBot;
          })() && (
            <>
              <button onClick={() => {
                const other = conversation.participants?.find((p: any) => (p._id || p.id || p) !== currentUserId);
                if (!other || callState !== 'idle') return;
                const otherId = other._id || other.id || other;
                const otherName = other.username || '用户';
                startCall({ targetUserId: otherId, targetName: otherName, targetAvatar: other.avatar || '', callType: 'audio', conversationId });
              }} disabled={callState !== 'idle'} style={{
                background: 'none', border: 'none', fontSize: 20, cursor: callState === 'idle' ? 'pointer' : 'default',
                padding: '4px 8px', borderRadius: 4, opacity: callState === 'idle' ? 1 : 0.4,
              }} title="语音通话"><CallIcon size={20} /></button>
              <button onClick={() => {
                const other = conversation.participants?.find((p: any) => (p._id || p.id || p) !== currentUserId);
                if (!other || callState !== 'idle') return;
                const otherId = other._id || other.id || other;
                const otherName = other.username || '用户';
                startCall({ targetUserId: otherId, targetName: otherName, targetAvatar: other.avatar || '', callType: 'video', conversationId });
              }} disabled={callState !== 'idle'} style={{
                background: 'none', border: 'none', fontSize: 20, cursor: callState === 'idle' ? 'pointer' : 'default',
                padding: '4px 8px', borderRadius: 4, opacity: callState === 'idle' ? 1 : 0.4,
              }} title="视频通话"><VideoCallIcon size={20} /></button>
            </>
          )}
          {isGroup && (
            <button onClick={async () => {
              if (meetingState !== 'idle') return;
              const id = await createMeeting(conversation?.name || '群聊会议', undefined, conversationId);
              if (id) await joinMeeting(id);
            }} disabled={meetingState !== 'idle'} style={{
              background: '#6264a7', color: '#fff', border: 'none', borderRadius: 6,
              padding: '4px 12px', cursor: meetingState === 'idle' ? 'pointer' : 'default', fontSize: 13, fontWeight: 600,
              opacity: meetingState === 'idle' ? 1 : 0.5,
            }}>🎥 会议</button>
          )}
          {(!isMobile) && chatTabs.map(t => (
            <button key={t} onClick={() => { setActiveTab(t); if (t === '已共享') loadSharedFiles(); }} style={{
              padding: '4px 12px', borderRadius: 4, border: 'none', fontSize: 13, cursor: 'pointer',
              background: activeTab === t ? 'var(--msg-sent)' : 'transparent',
              color: activeTab === t ? '#6264a7' : 'var(--text-secondary)', fontWeight: activeTab === t ? 600 : 400,
            }}>{t}</button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loadingMessages && messages.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 40, fontSize: 14 }}>加载中...</div>
        )}
        {messages.map(msg => {
          const isMe = getSenderId(msg) === currentUserId;
          const isImage = msg.type === 'image';
          const isDeleted = msg.isDeleted;
          const isEditing = editingId === msg._id;
          const replyMsg = msg.replyTo;
          const senderAvatar = getSenderAvatar(msg);
          const isBotMsg = isBot(msg);

          return (
            <div
              key={msg._id}
              style={{ display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row', alignItems: 'flex-start', gap: 8 }}
              onContextMenu={e => handleContextMenu(e, msg)}
            >
              {/* Avatar */}
              {!isDeleted && (
                <div onClick={e => handleAvatarClick(e, msg)} style={{ cursor: 'pointer', flexShrink: 0, marginTop: (isGroup || !isMe) ? 16 : 0 }}>
                  {isBotMsg ? (
                    senderAvatar ? (
                      <img src={imageUrl(senderAvatar)} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', background: '#fff' }} />
                    ) : (
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%', background: '#7c4dff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                      }}>🤖</div>
                    )
                  ) : senderAvatar ? (
                    <img src={imageUrl(senderAvatar)} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%', background: '#6264a7',
                      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 600,
                    }}>{getSenderName(msg)?.[0]?.toUpperCase() || '?'}</div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', maxWidth: isMobile ? '85%' : '65%' }}>
                {/* Sender name */}
                {(isGroup || !isMe) && !isDeleted && (
                  <span style={{ fontSize: 12, color: isBotMsg ? '#7c4dff' : 'var(--text-secondary)', marginBottom: 2, marginLeft: 4, fontWeight: isBotMsg ? 600 : 400 }}>{getSenderName(msg)}</span>
                )}

                {/* Reply quote */}
                {replyMsg && !isDeleted && (
                  <div style={{
                    padding: '4px 10px', borderRadius: '6px 6px 0 0',
                    background: 'var(--bg-secondary)', borderLeft: '3px solid #6264a7',
                    fontSize: 12, color: 'var(--text-secondary)', marginBottom: -2,
                  }}>
                    <span style={{ fontWeight: 600 }}>{replyMsg.sender?.username || '用户'}</span>
                    <span style={{ marginLeft: 6 }}>{replyMsg.isDeleted ? '消息已撤回' : (replyMsg.content?.substring(0, 50) || '')}{replyMsg.content?.length > 50 ? '...' : ''}</span>
                  </div>
                )}

                {/* Message bubble */}
                {isDeleted ? (
                  <div style={{
                    padding: '8px 14px', borderRadius: 8,
                    background: 'var(--bg-secondary)', fontStyle: 'italic', color: 'var(--text-secondary)', fontSize: 13,
                  }}>
                    消息已撤回
                  </div>
                ) : isEditing ? (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input
                      value={editContent}
                      onChange={e => setEditContent(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                      autoFocus
                      style={{ flex: 1, padding: '8px 12px', border: '1px solid #6264a7', borderRadius: 6, fontSize: 14, outline: 'none', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                    />
                    <button onClick={saveEdit} style={{ background: '#6264a7', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 10px', cursor: 'pointer', fontSize: 13 }}>保存</button>
                    <button onClick={cancelEdit} style={{ background: 'var(--border)', border: 'none', borderRadius: 4, padding: '6px 10px', cursor: 'pointer', fontSize: 13 }}>取消</button>
                  </div>
                ) : (
                  <div style={{ position: 'relative' }}>
                    {/* Hover actions */}
                    <div className="msg-actions" style={{
                      position: 'absolute', top: -8, right: isMe ? 'auto' : -60, left: isMe ? -60 : 'auto',
                      display: 'none', gap: 2, background: 'var(--bg-card)', borderRadius: 4, boxShadow: '0 1px 4px var(--shadow)', padding: 2,
                    }}>
                      <button onClick={() => handleReply(msg)} title="回复" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: '2px 4px' }}>↩️</button>
                      {isMe && canEdit(msg) && <button onClick={() => startEdit(msg)} title="编辑" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: '2px 4px' }}>✏️</button>}
                      {isMe && <button onClick={() => handleDelete(msg)} title="撤回" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: '2px 4px' }}>🗑️</button>}
                    </div>
                    <div
                      style={{
                        padding: '8px 14px', borderRadius: 8,
                        background: isBotMsg ? 'var(--msg-bot)' : isMe ? 'var(--msg-sent)' : 'var(--msg-received)',
                        borderLeft: isBotMsg ? '3px solid var(--msg-bot-border)' : isMe ? 'none' : '3px solid var(--border)',
                        borderRight: isMe && !isBotMsg ? '3px solid #6264a7' : 'none',
                      }}
                      onMouseEnter={e => {
                        const actions = e.currentTarget.parentElement?.querySelector('.msg-actions') as HTMLElement;
                        if (actions) actions.style.display = 'flex';
                      }}
                      onMouseLeave={e => {
                        const actions = e.currentTarget.parentElement?.querySelector('.msg-actions') as HTMLElement;
                        if (actions) actions.style.display = 'none';
                      }}
                    >
                      {isImage ? (
                        <img
                          src={imageUrl(msg.content)}
                          alt="图片"
                          style={{ maxWidth: isMobile ? '70vw' : 300, maxHeight: 300, borderRadius: 6, cursor: 'pointer', display: 'block' }}
                          onClick={() => setLightboxSrc(imageUrl(msg.content))}
                        />
                      ) : msg.type === 'file' ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 4 }}>
                          <span style={{ fontSize: 28 }}>{getFileIcon(msg.fileInfo?.mimeType)}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{msg.fileInfo?.filename || '文件'}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{formatFileSize(msg.fileInfo?.size || 0)}</div>
                          </div>
                          <a href={imageUrl(msg.content)} download={msg.fileInfo?.filename} style={{
                            background: '#6264a7', color: '#fff', border: 'none', borderRadius: 4,
                            padding: '4px 10px', fontSize: 12, textDecoration: 'none', cursor: 'pointer',
                          }}>下载</a>
                        </div>
                      ) : isBotMsg ? (
                          <div style={{ fontSize: 14, lineHeight: 1.5, margin: 0 }}>
                            <MarkdownMessage content={msg.content} />
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(msg.content).then(() => {
                                  const btn = document.getElementById(`copy-btn-${msg._id}`);
                                  if (btn) { btn.textContent = '✅ 已复制'; setTimeout(() => { btn.textContent = '📋 复制'; }, 1500); }
                                });
                              }}
                              id={`copy-btn-${msg._id}`}
                              style={{
                                background: 'var(--bg-hover, #f0f0f0)', border: '1px solid var(--border, #e0e0e0)',
                                borderRadius: 4, padding: '3px 10px', fontSize: 12, cursor: 'pointer',
                                color: 'var(--text-secondary)', marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 4,
                              }}
                            >📋 复制</button>
                          </div>
                        ) : (
                          <p style={{ fontSize: 14, lineHeight: 1.5, margin: 0 }}>{renderMentions(msg.content)}</p>
                        )}
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', textAlign: 'right', marginTop: 4 }}>
                        {formatTime(msg.timestamp)}
                        {msg.editedAt && <span style={{ marginLeft: 4, fontStyle: 'italic' }}>(已编辑)</span>}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {streamingContent && (
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ flexShrink: 0, marginTop: 16 }}>
              <img src={imageUrl('/uploads/gpt-avatar.png')} alt="GPT-5.4-mini" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', background: '#fff' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', maxWidth: isMobile ? '85%' : '65%' }}>
              <span style={{ fontSize: 12, color: '#7c4dff', marginBottom: 2, marginLeft: 4, fontWeight: 600 }}>GPT-5.4-mini</span>
              <div style={{
                padding: '8px 14px', borderRadius: 8,
                background: 'var(--msg-bot)', borderLeft: '3px solid var(--msg-bot-border)',
              }}>
                <p style={{ fontSize: 14, lineHeight: 1.5, margin: 0 }}>
                  <MarkdownMessage content={streamingContent} /><span style={{ animation: 'blink 1s step-end infinite', fontWeight: 700 }}>▌</span>
                </p>
              </div>
            </div>
          </div>
        )}
        {typingUser && (
          <div style={{ fontSize: 13, color: '#6264a7', fontStyle: 'italic', padding: '4px 0' }}>
            {typingUser} 正在输入...
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Profile Card */}
      {profileCard && (
        <ProfileCard
          user={profileCard.user}
          position={profileCard.position}
          onClose={() => setProfileCard(null)}
          onSendMessage={onStartChat ? (userId) => { setProfileCard(null); onStartChat(userId); } : undefined}
        />
      )}

      {/* Context menu */}
      {contextMenu && (
        <div style={{
          position: 'fixed', left: contextMenu.x, top: contextMenu.y, zIndex: 10000,
          background: 'var(--bg-card)', borderRadius: 8, boxShadow: '0 4px 16px var(--shadow)',
          padding: 4, minWidth: 120,
        }}>
          <div onClick={() => handleReply(contextMenu.msg)} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 14, borderRadius: 4 }}
            onMouseOver={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
            onMouseOut={e => (e.currentTarget.style.background = 'transparent')}>
            ↩️ 回复
          </div>
          {getSenderId(contextMenu.msg) === currentUserId && !contextMenu.msg.isDeleted && (
            <>
              {canEdit(contextMenu.msg) && (
                <div onClick={() => startEdit(contextMenu.msg)} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 14, borderRadius: 4 }}
                  onMouseOver={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                  onMouseOut={e => (e.currentTarget.style.background = 'transparent')}>
                  ✏️ 编辑
                </div>
              )}
              <div onClick={() => handleDelete(contextMenu.msg)} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 14, borderRadius: 4, color: '#e53935' }}
                onMouseOver={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                onMouseOut={e => (e.currentTarget.style.background = 'transparent')}>
                🗑️ 撤回
              </div>
            </>
          )}
        </div>
      )}

      {/* Shared files tab */}
      {activeTab === '已共享' && (
        <div style={{ position: 'absolute', top: 52, left: 0, right: 0, bottom: 0, background: 'var(--bg-primary)', zIndex: 10, overflowY: 'auto', padding: 16 }}>
          {loadingShared ? <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 20 }}>加载中...</div> : sharedFiles.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 20 }}>暂无共享文件</div>
          ) : sharedFiles.map((msg: any) => (
            <div key={msg._id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--bg-hover)' }}>
              {msg.type === 'image' ? (
                <img src={imageUrl(msg.content)} alt="" style={{ width: 40, height: 40, borderRadius: 4, objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: 28 }}>{getFileIcon(msg.fileInfo?.mimeType)}</span>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {msg.type === 'image' ? '🖼️ 图片' : (msg.fileInfo?.filename || '文件')}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{getSenderName(msg)} · {formatTime(msg.timestamp)}</div>
              </div>
              <a href={imageUrl(msg.content)} download={msg.fileInfo?.filename || true} style={{
                color: '#6264a7', fontSize: 12, textDecoration: 'none',
              }}>下载</a>
            </div>
          ))}
        </div>
      )}

      {/* Mention dropdown - intentionally empty here, rendered inside input container below */}

      {/* File preview */}
      {filePreview && (
        <div style={{ padding: '8px 20px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-tertiary)' }}>
          <span style={{ fontSize: 28 }}>📄</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{filePreview.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{formatFileSize(filePreview.size)}</div>
          </div>
          <button onClick={cancelFile} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text-secondary)' }}>✕</button>
          <button onClick={sendFile} disabled={uploading} style={{
            background: '#6264a7', color: '#fff', border: 'none', borderRadius: 6,
            padding: '6px 14px', cursor: uploading ? 'default' : 'pointer', fontSize: 13, fontWeight: 600,
            opacity: uploading ? 0.6 : 1,
          }}>{uploading ? '上传中...' : '发送文件'}</button>
        </div>
      )}

      {/* Reply preview */}
      {replyTo && (
        <div style={{
          padding: '8px 20px', borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <div style={{ flex: 1, borderLeft: '3px solid #6264a7', paddingLeft: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#6264a7' }}>回复 {replyTo.sender?.username || '用户'}</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {replyTo.type === 'image' ? '🖼️ 图片' : replyTo.content?.substring(0, 60)}
            </div>
          </div>
          <button onClick={() => setReplyTo(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text-secondary)' }}>✕</button>
        </div>
      )}

      {/* Image preview */}
      {imagePreview && (
        <div style={{ padding: '8px 20px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-tertiary)' }}>
          <div style={{ position: 'relative' }}>
            <img src={imagePreview} alt="预览" style={{ height: 60, borderRadius: 6, objectFit: 'cover' }} />
            <button onClick={cancelImage} style={{
              position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%',
              background: 'var(--danger, #e53935)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, padding: 0,
            }}>✕</button>
          </div>
          <button onClick={sendImage} disabled={uploading} style={{
            background: '#6264a7', color: '#fff', border: 'none', borderRadius: 6,
            padding: '6px 14px', cursor: uploading ? 'default' : 'pointer', fontSize: 13, fontWeight: 600,
            opacity: uploading ? 0.6 : 1,
          }}>{uploading ? '上传中...' : '发送图片'}</button>
        </div>
      )}

      {/* Input */}
      <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, position: 'relative', background: 'var(--bg-primary)' }}>
        {/* Mention dropdown anchored above input */}
        {mentionDropdown && (
          <div style={{
            position: 'absolute', bottom: '100%', left: 20, zIndex: 1000,
            background: 'var(--bg-card)', borderRadius: 8, boxShadow: '0 4px 16px var(--shadow)',
            padding: 0, maxHeight: 260, overflowY: 'auto', width: 280, marginBottom: 4,
          }}>
            <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, borderBottom: '1px solid var(--bg-hover)' }}>建议</div>
            {mentionDropdown.map((u: any, idx: number) => {
              const isGpt = u.username === 'GPT-5.4-mini';
              const isSelected = idx === mentionSelectedIdx;
              return (
                <div key={u._id || u.id} onClick={() => selectMention(u)} style={{
                  padding: '8px 12px', cursor: 'pointer', fontSize: 14, borderRadius: 4,
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: isSelected ? 'var(--msg-sent)' : 'transparent',
                }}
                onMouseEnter={() => setMentionSelectedIdx(idx)}
                >
                  {isGpt ? (
                    <img src={imageUrl('/uploads/gpt-avatar.png')} alt="GPT-5.4-mini" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', background: '#fff', flexShrink: 0 }} />
                  ) : u._id === 'all' ? (
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%', background: '#464775',
                      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600, flexShrink: 0,
                    }}>@</div>
                  ) : (
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%', background: '#6264a7',
                      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0,
                    }}>{u.username?.[0]?.toUpperCase() || '?'}</div>
                  )}
                  <div>
                    <div style={{ fontWeight: 500 }}>{u.username}</div>
                    {isGpt && <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>AI 助手</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <input type="file" ref={fileInputRef} accept="*/*" style={{ display: 'none' }} onChange={handleFileSelect} />
        <button onClick={() => fileInputRef.current?.click()} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', color: '#888' }} title="发送图片"><AttachIcon size={20} /></button>
        <div style={{ position: 'relative' }} ref={emojiPickerRef}>
          <button onClick={() => setShowEmojiPicker(prev => !prev)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', color: '#888' }} title="表情">
            <EmojiIcon size={20} />
          </button>
          {showEmojiPicker && (
            <div style={{ position: 'absolute', bottom: 45, left: 0, zIndex: 1000, boxShadow: '0 4px 20px var(--shadow)', borderRadius: 8, background: 'var(--bg-card)', padding: 12, width: 340 }}>
              {EMOJI_LIST.map((row, i) => (
                <div key={i} style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                  {row.map(emoji => (
                    <button key={emoji} onClick={() => onEmojiClick(emoji)} style={{
                      background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', padding: 4,
                      borderRadius: 4, lineHeight: 1,
                    }}
                    onMouseOver={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                    onMouseOut={e => (e.currentTarget.style.background = 'none')}
                    >{emoji}</button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
        <input value={input} onChange={handleInputChange} ref={inputRef}
          onKeyDown={e => {
            if (mentionDropdown) {
              if (e.key === 'ArrowDown') { e.preventDefault(); setMentionSelectedIdx(i => Math.min(i + 1, mentionDropdown.length - 1)); return; }
              if (e.key === 'ArrowUp') { e.preventDefault(); setMentionSelectedIdx(i => Math.max(i - 1, 0)); return; }
              if (e.key === 'Enter') { e.preventDefault(); selectMention(mentionDropdown[mentionSelectedIdx]); return; }
              if (e.key === 'Escape') { e.preventDefault(); setMentionDropdown(null); return; }
            }
            if (e.key === 'Enter') { if (selectedImage) { sendImage(); } else { send(); } }
          }}
          onPaste={e => {
            const items = e.clipboardData?.items;
            if (!items) return;
            for (let i = 0; i < items.length; i++) {
              const item = items[i];
              if (['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(item.type)) {
                e.preventDefault();
                const file = item.getAsFile();
                if (!file) return;
                setSelectedImage(file);
                setImagePreview(URL.createObjectURL(file));
                setSelectedFile(null);
                setFilePreview(null);
                return;
              }
            }
          }}
          placeholder="输入消息..."
          style={{ flex: 1, padding: '8px 14px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14, outline: 'none', background: 'var(--bg-input)', color: 'var(--text-primary)' }} />
        <button onClick={send} style={{
          background: input.trim() ? '#6264a7' : 'var(--text-disabled)', color: '#fff', border: 'none',
          borderRadius: 6, padding: '8px 16px', cursor: input.trim() ? 'pointer' : 'default', fontSize: 14, fontWeight: 600,
        }}>发送</button>
      </div>

      {/* Lightbox */}
      {lightboxSrc && (
        <div onClick={() => setLightboxSrc(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 9999, cursor: 'pointer',
        }}>
          <img src={lightboxSrc} alt="大图" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 8 }} onClick={e => e.stopPropagation()} />
          <button onClick={() => setLightboxSrc(null)} style={{
            position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.9)', border: 'none',
            borderRadius: '50%', width: 36, height: 36, fontSize: 20, cursor: 'pointer', fontWeight: 600, color: '#1a1a1a',
          }}>✕</button>
        </div>
      )}
    </div>
  );
}
