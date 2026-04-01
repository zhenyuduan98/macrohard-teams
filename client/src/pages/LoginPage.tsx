import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';

export default function LoginPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const { isDark, toggle } = useTheme();
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      if (isRegister) await register(username, password);
      else await login(username, password);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || '操作失败');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'100vh', background:'linear-gradient(135deg, #6264a7 0%, #464775 100%)', position: 'relative' }}>
      <button onClick={toggle} style={{
        position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.2)',
        border: 'none', borderRadius: '50%', width: 40, height: 40, fontSize: 20, cursor: 'pointer',
      }}>{isDark ? '☀️' : '🌙'}</button>
      <div style={{ background:'var(--bg-card)', borderRadius:12, padding:40, width:380, boxShadow:'0 8px 32px var(--shadow)' }}>
        <h1 style={{ textAlign:'center', color:'#6264a7', marginBottom:8, fontSize:28 }}>MacroHard Teams</h1>
        <p style={{ textAlign:'center', color:'var(--text-secondary)', marginBottom:24 }}>{isRegister ? '创建账号' : '欢迎回来'}</p>
        {error && <div style={{ background:'#fde8e8', color:'#c53030', padding:8, borderRadius:6, marginBottom:12, fontSize:14, textAlign:'center' }}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <input placeholder="用户名" value={username} onChange={e=>setUsername(e.target.value)}
            style={{ width:'100%', padding:'10px 14px', border:'1px solid var(--border)', borderRadius:6, marginBottom:12, fontSize:15, outline:'none', background:'var(--bg-primary)', color:'var(--text-primary)' }} />
          <input type="password" placeholder="密码" value={password} onChange={e=>setPassword(e.target.value)}
            style={{ width:'100%', padding:'10px 14px', border:'1px solid var(--border)', borderRadius:6, marginBottom:16, fontSize:15, outline:'none', background:'var(--bg-primary)', color:'var(--text-primary)' }} />
          <button type="submit" disabled={loading}
            style={{ width:'100%', padding:'10px', background:'#6264a7', color:'#fff', border:'none', borderRadius:6, fontSize:16, cursor:'pointer', fontWeight:600 }}>
            {loading ? '...' : isRegister ? '注册' : '登录'}
          </button>
        </form>
        <p style={{ textAlign:'center', marginTop:16, fontSize:14, color:'var(--text-secondary)' }}>
          {isRegister ? '已有账号？' : '没有账号？'}
          <span onClick={()=>{setIsRegister(!isRegister);setError('')}} style={{ color:'#6264a7', cursor:'pointer', fontWeight:600 }}>
            {isRegister ? ' 登录' : ' 注册'}
          </span>
        </p>
      </div>
    </div>
  );
}
