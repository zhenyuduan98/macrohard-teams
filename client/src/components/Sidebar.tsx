import { imageUrl } from '../utils/config';
import React from 'react';
import { useTheme } from '../contexts/ThemeContext';

const icons = [
  { name: '动态', icon: '🔔', key: 'activity' },
  { name: '聊天', icon: '💬', key: 'chat' },
  { name: '团队', icon: '👥', key: 'teams' },
  { name: '日历', icon: '📅', key: 'calendar' },
  { name: '通话', icon: '📞', key: 'calls' },
  { name: '文件', icon: '📁', key: 'files' },
];

interface Props { onLogout: () => void; username: string; avatar?: string; onProfileClick: () => void; activeView?: string; onViewChange?: (view: string) => void; hasUnreadActivity?: boolean; }

export default function Sidebar({ onLogout, username, avatar, onProfileClick, activeView = 'chat', onViewChange, hasUnreadActivity }: Props) {
  const { isDark, toggle } = useTheme();

  return (
    <div style={{
      width: 68, background: 'var(--bg-sidebar)', display: 'flex', flexDirection: 'column',
      alignItems: 'center', paddingTop: 12, flexShrink: 0, height: '100vh',
    }}>
      {icons.map(item => (
        <div key={item.name} title={item.name} onClick={() => onViewChange?.(item.key)} style={{
          width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 8, margin: '4px 0', cursor: 'pointer', fontSize: 22, position: 'relative',
          background: activeView === item.key ? '#464775' : 'transparent',
          border: activeView === item.key ? '2px solid #6264a7' : '2px solid transparent',
        }}>
          {item.icon}
          {item.key === 'activity' && hasUnreadActivity && activeView !== 'activity' && (
            <div style={{ position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: '50%', background: '#c4314b' }} />
          )}
        </div>
      ))}
      <div style={{ flex: 1 }} />
      <div onClick={onProfileClick} title={username} style={{
        width: 36, height: 36, borderRadius: '50%', overflow: 'hidden',
        background: '#6264a7', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, fontWeight: 600, marginBottom: 8, cursor: 'pointer',
      }}>
        {avatar ? (
          <img src={imageUrl(avatar)} alt="avatar" style={{ width: 36, height: 36, objectFit: 'cover' }} />
        ) : (
          username[0]?.toUpperCase()
        )}
      </div>
      <div onClick={toggle} title={isDark ? '切换到浅色模式' : '切换到深色模式'} style={{
        width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', fontSize: 20, color: '#b3b3b3',
      }}>{isDark ? '☀️' : '🌙'}</div>
      <div onClick={onLogout} title="退出" style={{
        width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', fontSize: 20, marginBottom: 12, color: '#b3b3b3',
      }}>🚪</div>
    </div>
  );
}
