import { useState, useEffect, useMemo, useCallback } from 'react';
import { fetchForwardTargets, forwardMessage, forwardMessagesMerge } from '../api';
import { imageUrl } from '../utils/config';
import { SearchIcon, TeamsIcon, ChatIcon } from './Icons';

interface ForwardDialogProps {
  /** 要转发的消息列表 */
  messages: Array<{
    _id: string;
    content: string;
    type: string;
    sender: any;
    timestamp: string;
    fileInfo?: any;
  }>;
  currentUserId: string;
  /** 消息来源类型 */
  sourceType: 'conversation' | 'channel';
  onClose: () => void;
  onSuccess?: () => void;
}

type TargetType = 'conversation' | 'channel';

interface ForwardTarget {
  id: string;
  name: string;
  type: TargetType;
  avatar?: string;
  isGroup?: boolean;
  teamName?: string;
}

export default function ForwardDialog({ messages, currentUserId, sourceType, onClose, onSuccess }: ForwardDialogProps) {
  const [search, setSearch] = useState('');
  const [conversations, setConversations] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [forwarding, setForwarding] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<ForwardTarget | null>(null);
  const [activeCategory, setActiveCategory] = useState<'conversations' | 'channels'>('conversations');
  const [error, setError] = useState('');

  // 加载转发目标列表（用后端提供的专用接口）
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await fetchForwardTargets();
        setConversations(data.conversations || []);
        setTeams(data.channels || []); // channels flat list from backend
      } catch {
        setError('加载目标列表失败');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // 构建统一的目标列表
  const targets = useMemo<ForwardTarget[]>(() => {
    const result: ForwardTarget[] = [];

    // 1对1对话和群聊（后端已帮我们处理好 participants）
    for (const c of conversations) {
      if (c.isGroup) {
        result.push({
          id: c._id,
          name: c.name || '群聊',
          type: 'conversation',
          isGroup: true,
        });
      } else {
        const other = c.participants?.find((p: any) => {
          const pid = p._id || p.id || p;
          return pid !== currentUserId;
        });
        if (other) {
          result.push({
            id: c._id,
            name: other.username || '用户',
            type: 'conversation',
            avatar: other.avatar,
            isGroup: false,
          });
        }
      }
    }

    // 团队频道（后端返回的是 flat 列表：{ _id, name, teamId, teamName }）
    for (const ch of teams) {
      result.push({
        id: ch._id,
        name: `#${ch.name}`,
        type: 'channel',
        teamName: ch.teamName,
      });
    }

    return result;
  }, [conversations, teams, currentUserId]);

  // 搜索过滤
  const filteredTargets = useMemo(() => {
    let list = targets;
    if (activeCategory === 'conversations') {
      list = list.filter(t => t.type === 'conversation');
    } else {
      list = list.filter(t => t.type === 'channel');
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(t =>
        t.name.toLowerCase().includes(q) ||
        t.teamName?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [targets, search, activeCategory]);

  const handleForward = useCallback(async () => {
    if (!selectedTarget || forwarding) return;
    setForwarding(true);
    setError('');
    try {
      const targetConversationIds = selectedTarget.type === 'conversation' ? [selectedTarget.id] : [];
      const targetChannelIds = selectedTarget.type === 'channel' ? [selectedTarget.id] : [];

      if (messages.length === 1) {
        // 单条转发
        await forwardMessage(messages[0]._id, targetConversationIds, targetChannelIds, sourceType);
      } else {
        // 多条合并转发
        const messageIds = messages.map(m => m._id);
        await forwardMessagesMerge(messageIds, targetConversationIds, targetChannelIds, sourceType);
      }
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error || '转发失败，请重试');
    } finally {
      setForwarding(false);
    }
  }, [selectedTarget, messages, forwarding, sourceType, onClose, onSuccess]);

  const isMerged = messages.length > 1;
  const messageCount = messages.length;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 30000,
      background: 'rgba(0,0,0,0.5)', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-card, #fff)', borderRadius: 12,
        width: 440, maxHeight: '80vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
            {isMerged ? `合并转发 ${messageCount} 条消息` : '转发消息'}
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', fontSize: 18, cursor: 'pointer',
            color: 'var(--text-secondary)', padding: '2px 6px',
          }}>✕</button>
        </div>

        {/* 消息预览 */}
        <div style={{
          padding: '12px 20px', background: 'var(--bg-secondary, #f5f5f5)',
          borderBottom: '1px solid var(--border)',
          maxHeight: 120, overflowY: 'auto',
        }}>
          {messages.slice(0, 3).map((msg, idx) => (
            <div key={msg._id} style={{
              fontSize: 13, color: 'var(--text-secondary)',
              padding: '2px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)', marginRight: 6 }}>
                {msg.sender?.username || '用户'}:
              </span>
              {msg.type === 'image' ? '🖼️ 图片' :
               msg.type === 'file' ? `📄 ${msg.fileInfo?.filename || '文件'}` :
               msg.content?.substring(0, 60)}
              {idx === 2 && messageCount > 3 && (
                <span style={{ color: '#6264a7', marginLeft: 4 }}>...还有 {messageCount - 3} 条</span>
              )}
            </div>
          ))}
        </div>

        {/* 搜索 */}
        <div style={{ padding: '12px 20px 8px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            border: '1px solid var(--border)', borderRadius: 6,
            padding: '6px 10px', background: 'var(--bg-input, #fff)',
          }}>
            <SearchIcon size={16} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="搜索对话或频道..."
              style={{
                flex: 1, border: 'none', outline: 'none', fontSize: 14,
                background: 'transparent', color: 'var(--text-primary)',
              }}
            />
          </div>
        </div>

        {/* 分类 Tab */}
        <div style={{ display: 'flex', padding: '0 20px', gap: 4 }}>
          <button onClick={() => setActiveCategory('conversations')} style={{
            padding: '6px 14px', borderRadius: 4, border: 'none', fontSize: 13, cursor: 'pointer',
            background: activeCategory === 'conversations' ? 'var(--msg-sent, #e8e8fc)' : 'transparent',
            color: activeCategory === 'conversations' ? '#6264a7' : 'var(--text-secondary)',
            fontWeight: activeCategory === 'conversations' ? 600 : 400,
          }}>
            💬 对话
          </button>
          <button onClick={() => setActiveCategory('channels')} style={{
            padding: '6px 14px', borderRadius: 4, border: 'none', fontSize: 13, cursor: 'pointer',
            background: activeCategory === 'channels' ? 'var(--msg-sent, #e8e8fc)' : 'transparent',
            color: activeCategory === 'channels' ? '#6264a7' : 'var(--text-secondary)',
            fontWeight: activeCategory === 'channels' ? 600 : 400,
          }}>
            📢 频道
          </button>
        </div>

        {/* 目标列表 */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '8px 20px',
          minHeight: 200, maxHeight: 320,
        }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 30, fontSize: 14 }}>
              加载中...
            </div>
          ) : filteredTargets.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 30, fontSize: 14 }}>
              {search ? '未找到匹配结果' : '暂无可用目标'}
            </div>
          ) : (
            filteredTargets.map(target => {
              const isSelected = selectedTarget?.id === target.id;
              return (
                <div
                  key={`${target.type}-${target.id}`}
                  onClick={() => setSelectedTarget(target)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 10px', borderRadius: 6, cursor: 'pointer',
                    background: isSelected ? 'var(--msg-sent, #e8e8fc)' : 'transparent',
                    border: isSelected ? '2px solid #6264a7' : '2px solid transparent',
                    marginBottom: 2, transition: 'all 0.15s',
                  }}
                  onMouseOver={e => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-hover, #f0f0f0)'; }}
                  onMouseOut={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                >
                  {/* 头像 */}
                  {target.type === 'channel' ? (
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%', background: '#464775',
                      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <TeamsIcon size={18} />
                    </div>
                  ) : target.isGroup ? (
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%', background: '#464775',
                      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 16, fontWeight: 600, flexShrink: 0,
                    }}>
                      <ChatIcon size={18} />
                    </div>
                  ) : target.avatar ? (
                    <img src={imageUrl(target.avatar)} alt="" style={{
                      width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0,
                    }} />
                  ) : (
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%', background: '#6264a7',
                      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, fontWeight: 600, flexShrink: 0,
                    }}>{target.name[0]?.toUpperCase() || '?'}</div>
                  )}
                  {/* 名称 */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 14, fontWeight: 500, color: 'var(--text-primary)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{target.name}</div>
                    {target.teamName && (
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{target.teamName}</div>
                    )}
                    {target.isGroup && (
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>群聊</div>
                    )}
                  </div>
                  {/* 选中标记 */}
                  {isSelected && (
                    <span style={{ color: '#6264a7', fontSize: 18 }}>✓</span>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Error */}
        {error && (
          <div style={{
            padding: '8px 20px', color: '#e53935', fontSize: 13, textAlign: 'center',
          }}>{error}</div>
        )}

        {/* Footer */}
        <div style={{
          padding: '12px 20px', borderTop: '1px solid var(--border)',
          display: 'flex', justifyContent: 'flex-end', gap: 8,
        }}>
          <button onClick={onClose} style={{
            padding: '8px 20px', borderRadius: 6, border: '1px solid var(--border)',
            background: 'transparent', color: 'var(--text-primary)', fontSize: 14,
            cursor: 'pointer',
          }}>取消</button>
          <button onClick={handleForward} disabled={!selectedTarget || forwarding} style={{
            padding: '8px 20px', borderRadius: 6, border: 'none',
            background: selectedTarget ? '#6264a7' : 'var(--text-disabled, #ccc)',
            color: '#fff', fontSize: 14, fontWeight: 600,
            cursor: selectedTarget && !forwarding ? 'pointer' : 'default',
            opacity: forwarding ? 0.7 : 1,
          }}>
            {forwarding ? '转发中...' : isMerged ? `合并转发 (${messageCount})` : '转发'}
          </button>
        </div>
      </div>
    </div>
  );
}
