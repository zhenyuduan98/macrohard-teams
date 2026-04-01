import React, { useState, useEffect } from 'react';
import { fetchUsers } from '../api';

interface Props {
  onClose: () => void;
  onCreate: (name: string, participantIds: string[]) => void;
}

export default function GroupCreateDialog({ onClose, onCreate }: Props) {
  const [users, setUsers] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchUsers().then(setUsers).catch(() => {});
  }, []);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleCreate = () => {
    if (!name.trim() || selected.size === 0) return;
    onCreate(name.trim(), Array.from(selected));
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 9999,
    }}>
      <div style={{
        background: '#fff', borderRadius: 12, padding: 24, width: 400, maxHeight: '80vh',
        display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
      }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 18, color: '#242424' }}>创建群聊</h3>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="群聊名称"
          style={{
            padding: '8px 12px', border: '1px solid #e0e0e0', borderRadius: 6,
            fontSize: 14, outline: 'none', marginBottom: 12,
          }}
        />
        <div style={{ fontSize: 13, color: '#616161', marginBottom: 8 }}>选择成员：</div>
        <div style={{ flex: 1, overflowY: 'auto', maxHeight: 300 }}>
          {users.map(u => (
            <label key={u.id} style={{
              display: 'flex', alignItems: 'center', padding: '8px 4px', cursor: 'pointer',
              borderRadius: 6, gap: 10,
            }}
            onMouseOver={e => (e.currentTarget.style.background = '#f5f5f5')}
            onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
            >
              <input
                type="checkbox"
                checked={selected.has(u.id)}
                onChange={() => toggle(u.id)}
                style={{ width: 18, height: 18, accentColor: '#6264a7' }}
              />
              <div style={{
                width: 32, height: 32, borderRadius: '50%', background: '#6264a7',
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 600, flexShrink: 0,
              }}>{u.username[0]}</div>
              <span style={{ fontSize: 14 }}>{u.username}</span>
            </label>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button onClick={onClose} style={{
            padding: '8px 16px', border: '1px solid #e0e0e0', borderRadius: 6,
            background: '#fff', cursor: 'pointer', fontSize: 14,
          }}>取消</button>
          <button onClick={handleCreate} disabled={!name.trim() || selected.size === 0} style={{
            padding: '8px 16px', border: 'none', borderRadius: 6,
            background: name.trim() && selected.size > 0 ? '#6264a7' : '#d0d0d0',
            color: '#fff', cursor: name.trim() && selected.size > 0 ? 'pointer' : 'default',
            fontSize: 14, fontWeight: 600,
          }}>创建</button>
        </div>
      </div>
    </div>
  );
}
