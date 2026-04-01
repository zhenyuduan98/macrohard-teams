import React, { useState, useEffect } from 'react';
import { fetchTeams, createChannel } from '../api';

interface Props {
  onSelectChannel: (channelId: string, channelName: string, teamName: string) => void;
  onCreateTeam: () => void;
  selectedChannelId?: string;
}

export default function TeamList({ onSelectChannel, onCreateTeam, selectedChannelId }: Props) {
  const [teams, setTeams] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [addingChannel, setAddingChannel] = useState<string | null>(null);
  const [newChannelName, setNewChannelName] = useState('');

  const loadTeams = async () => {
    try {
      const data = await fetchTeams();
      setTeams(data);
      // Auto-expand all
      const exp: Record<string, boolean> = {};
      data.forEach((t: any) => { exp[t._id] = true; });
      setExpanded(exp);
    } catch {}
  };

  useEffect(() => { loadTeams(); }, []);

  const toggleExpand = (id: string) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleAddChannel = async (teamId: string) => {
    if (!newChannelName.trim()) return;
    try {
      await createChannel(teamId, newChannelName.trim());
      setNewChannelName('');
      setAddingChannel(null);
      loadTeams();
    } catch {}
  };

  return (
    <div style={{
      width: 320, borderRight: '1px solid var(--border)', background: 'var(--bg-secondary)',
      display: 'flex', flexDirection: 'column', height: '100vh', flexShrink: 0,
    }}>
      <div style={{ padding: '12px 16px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, fontSize: 16, color: 'var(--text-primary)' }}>👥 团队</span>
        <button onClick={onCreateTeam} style={{
          background: '#6264a7', color: '#fff', border: 'none', borderRadius: 6,
          padding: '4px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
        }}>+ 新建团队</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {teams.length === 0 && (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>
            暂无团队，点击"新建团队"创建
          </div>
        )}
        {teams.map(team => (
          <div key={team._id}>
            {/* Team header */}
            <div
              onClick={() => toggleExpand(team._id)}
              style={{
                display: 'flex', alignItems: 'center', padding: '10px 16px', cursor: 'pointer',
                gap: 8,
              }}
              onMouseOver={e => (e.currentTarget.style.background = 'var(--bg-hover, #f5f5f5)')}
              onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {expanded[team._id] ? '▼' : '▶'}
              </span>
              <div style={{
                width: 32, height: 32, borderRadius: 6, background: '#464775',
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 600, flexShrink: 0,
              }}>
                {team.name[0]?.toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{team.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{team.members?.length || 0} 位成员</div>
              </div>
            </div>

            {/* Channels */}
            {expanded[team._id] && (
              <div style={{ paddingLeft: 32 }}>
                {(team.channels || []).map((ch: any) => (
                  <div
                    key={ch._id}
                    onClick={() => onSelectChannel(ch._id, ch.name, team.name)}
                    style={{
                      display: 'flex', alignItems: 'center', padding: '6px 16px', cursor: 'pointer',
                      gap: 6, fontSize: 14, color: 'var(--text-primary)',
                      background: selectedChannelId === ch._id ? 'var(--msg-sent, #e8ebfa)' : 'transparent',
                      borderLeft: selectedChannelId === ch._id ? '3px solid #6264a7' : '3px solid transparent',
                    }}
                    onMouseOver={e => { if (selectedChannelId !== ch._id) e.currentTarget.style.background = 'var(--bg-hover, #f5f5f5)'; }}
                    onMouseOut={e => { if (selectedChannelId !== ch._id) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span style={{ color: 'var(--text-secondary)' }}>#</span>
                    <span>{ch.name}</span>
                  </div>
                ))}

                {/* Add channel */}
                {addingChannel === team._id ? (
                  <div style={{ display: 'flex', padding: '4px 16px', gap: 4, alignItems: 'center' }}>
                    <input
                      value={newChannelName}
                      onChange={e => setNewChannelName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleAddChannel(team._id); if (e.key === 'Escape') { setAddingChannel(null); setNewChannelName(''); } }}
                      placeholder="频道名称"
                      autoFocus
                      style={{ flex: 1, padding: '4px 8px', border: '1px solid #ccc', borderRadius: 4, fontSize: 13, outline: 'none' }}
                    />
                    <button onClick={() => handleAddChannel(team._id)} style={{
                      background: '#6264a7', color: '#fff', border: 'none', borderRadius: 4,
                      padding: '4px 8px', cursor: 'pointer', fontSize: 12,
                    }}>✓</button>
                  </div>
                ) : (
                  <div
                    onClick={() => setAddingChannel(team._id)}
                    style={{
                      padding: '6px 16px', cursor: 'pointer', fontSize: 13,
                      color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4,
                    }}
                    onMouseOver={e => (e.currentTarget.style.color = '#6264a7')}
                    onMouseOut={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
                  >
                    <span>+</span> 添加频道
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
