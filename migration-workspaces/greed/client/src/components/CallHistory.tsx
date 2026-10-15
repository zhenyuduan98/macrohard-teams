import React, { useState, useEffect } from 'react';
import axios from 'axios';

import { API_BASE as API, imageUrl } from '../utils/config';
const headers = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

interface Props {
  currentUserId: string;
  onStartCall?: (userId: string, callType: 'audio' | 'video') => void;
  onNavigate?: (conversationId: string) => void;
}

export default function CallHistory({ currentUserId, onStartCall, onNavigate }: Props) {
  const [calls, setCalls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await axios.get(`${API}/calls`, { headers: headers() });
        setCalls(r.data);
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const formatTime = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 86400000 && d.getDate() === now.getDate()) {
      return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };


  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)', overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)' }}>
        <h2 style={{ margin: 0, fontSize: 18, color: 'var(--text-primary)' }}>📞 通话记录</h2>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>加载中...</div>
        ) : calls.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>暂无通话记录</div>
        ) : calls.map(c => {
          const isOutgoing = c.caller?._id === currentUserId;
          const other = isOutgoing ? c.callee : c.caller;
          const statusColor = c.status === 'completed' ? '#4caf50' : c.status === 'missed' ? '#c4314b' : '#999';
          const statusText = c.status === 'completed' ? formatDuration(c.duration) : c.status === 'missed' ? '未接' : '已拒绝';

          return (
            <div key={c._id} style={{
              padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
            }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {/* Avatar */}
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#6264a7', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600, overflow: 'hidden', flexShrink: 0 }}>
                {other?.avatar ? <img src={imageUrl(other.avatar)} alt="" style={{ width: 36, height: 36, objectFit: 'cover' }} /> : (other?.username?.[0]?.toUpperCase() || '?')}
              </div>
              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>
                  {other?.username || '未知'} <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{isOutgoing ? '(呼出)' : '(呼入)'}</span>
                </div>
                <div style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>{c.callType === 'video' ? '🎥' : '📞'}</span>
                  <span style={{ color: statusColor, fontWeight: 500 }}>{statusText}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>· {formatTime(c.startTime)}</span>
                </div>
              </div>
              {/* Call back button */}
              <button onClick={(e) => { e.stopPropagation(); onStartCall?.(other?._id, 'audio'); }}
                style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', padding: 4 }}
                title="回拨">📞</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
