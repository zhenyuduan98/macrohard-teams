import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import AdminVisibility from '../components/AdminVisibility';
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
import MobileTabBar from '../components/MobileTabBar';
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
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;
  const { notify } = useNotification();

  // Mobile detection
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

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
    if (isMobile) setMobileView('chat');
  };

  const handleMobileBack = () => {
    setMobileView('list');
    setSelectedId('');
  };

  const handleStartChat = async (participantId: string) => {
    try {
      const convo = await createConversation(participantId);
      socket?.emit('join_conversation', { conversationId: convo._id });
      await loadConversations();
      setSelectedId(convo._id);
      setShowUserList(false);
      if (isMobile) setMobileView('chat');
    } catch {}
  };

  const handleCreateGroup = async (name: string, participantIds: string[]) => {
    try {
      const convo = await createGroupConversation(name, participantIds);
      socket?.emit('join_conversation', { conversationId: convo._id });
      await loadConversations();
      setSelectedId(convo._id);
      setShowGroupCreate(false);
      if (isMobile) setMobileView('chat');
    } catch {}
  };

  const selectedConversation = conversations.find(c => c._id === selectedId);

  // Determine what to show on mobile
  const showChatView = isMobile && mobileView === 'chat' && (activeView === 'chat' || activeView === 'teams');
  const showListView = !isMobile || mobileView === 'list' || (!['chat', 'teams'].includes(activeView));

  // For mobile: show bottom tab bar except when in chat view
  const showMobileTabBar = isMobile && !showChatView;

  return (
    <div className={isMobile ? 'app-layout mobile-layout' : 'app-layout'} style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar - hidden on mobile */}
      {!isMobile && (
        <Sidebar onLogout={logout} username={user?.username || '?'} avatar={user?.avatar} onProfileClick={() => setShowProfile(true)} activeView={activeView} onViewChange={(v) => { setActiveView(v); if (v === 'activity') setHasUnreadActivity(false); }} hasUnreadActivity={hasUnreadActivity} isAdmin={user?.username === 'zhenyuduan'} />
      )}

      {activeView === 'chat' ? (
        <>
          {/* Conversation list: show on desktop always, on mobile only in list view */}
          {(!isMobile || mobileView === 'list') && (
            <ConversationList
              selectedId={selectedId}
              onSelect={handleSelect}
              conversations={conversations}
              onNewChat={() => { setShowUserList(true); setShowGroupCreate(false); }}
              onNewGroup={() => { setShowGroupCreate(true); setShowUserList(false); }}
              currentUserId={user?.id || ''}
              unreadCounts={unreadCounts}
              isMobile={isMobile}
              onProfileClick={() => setShowProfile(true)}
              username={user?.username || '?'}
              avatar={user?.avatar}
              onLogout={logout}
            />
          )}
          {/* Chat area or user list: show on desktop always, on mobile only in chat view */}
          {(!isMobile || mobileView === 'chat') && (
            showUserList ? (
              <UserList onSelect={handleStartChat} onClose={() => setShowUserList(false)} />
            ) : (
              <ChatArea conversationId={selectedId} currentUserId={user?.id || ''} conversation={selectedConversation} onStartChat={handleStartChat} isMobile={isMobile} onMobileBack={handleMobileBack} />
            )
          )}
        </>
      ) : activeView === 'teams' ? (
        <>
          {(!isMobile || mobileView === 'list') && (
            <TeamList
              onSelectChannel={(channelId, channelName, teamName) => {
                setChannelConvoId(channelId);
                setChannelHeader({ name: channelName, teamName });
                socket?.emit('join_conversation', { conversationId: channelId });
                if (isMobile) setMobileView('chat');
              }}
              onCreateTeam={() => setShowTeamCreate(true)}
              selectedChannelId={channelConvoId}
            />
          )}
          {(!isMobile || mobileView === 'chat') && (
            <ChatArea
              conversationId={channelConvoId}
              currentUserId={user?.id || ''}
              conversation={{ isGroup: true, name: channelHeader.name ? `${channelHeader.teamName} > #${channelHeader.name}` : '' }}
              onStartChat={handleStartChat}
              isMobile={isMobile}
              onMobileBack={handleMobileBack}
            />
          )}
        </>
      ) : activeView === 'activity' ? (
        <div className="mobile-fullscreen-view">
          <ActivityFeed onNavigate={(convoId) => { setActiveView('chat'); handleSelect(convoId); }} />
        </div>
      ) : activeView === 'calendar' ? (
        <div className="mobile-fullscreen-view">
          <CalendarView />
        </div>
      ) : activeView === 'calls' ? (
        <div className="mobile-fullscreen-view">
          <CallHistory currentUserId={user?.id || ''} onStartCall={(userId) => handleStartChat(userId)} />
        </div>
      ) : activeView === 'files' ? (
        <div className="mobile-fullscreen-view">
          <FilesHub />
        </div>
      ) : activeView === 'admin' ? (
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <AdminVisibility />
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#616161' }}>
          🚧 功能开发中...
        </div>
      )}

      {/* Mobile tab bar */}
      {showMobileTabBar && (
        <MobileTabBar activeView={activeView} onViewChange={(v) => { setActiveView(v); setMobileView('list'); if (v === 'activity') setHasUnreadActivity(false); }} />
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
