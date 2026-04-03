import { imageUrl } from '../utils/config';
import React, { useState } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { searchMessages } from '../api';

const STATUS_COLORS: Record<string, string> = {
  available: '#92c353', busy: '#e53935', away: '#f9a825', offline: '#c0c0c0',
};

interface Props {
  selectedId: string;
  onSelect: (id: string) => void;
  conversations: any[];
  onNewChat: () => void;
  onNewGroup: () => void;
  currentUserId: string;
  unreadCounts?: Record<string, number>;
  isMobile?: boolean;
  onProfileClick?: () => void;
  username?: string;
  avatar?: string;
  onLogout?: () => void;
}

const tabs = ['未读', '频道', '聊天', '会议聊天'];

export default function ConversationList({ selectedId, onSelect, conversations, onNewChat, onNewGroup, currentUserId, unreadCounts = {}, isMobile, onProfileClick, username, avatar, onLogout }: Props) {
  const [activeTab, setActiveTab] = useState('聊天');
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const [searching, setSearching] = useState(false);
  const { onlineUsers, userStatuses } = useSocket();


  const handleSearch = async () => {
    if (!search.trim()) return;
    setSearching(true);
    try {
      const results = await searchMessages(search.trim());
      setSearchResults(results);
    } catch { setSearchResults([]); }
    finally { setSearching(false); }
  };

  const clearSearch = () => {
    setSearch('');
    setSearchResults(null);
  };

  const highlightText = (text: string, keyword: string) => {
    if (!keyword) return text;
    const parts = text.split(new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === keyword.toLowerCase()
        ? <span key={i} style={{ background: '#ffeb3b', padding: '0 1px' }}>{part}</span>
        : part
    );
  };

  const getOtherParticipant = (convo: any) => {
    const other = convo.participants?.find((p: any) => (p._id || p.id) !== currentUserId);
    return other || convo.participants?.[0];
  };

  const getDisplayName = (convo: any) => {
    if (convo.isGroup) return convo.name || '群聊';
    const other = getOtherParticipant(convo);
    return other?.username || '未知用户';
  };

  const filtered = conversations.filter(c => {
    if (!search) return true;
    return getDisplayName(c).includes(search);
  });

  const formatTime = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  const getStatusColor = (userId: string) => {
    const st = userStatuses.get(userId);
    if (st?.statusType) return STATUS_COLORS[st.statusType] || '#c0c0c0';
    return onlineUsers.has(userId) ? '#92c353' : '#c0c0c0';
  };

  const getStatusTooltip = (userId: string, username: string) => {
    const st = userStatuses.get(userId);
    if (st?.statusText) return `${username} - ${st.statusText}`;
    return username;
  };

  return (
    <div className={isMobile ? 'conversation-list-mobile' : ''} style={{ width: isMobile ? '100%' : 320, borderRight: isMobile ? 'none' : '1px solid var(--border)', background: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', height: isMobile ? 'calc(100vh - 56px)' : '100vh', flexShrink: 0 }}>
      {/* Mobile header */}
      {isMobile && (
        <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)' }}>
          <div onClick={onProfileClick} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
            {avatar ? (
              <img src={imageUrl(avatar)} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#6264a7', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600 }}>{username?.[0]?.toUpperCase()}</div>
            )}
            <span style={{ fontWeight: 600, fontSize: 16, color: 'var(--text-primary)' }}>聊天</span>
          </div>
          {/* Logout button hidden on mobile, shown on desktop sidebar */}
        </div>
      )}
      {/* Search */}
      <div style={{ padding: '12px 16px 8px', display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-input)', borderRadius: 6, padding: '6px 12px', flex: 1 }}>
          <span style={{ marginRight: 8, color: 'var(--text-secondary)' }}>🔍</span>
          <input placeholder="搜索" value={search} onChange={e => setSearch(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
            style={{ border: 'none', background: 'transparent', outline: 'none', flex: 1, fontSize: 14, color: 'var(--text-primary)' }} />
          {searchResults !== null && (
            <button onClick={clearSearch} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--text-secondary)', padding: 0 }}>✕</button>
          )}
        </div>
        <button onClick={onNewGroup} title="新建群聊" style={{
          background: '#6264a7', color: '#fff', border: 'none', borderRadius: 6,
          width: 32, height: 32, cursor: 'pointer', fontSize: 16, fontWeight: 600,
        }}>👥</button>
        <button onClick={onNewChat} title="新对话" style={{
          background: '#6264a7', color: '#fff', border: 'none', borderRadius: 6,
          width: 32, height: 32, cursor: 'pointer', fontSize: 18, fontWeight: 600,
        }}>+</button>
      </div>
      {/* Tabs */}
      <div style={{ display: 'flex', padding: '4px 16px 8px', gap: 4 }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{
            padding: '4px 12px', borderRadius: 16, border: 'none', fontSize: 13, cursor: 'pointer',
            background: activeTab === t ? '#6264a7' : 'var(--bg-input)',
            color: activeTab === t ? '#fff' : 'var(--text-secondary)', fontWeight: activeTab === t ? 600 : 400,
          }}>{t}</button>
        ))}
      </div>
      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Search results */}
        {searchResults !== null ? (
          <div>
            {searching ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-secondary)' }}>搜索中...</div>
            ) : searchResults.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-secondary)' }}>未找到相关消息</div>
            ) : (
              searchResults.map((msg: any) => {
                const convoId = msg.conversation?._id || msg.conversation;
                const convoName = msg.conversation?.name || msg.conversation?.isGroup ? (msg.conversation?.name || '群聊') : (msg.sender?.username || '对话');
                return (
                  <div key={msg._id} onClick={() => { onSelect(convoId); clearSearch(); }} style={{
                    padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border)',
                  }}
                  onMouseOver={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                  onMouseOut={e => (e.currentTarget.style.background = 'transparent')}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{msg.sender?.username || '用户'}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{formatTime(msg.timestamp)}</span>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 2 }}>
                      {highlightText(msg.content?.substring(0, 80) || '', search)}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{convoName}</div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
        <>
        {filtered.length === 0 && (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>
            暂无对话，点击 + 开始新聊天
          </div>
        )}
        {filtered.map(c => {
          const isGroup = c.isGroup;
          const other = !isGroup ? getOtherParticipant(c) : null;
          const otherId = other?._id || other?.id;
          const lastMsg = c.lastMessage;
          const displayName = getDisplayName(c);
          const memberCount = isGroup ? c.participants?.length : 0;
          const unread = unreadCounts[c._id] || 0;
          const lastMsgPreview = lastMsg?.isDeleted ? '消息已撤回' : lastMsg?.type === 'image' ? '🖼️ 图片' : (lastMsg?.content || '开始聊天吧');
          const statusDotColor = !isGroup && otherId ? getStatusColor(otherId) : '#c0c0c0';
          const tooltip = !isGroup && other ? getStatusTooltip(otherId, other.username) : displayName;
          const isGptBot = !isGroup && (other?.isBot || other?.username === 'GPT-5.4-mini');

          return (
            <div key={c._id} onClick={() => onSelect(c._id)} title={tooltip} style={{
              display: 'flex', alignItems: 'center', padding: '10px 16px', cursor: 'pointer',
              background: selectedId === c._id ? 'var(--msg-sent)' : 'transparent',
              borderLeft: selectedId === c._id ? '3px solid #6264a7' : '3px solid transparent',
            }}>
              <div style={{ position: 'relative', marginRight: 12 }}>
                {isGroup ? (
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%', background: '#464775',
                    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18,
                  }}>👥</div>
                ) : isGptBot ? (
                  other?.avatar ? (
                    <img src={imageUrl(other.avatar)} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', background: '#fff' }} />
                  ) : (
                    <div style={{
                      width: 40, height: 40, borderRadius: '50%', background: '#7c4dff',
                      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 20,
                    }}>🤖</div>
                  )
                ) : (
                  <>
                    {other?.avatar ? (
                      <img src={imageUrl(other.avatar)} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{
                        width: 40, height: 40, borderRadius: '50%', background: '#6264a7',
                        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 16, fontWeight: 600,
                      }}>{displayName[0]}</div>
                    )}
                    <div style={{
                      position: 'absolute', bottom: 0, right: 0, width: 12, height: 12,
                      borderRadius: '50%', background: statusDotColor,
                      border: '2px solid var(--bg-secondary)',
                    }} />
                  </>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>
                    {displayName}
                    {isGroup && <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--text-secondary)', marginLeft: 6 }}>({memberCount}人)</span>}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{formatTime(c.updatedAt)}</span>
                    {unread > 0 && (
                      <span style={{
                        background: '#e53935', color: '#fff', borderRadius: 10, fontSize: 11,
                        fontWeight: 700, padding: '1px 6px', minWidth: 18, textAlign: 'center',
                      }}>{unread > 99 ? '99+' : unread}</span>
                    )}
                  </div>
                </div>
                <div style={{ marginTop: 2 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: 200 }}>
                    {lastMsgPreview}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
        </>
        )}
      </div>
    </div>
  );
}
