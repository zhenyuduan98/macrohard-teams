import { imageUrl } from '../utils/config';
import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { ActivityIcon, ChatIcon, TeamsIcon, CalendarIcon, CallIcon, FilesIcon, LockIcon, SunIcon, MoonIcon, LogoutIcon } from './Icons';

const icons = [
  { name: '动态', icon: ActivityIcon, key: 'activity' },
  { name: '聊天', icon: ChatIcon, key: 'chat' },
  { name: '团队', icon: TeamsIcon, key: 'teams' },
  { name: '日历', icon: CalendarIcon, key: 'calendar' },
  { name: '通话', icon: CallIcon, key: 'calls' },
  { name: '文件', icon: FilesIcon, key: 'files' },
];

interface Props { onLogout: () => void; username: string; avatar?: string; onProfileClick: () => void; activeView?: string; onViewChange?: (view: string) => void; hasUnreadActivity?: boolean; isAdmin?: boolean; }

export default function Sidebar({ onLogout, username, avatar, onProfileClick, activeView = 'chat', onViewChange, hasUnreadActivity, isAdmin }: Props) {
  const { isDark, toggle } = useTheme();

  return (
    <div style={{
      width: 68, background: 'var(--bg-sidebar)', display: 'flex', flexDirection: 'column',
      alignItems: 'center', paddingTop: 12, flexShrink: 0, height: '100vh',
    }}>
      {icons.map(item => {
        const Icon = item.icon;
        return (
          <div key={item.name} title={item.name} onClick={() => onViewChange?.(item.key)} style={{
            width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 8, margin: '4px 0', cursor: 'pointer', position: 'relative',
            background: activeView === item.key ? '#464775' : 'transparent',
            border: activeView === item.key ? '2px solid #6264a7' : '2px solid transparent',
            color: activeView === item.key ? '#fff' : '#b3b3b3',
          }}>
            <Icon size={24} />
            {item.key === 'activity' && hasUnreadActivity && activeView !== 'activity' && (
              <div style={{ position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: '50%', background: '#c4314b' }} />
            )}
          </div>
        );
      })}
      {isAdmin && (
        <div title="权限管理" onClick={() => onViewChange?.('admin')} style={{
          width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 8, margin: '4px 0', cursor: 'pointer',
          background: activeView === 'admin' ? '#464775' : 'transparent',
          border: activeView === 'admin' ? '2px solid #6264a7' : '2px solid transparent',
          color: activeView === 'admin' ? '#fff' : '#b3b3b3',
        }}><LockIcon size={24} /></div>
      )}
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
        cursor: 'pointer', color: '#b3b3b3',
      }}>{isDark ? <SunIcon size={22} /> : <MoonIcon size={22} />}</div>
      <div onClick={onLogout} title="退出" style={{
        width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', marginBottom: 12, color: '#b3b3b3',
      }}><LogoutIcon size={22} /></div>
    </div>
  );
}
