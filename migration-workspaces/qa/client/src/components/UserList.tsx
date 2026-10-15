import React, { useEffect, useState } from 'react';
import { fetchUsers } from '../api';

interface Props { onSelect: (userId: string) => void; onClose: () => void; }

export default function UserList({ onSelect, onClose }: Props) {
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => { fetchUsers().then(setUsers).catch(() => {}); }, []);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', background: '#fff' }}>
      <div style={{ padding: '12px 20px', borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 600, fontSize: 16 }}>👥 选择用户开始聊天</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>✕</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {users.length === 0 && (
          <div style={{ padding: 20, textAlign: 'center', color: '#999' }}>暂无其他用户</div>
        )}
        {users.map(u => (
          <div key={u.id} onClick={() => onSelect(u.id)} style={{
            display: 'flex', alignItems: 'center', padding: '10px 20px', cursor: 'pointer',
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%', background: '#6264a7',
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, fontWeight: 600, marginRight: 12,
            }}>{u.username[0]}</div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{u.username}</div>
              <div style={{ fontSize: 12, color: u.status === 'online' ? '#92c353' : '#999' }}>
                {u.status === 'online' ? '在线' : '离线'}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
