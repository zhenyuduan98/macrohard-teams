import { imageUrl } from '../utils/config';
import React, { useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { uploadAvatar, updateStatus } from '../api';
import { useSocket } from '../contexts/SocketContext';

const STATUS_OPTIONS = [
  { value: 'available', label: '可用', color: '#92c353' },
  { value: 'busy', label: '忙碌', color: '#e53935' },
  { value: 'away', label: '离开', color: '#f9a825' },
  { value: 'offline', label: '隐身', color: '#c0c0c0' },
];

interface Props { onClose: () => void; }

export default function ProfilePanel({ onClose }: Props) {
  const { user, setUser } = useAuth();
  const { socket } = useSocket();
  const [statusType, setStatusType] = useState(user?.statusType || 'available');
  const [statusText, setStatusText] = useState(user?.statusText || '');
  const [uploading, setUploading] = useState(false);
  const [desktopNotif, setDesktopNotif] = useState(() => {
    try { const s = localStorage.getItem('notificationSettings'); return s ? JSON.parse(s).desktop !== false : true; } catch { return true; }
  });
  const [soundNotif, setSoundNotif] = useState(() => {
    try { const s = localStorage.getItem('notificationSettings'); return s ? JSON.parse(s).sound !== false : true; } catch { return true; }
  });
  const fileRef = useRef<HTMLInputElement>(null);

  const saveNotifSettings = (desktop: boolean, sound: boolean) => {
    localStorage.setItem('notificationSettings', JSON.stringify({ desktop, sound }));
  };


  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || uploading) return;
    setUploading(true);
    try {
      const avatar = await uploadAvatar(file);
      setUser((prev: any) => prev ? { ...prev, avatar } : prev);
    } catch { alert('头像上传失败'); }
    finally { setUploading(false); e.target.value = ''; }
  };

  const handleStatusUpdate = async () => {
    try {
      await updateStatus(statusText, statusType);
      setUser((prev: any) => prev ? { ...prev, statusText, statusType } : prev);
      socket?.emit('status_change', { statusText, statusType });
    } catch { alert('状态更新失败'); }
  };

  const statusColor = STATUS_OPTIONS.find(s => s.value === statusType)?.color || '#92c353';

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 5000,
      background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 12, padding: 32, width: 360,
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h3 style={{ margin: 0, fontSize: 18 }}>个人资料</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#999' }}>✕</button>
        </div>

        {/* Avatar */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
          <div onClick={() => fileRef.current?.click()} style={{ cursor: 'pointer', position: 'relative' }}>
            {user?.avatar ? (
              <img src={imageUrl(user.avatar)} alt="avatar" style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <div style={{
                width: 80, height: 80, borderRadius: '50%', background: '#6264a7',
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 32, fontWeight: 600,
              }}>{user?.username?.[0]?.toUpperCase()}</div>
            )}
            <div style={{
              position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, borderRadius: '50%',
              background: '#6264a7', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, border: '2px solid #fff',
            }}>📷</div>
            {/* Status dot */}
            <div style={{
              position: 'absolute', bottom: 2, left: 2, width: 16, height: 16, borderRadius: '50%',
              background: statusColor, border: '2px solid #fff',
            }} />
          </div>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" style={{ display: 'none' }} onChange={handleAvatarUpload} />
          {uploading && <span style={{ fontSize: 12, color: '#999', marginTop: 4 }}>上传中...</span>}
          <span style={{ fontSize: 16, fontWeight: 600, marginTop: 8 }}>{user?.username}</span>
        </div>

        {/* Status type */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, color: '#616161', marginBottom: 4, display: 'block' }}>状态</label>
          <select value={statusType} onChange={e => setStatusType(e.target.value)} style={{
            width: '100%', padding: '8px 12px', border: '1px solid #e0e0e0', borderRadius: 6, fontSize: 14, outline: 'none',
          }}>
            {STATUS_OPTIONS.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        {/* Status text */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 13, color: '#616161', marginBottom: 4, display: 'block' }}>状态消息</label>
          <input value={statusText} onChange={e => setStatusText(e.target.value)} placeholder="例如：开会中"
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #e0e0e0', borderRadius: 6, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
        </div>

        {/* Notification settings */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 13, color: '#616161', marginBottom: 8, display: 'block' }}>通知设置</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer', fontSize: 14 }}>
            <input type="checkbox" checked={desktopNotif} onChange={e => { setDesktopNotif(e.target.checked); saveNotifSettings(e.target.checked, soundNotif); }} />
            桌面通知
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
            <input type="checkbox" checked={soundNotif} onChange={e => { setSoundNotif(e.target.checked); saveNotifSettings(desktopNotif, e.target.checked); }} />
            声音提醒
          </label>
        </div>

        <button onClick={handleStatusUpdate} style={{
          width: '100%', padding: '10px', background: '#6264a7', color: '#fff', border: 'none',
          borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer',
        }}>保存状态</button>
      </div>
    </div>
  );
}
