import React, { useState, useEffect } from 'react';
import axios from 'axios';

import { API_BASE as API } from '../utils/config';
const headers = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

interface Props {
  onNavigate?: (conversationId: string) => void;
}

export default function ActivityFeed({ onNavigate }: Props) {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const r = await axios.get(`${API}/activity`, { headers: headers() });
      setActivities(r.data);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const markAllRead = async () => {
    try {
      await axios.put(`${API}/activity/read-all`, {}, { headers: headers() });
      setActivities(prev => prev.map(a => ({ ...a, read: true })));
    } catch {}
  };

  const markRead = async (id: string) => {
    try {
      await axios.put(`${API}/activity/${id}/read`, {}, { headers: headers() });
      setActivities(prev => prev.map(a => a._id === id ? { ...a, read: true } : a));
    } catch {}
  };

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return '刚刚';
    if (mins < 60) return `${mins}分钟前`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}小时前`;
    return `${Math.floor(hrs / 24)}天前`;
  };

  const typeIcon = (type: string) => {
    switch (type) {
      case 'mention': return '📢';
      case 'reply': return '↩️';
      case 'group_join': return '👥';
      case 'event_reminder': return '📅';
      default: return '🔔';
    }
  };

  const unreadCount = activities.filter(a => !a.read).length;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)', overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: 18, color: 'var(--text-primary)' }}>🔔 动态 {unreadCount > 0 && <span style={{ fontSize: 13, color: '#6264a7' }}>({unreadCount})</span>}</h2>
        {unreadCount > 0 && (
          <button onClick={markAllRead} style={{
            background: 'none', border: '1px solid #6264a7', color: '#6264a7', borderRadius: 4,
            padding: '4px 12px', cursor: 'pointer', fontSize: 13,
          }}>全部标为已读</button>
        )}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>加载中...</div>
        ) : activities.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>暂无动态</div>
        ) : activities.map(a => (
          <div key={a._id} onClick={() => { markRead(a._id); if (a.conversation && onNavigate) onNavigate(a.conversation); }}
            style={{
              padding: '12px 20px', cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'flex-start',
              background: a.read ? 'transparent' : 'var(--bg-hover)',
              borderLeft: a.read ? '3px solid transparent' : '3px solid #6264a7',
            }}
            onMouseEnter={e => { if (a.read) (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-hover)'; }}
            onMouseLeave={e => { if (a.read) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
          >
            <span style={{ fontSize: 20, flexShrink: 0 }}>{typeIcon(a.type)}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.4 }}>{a.description}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{timeAgo(a.createdAt)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
