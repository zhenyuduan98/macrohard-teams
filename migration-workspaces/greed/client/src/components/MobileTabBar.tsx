import React from 'react';

const tabs = [
  { key: 'chat', icon: '💬', label: '对话' },
  { key: 'teams', icon: '👥', label: '团队' },
  { key: 'calendar', icon: '📅', label: '日历' },
  { key: 'calls', icon: '📞', label: '通话' },
  { key: 'files', icon: '📁', label: '文件' },
];

interface Props {
  activeView: string;
  onViewChange: (view: string) => void;
}

export default function MobileTabBar({ activeView, onViewChange }: Props) {
  return (
    <div className="mobile-tab-bar">
      {tabs.map(t => (
        <div
          key={t.key}
          onClick={() => onViewChange(t.key)}
          className={`mobile-tab-item ${activeView === t.key ? 'active' : ''}`}
        >
          <span style={{ fontSize: 20 }}>{t.icon}</span>
          <span style={{ fontSize: 10, marginTop: 2 }}>{t.label}</span>
        </div>
      ))}
    </div>
  );
}
