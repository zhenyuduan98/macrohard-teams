import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import Sidebar from '../components/Sidebar';
import ConversationList from '../components/ConversationList';
import ChatArea from '../components/ChatArea';
import UserList from '../components/UserList';
import GroupCreateDialog from '../components/GroupCreateDialog';
import ProfilePanel from '../components/ProfilePanel';
import TeamList from '../components/TeamList';
import TeamCreateDialog from '../components/TeamCreateDialog';
import ActivityFeed from '../components/ActivityFeed';
import CalendarView from '../components/CalendarView';
import CallHistory from '../components/CallHistory';
import FilesHub from '../components/FilesHub';
import { fetchConversations, createConversation, createGroupConversation } from '../api';
import { useNotification } from '../hooks/useNotification';

export default function ChatPage() {
  const { logout, user } = useAuth();
  const { socket } = useSocket();
  const [selectedId, setSelectedId] = useState('');
  const [conversations, setConversations] = useState<any[]>([]);
  const [showUserList, setShowUserList] = useState(false);
  const [showGroupCreate, setShowGroupCreate] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [activeView, setActiveView] = useState('chat');
  const [showTeamCreate, setShowTeamCreate] = useState(false);
  const [channelConvoId, setChannelConvoId] = useState('');
  const [channelHeader, setChannelHeader] = useState({ name: '', teamName: '' });
  const [hasUnreadActivity, setHasUnreadActivity] = useState(false);
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;
  const { notify } = useNotification();

  // Update page title with unread count
  useEffect(() => {
    const total = Object.values(unreadCounts).reduce((s, n) => s + n, 0);
    document.title = total > 0 ? `(${total}) MacroHard Teams` : 'MacroHard Teams';
  }, [unreadCounts]);

  const loadConversations = useCallback(async () => {
    try {
      const data = await fetchConversations();
      setConversations(data);
    } catch {}
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  useEffect(() => {
    if (!socket) return;
    const handler = (msg: any) => {
      loadConversations();
      const convoId = msg.conversation?._id || msg.conversation;
      const senderId = msg.sender?._id || msg.sender?.id || msg.sender;
      if (convoId !== selectedRef.current && senderId !== user?.id) {
        setUnreadCounts(prev => ({ ...prev, [convoId]: (prev[convoId] || 0) + 1 }));
        const senderName = msg.sender?.username || '新消息';
        const preview = msg.type === 'image' ? '🖼️ 图片' : msg.type === 'file' ? '📄 文件' : (msg.content || '').substring(0, 30);
        notify(senderName, preview, () => handleSelect(convoId));
      }
    };

    const mentionHandler = (data: any) => {
      const convName = data.conversationName || '对话';
      const senderName = data.message?.sender?.username || '某人';
      notify(`${senderName}`, `在 ${convName} 中提到了你`, () => {
        const convoId = data.message?.conversation?._id || data.message?.conversation;
        if (convoId) handleSelect(convoId);
      });
    };

    socket.on('receive_message', handler);
    socket.on('mentioned', mentionHandler);
    socket.on('new_activity', () => setHasUnreadActivity(true));
    return () => { socket.off('receive_message', handler); socket.off('mentioned', mentionHandler); socket.off('new_activity'); };
  }, [socket, loadConversations, user?.id]);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setShowUserList(false);
    setShowGroupCreate(false);
    setUnreadCounts(prev => { const n = { ...prev }; delete n[id]; return n; });
  };

  const handleStartChat = async (participantId: string) => {
    try {
      const convo = await createConversation(participantId);
      socket?.emit('join_conversation', { conversationId: convo._id });
      await loadConversations();
      setSelectedId(convo._id);
      setShowUserList(false);
    } catch {}
  };

  const handleCreateGroup = async (name: string, participantIds: string[]) => {
    try {
      const convo = await createGroupConversation(name, participantIds);
      socket?.emit('join_conversation', { conversationId: convo._id });
      await loadConversations();
      setSelectedId(convo._id);
      setShowGroupCreate(false);
    } catch {}
  };

  const selectedConversation = conversations.find(c => c._id === selectedId);

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar onLogout={logout} username={user?.username || '?'} avatar={user?.avatar} onProfileClick={() => setShowProfile(true)} activeView={activeView} onViewChange={(v) => { setActiveView(v); if (v === 'activity') setHasUnreadActivity(false); }} hasUnreadActivity={hasUnreadActivity} />
      {activeView === 'chat' ? (
        <>
          <ConversationList
            selectedId={selectedId}
            onSelect={handleSelect}
            conversations={conversations}
            onNewChat={() => { setShowUserList(true); setShowGroupCreate(false); }}
            onNewGroup={() => { setShowGroupCreate(true); setShowUserList(false); }}
            currentUserId={user?.id || ''}
            unreadCounts={unreadCounts}
          />
          {showUserList ? (
            <UserList onSelect={handleStartChat} onClose={() => setShowUserList(false)} />
          ) : (
            <ChatArea conversationId={selectedId} currentUserId={user?.id || ''} conversation={selectedConversation} onStartChat={handleStartChat} />
          )}
        </>
      ) : activeView === 'teams' ? (
        <>
          <TeamList
            onSelectChannel={(channelId, channelName, teamName) => {
              setChannelConvoId(channelId);
              setChannelHeader({ name: channelName, teamName });
              socket?.emit('join_conversation', { conversationId: channelId });
            }}
            onCreateTeam={() => setShowTeamCreate(true)}
            selectedChannelId={channelConvoId}
          />
          <ChatArea
            conversationId={channelConvoId}
            currentUserId={user?.id || ''}
            conversation={{ isGroup: true, name: channelHeader.name ? `${channelHeader.teamName} > #${channelHeader.name}` : '' }}
            onStartChat={handleStartChat}
          />
        </>
      ) : activeView === 'activity' ? (
        <ActivityFeed onNavigate={(convoId) => { setActiveView('chat'); handleSelect(convoId); }} />
      ) : activeView === 'calendar' ? (
        <CalendarView />
      ) : activeView === 'calls' ? (
        <CallHistory currentUserId={user?.id || ''} onStartCall={(userId) => handleStartChat(userId)} />
      ) : activeView === 'files' ? (
        <FilesHub />
      ) : (
        <>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#616161' }}>
            🚧 功能开发中...
          </div>
        </>
      )}
      {showGroupCreate && (
        <GroupCreateDialog
          onClose={() => setShowGroupCreate(false)}
          onCreate={handleCreateGroup}
        />
      )}
      {showTeamCreate && (
        <TeamCreateDialog
          onClose={() => setShowTeamCreate(false)}
          onCreate={() => {}}
        />
      )}
      {showProfile && <ProfilePanel onClose={() => setShowProfile(false)} />}
    </div>
  );
}
