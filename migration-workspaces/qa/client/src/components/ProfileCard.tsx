import { imageUrl } from '../utils/config';
import React from 'react';

const STATUS_COLORS: Record<string, string> = {
  available: '#92c353', busy: '#e53935', away: '#f9a825', offline: '#c0c0c0',
};
const STATUS_LABELS: Record<string, string> = {
  available: '可用', busy: '忙碌', away: '离开', offline: '离线',
};

interface Props {
  user: { _id?: string; id?: string; username: string; avatar?: string; statusText?: string; statusType?: string };
  position: { x: number; y: number };
  onClose: () => void;
  onSendMessage?: (userId: string) => void;
}

export default function ProfileCard({ user, position, onClose, onSendMessage }: Props) {
  const userId = user._id || user.id || '';
  const statusType = user.statusType || 'available';
  const statusColor = STATUS_COLORS[statusType] || '#c0c0c0';

  // Position the card near click but keep it on screen
  const style: React.CSSProperties = {
    position: 'fixed', zIndex: 6000,
    left: Math.min(position.x, window.innerWidth - 260),
    top: Math.min(position.y, window.innerHeight - 220),
    background: '#fff', borderRadius: 12, padding: 20, width: 240,
    boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
  };

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 5999 }} onClick={onClose} />
      <div style={style}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ position: 'relative', marginBottom: 12 }}>
            {user.avatar ? (
              <img src={imageUrl(user.avatar)} alt="avatar" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <div style={{
                width: 64, height: 64, borderRadius: '50%', background: '#6264a7',
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 26, fontWeight: 600,
              }}>{user.username?.[0]?.toUpperCase()}</div>
            )}
            <div style={{
              position: 'absolute', bottom: 0, right: 0, width: 14, height: 14, borderRadius: '50%',
              background: statusColor, border: '2px solid #fff',
            }} />
          </div>
          <span style={{ fontSize: 16, fontWeight: 600 }}>{user.username}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor }} />
            <span style={{ fontSize: 13, color: '#616161' }}>
              {user.statusText || STATUS_LABELS[statusType] || '可用'}
            </span>
          </div>
          {onSendMessage && (
            <button onClick={() => onSendMessage(userId)} style={{
              marginTop: 16, width: '100%', padding: '8px', background: '#6264a7', color: '#fff',
              border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}>发送消息</button>
          )}
        </div>
      </div>
    </>
  );
}
