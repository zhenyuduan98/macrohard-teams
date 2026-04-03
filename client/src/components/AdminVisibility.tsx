import React, { useState, useEffect } from 'react';
import { API_BASE as API } from '../utils/config';
import { imageUrl } from '../utils/config';

interface UserItem {
  id: string;
  username: string;
  avatar?: string;
  isBot?: boolean;
}

export default function AdminVisibility() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [hiddenUsers, setHiddenUsers] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const token = localStorage.getItem('token') || '';

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  useEffect(() => {
    fetch(`${API}/admin/users`, { headers }).then(r => r.json()).then(setUsers).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedUser) return;
    fetch(`${API}/admin/visibility/${selectedUser}`, { headers })
      .then(r => r.json())
      .then(data => setHiddenUsers(new Set((data.hiddenUsers || []).map((id: any) => id.toString()))))
      .catch(() => setHiddenUsers(new Set()));
  }, [selectedUser]);

  const nonBotUsers = users.filter(u => !u.isBot);
  const contactsForSelected = nonBotUsers.filter(u => u.id !== selectedUser);

  const toggleUser = (id: string) => {
    setHiddenUsers(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const save = async () => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      await fetch(`${API}/admin/visibility/${selectedUser}`, {
        method: 'PUT', headers,
        body: JSON.stringify({ hiddenUsers: Array.from(hiddenUsers) }),
      });
    } catch {}
    setSaving(false);
  };

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Left panel - user list */}
      <div style={{
        width: 250, minWidth: 200, borderRight: '1px solid var(--border-color, #e0e0e0)',
        overflowY: 'auto', background: 'var(--bg-secondary, #f5f5f5)',
      }}>
        <div style={{ padding: '16px 12px', fontWeight: 600, fontSize: 16, color: '#6264a7' }}>
          权限管理
        </div>
        {nonBotUsers.map(u => (
          <div key={u.id} onClick={() => setSelectedUser(u.id)} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
            cursor: 'pointer',
            background: selectedUser === u.id ? '#6264a7' : 'transparent',
            color: selectedUser === u.id ? '#fff' : 'var(--text-primary, #333)',
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', overflow: 'hidden',
              background: '#6264a7', color: '#fff', display: 'flex',
              alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600, flexShrink: 0,
            }}>
              {u.avatar ? <img src={imageUrl(u.avatar)} alt="" style={{ width: 32, height: 32, objectFit: 'cover' }} /> : u.username[0]?.toUpperCase()}
            </div>
            <span style={{ fontSize: 14 }}>{u.username}</span>
          </div>
        ))}
      </div>

      {/* Right panel - visibility checkboxes */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        {!selectedUser ? (
          <div style={{ color: '#999', textAlign: 'center', marginTop: 60, fontSize: 15 }}>
            ← 选择一个用户来管理其可见联系人
          </div>
        ) : (
          <>
            <h3 style={{ margin: '0 0 4px', color: '#6264a7' }}>
              {nonBotUsers.find(u => u.id === selectedUser)?.username} 的可见联系人
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: '#888' }}>
              取消勾选 = 该用户无法在新建聊天中看到此联系人
            </p>
            {contactsForSelected.map(u => (
              <label key={u.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px',
                cursor: 'pointer', borderBottom: '1px solid var(--border-color, #eee)',
              }}>
                <input type="checkbox" checked={!hiddenUsers.has(u.id)} onChange={() => toggleUser(u.id)}
                  style={{ width: 18, height: 18, accentColor: '#6264a7' }} />
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', overflow: 'hidden',
                  background: '#6264a7', color: '#fff', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0,
                }}>
                  {u.avatar ? <img src={imageUrl(u.avatar)} alt="" style={{ width: 28, height: 28, objectFit: 'cover' }} /> : u.username[0]?.toUpperCase()}
                </div>
                <span style={{ fontSize: 14 }}>{u.username}</span>
              </label>
            ))}
            <button onClick={save} disabled={saving} style={{
              marginTop: 20, padding: '10px 32px', background: '#6264a7', color: '#fff',
              border: 'none', borderRadius: 6, fontSize: 15, cursor: 'pointer',
              opacity: saving ? 0.6 : 1,
            }}>
              {saving ? '保存中...' : '保存'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
