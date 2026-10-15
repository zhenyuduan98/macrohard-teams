import React, { useState, useEffect } from 'react';
import { fetchUsers, createTeam } from '../api';

interface Props {
  onClose: () => void;
  onCreate: (team: any) => void;
}

export default function TeamCreateDialog({ onClose, onCreate }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchUsers().then(setUsers).catch(() => {});
  }, []);

  const toggleUser = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleCreate = async () => {
    if (!name.trim() || creating) return;
    setCreating(true);
    try {
      const team = await createTeam(name.trim(), description.trim(), Array.from(selected));
      onCreate(team);
      onClose();
    } catch {
      alert('创建团队失败');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 9999,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 12, padding: 24, width: 400, maxHeight: '80vh',
        display: 'flex', flexDirection: 'column', gap: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
      }}>
        <h3 style={{ margin: 0, fontSize: 18 }}>新建团队</h3>

        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>团队名称 *</label>
          <input
            value={name} onChange={e => setName(e.target.value)}
            placeholder="输入团队名称"
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #ccc', borderRadius: 6, fontSize: 14, outline: 'none', marginTop: 4, boxSizing: 'border-box' }}
          />
        </div>

        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>描述</label>
          <input
            value={description} onChange={e => setDescription(e.target.value)}
            placeholder="团队描述（可选）"
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #ccc', borderRadius: 6, fontSize: 14, outline: 'none', marginTop: 4, boxSizing: 'border-box' }}
          />
        </div>

        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>选择成员</label>
          <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #eee', borderRadius: 6, marginTop: 4 }}>
            {users.map(u => (
              <div key={u.id} onClick={() => toggleUser(u.id)} style={{
                display: 'flex', alignItems: 'center', padding: '8px 12px', cursor: 'pointer',
                background: selected.has(u.id) ? '#e8ebfa' : 'transparent',
              }}>
                <input type="checkbox" checked={selected.has(u.id)} readOnly style={{ marginRight: 8 }} />
                <span style={{ fontSize: 14 }}>{u.username}</span>
              </div>
            ))}
            {users.length === 0 && <div style={{ padding: 12, color: '#999', textAlign: 'center', fontSize: 13 }}>暂无其他用户</div>}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{
            padding: '8px 16px', border: '1px solid #ccc', borderRadius: 6, background: '#fff',
            cursor: 'pointer', fontSize: 14,
          }}>取消</button>
          <button onClick={handleCreate} disabled={!name.trim() || creating} style={{
            padding: '8px 16px', border: 'none', borderRadius: 6, background: name.trim() ? '#6264a7' : '#ccc',
            color: '#fff', cursor: name.trim() ? 'pointer' : 'default', fontSize: 14, fontWeight: 600,
          }}>{creating ? '创建中...' : '创建团队'}</button>
        </div>
      </div>
    </div>
  );
}
