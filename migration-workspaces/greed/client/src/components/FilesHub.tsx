import React, { useState, useEffect } from 'react';
import axios from 'axios';

import { API_BASE as API, BACKEND_URL as BACKEND, imageUrl } from '../utils/config';
const headers = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

type FilterType = 'all' | 'image' | 'file';

export default function FilesHub() {
  const [files, setFiles] = useState<any[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const load = async (type: FilterType) => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/files`, { headers: headers(), params: { type } });
      setFiles(r.data);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(filter); }, [filter]);

  const fullUrl = (url: string) => url?.startsWith('http') ? url : `${BACKEND}${url}`;

  const formatSize = (bytes: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const formatTime = (date: string) => new Date(date).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  const images = files.filter(f => f.type === 'image');
  const docs = files.filter(f => f.type === 'file');

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 500, borderRadius: 4,
    background: active ? '#6264a7' : 'transparent', color: active ? '#fff' : 'var(--text-secondary)',
    border: 'none',
  });

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)', overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)' }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 18, color: 'var(--text-primary)' }}>📁 文件中心</h2>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => setFilter('all')} style={tabStyle(filter === 'all')}>全部</button>
          <button onClick={() => setFilter('image')} style={tabStyle(filter === 'image')}>图片</button>
          <button onClick={() => setFilter('file')} style={tabStyle(filter === 'file')}>文档</button>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>加载中...</div>
        ) : files.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>暂无共享文件</div>
        ) : (
          <>
            {/* Images grid */}
            {(filter === 'all' || filter === 'image') && images.length > 0 && (
              <>
                {filter === 'all' && <h3 style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 8px' }}>图片</h3>}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8, marginBottom: 20 }}>
                  {images.map(f => (
                    <div key={f._id} onClick={() => setLightbox(fullUrl(f.url))} style={{ cursor: 'pointer', borderRadius: 6, overflow: 'hidden', aspectRatio: '1', background: 'var(--bg-primary)' }}>
                      <img src={fullUrl(f.url)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ))}
                </div>
              </>
            )}
            {/* Files list */}
            {(filter === 'all' || filter === 'file') && docs.length > 0 && (
              <>
                {filter === 'all' && <h3 style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 8px' }}>文档</h3>}
                {docs.map(f => (
                  <div key={f._id} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                    background: 'var(--bg-primary)', borderRadius: 6, marginBottom: 6,
                  }}>
                    <span style={{ fontSize: 24 }}>📄</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {f.fileInfo?.filename || '未知文件'}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {formatSize(f.fileInfo?.size)} · {f.conversationName} · {formatTime(f.timestamp)}
                      </div>
                    </div>
                    <a href={fullUrl(f.url)} download={f.fileInfo?.filename} style={{ fontSize: 18, textDecoration: 'none' }} title="下载" onClick={e => e.stopPropagation()}>⬇️</a>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, cursor: 'pointer' }}>
          <img src={lightbox} alt="" style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8 }} />
        </div>
      )}
    </div>
  );
}
