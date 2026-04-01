import React from 'react';
import { useCall } from '../contexts/CallContext';

export default function IncomingCallDialog() {
  const { callState, callInfo, acceptCall, rejectCall } = useCall();

  if (callState !== 'ringing' || !callInfo) return null;

  const initial = (callInfo.targetName || '?')[0].toUpperCase();
  const isVideo = callInfo.callType === 'video';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 20001,
      background: 'rgba(0,0,0,0.6)', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: '32px 40px',
        textAlign: 'center', minWidth: 280, boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      }}>
        {/* Pulsing avatar */}
        <div style={{ position: 'relative', display: 'inline-block', marginBottom: 16 }}>
          <div style={{
            position: 'absolute', inset: -8, borderRadius: '50%',
            border: '3px solid #6264a7', animation: 'pulse-ring 1.5s ease-out infinite',
          }} />
          <div style={{
            width: 72, height: 72, borderRadius: '50%', background: '#6264a7',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 32, fontWeight: 600, color: '#fff', position: 'relative',
          }}>{initial}</div>
        </div>

        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>{callInfo.targetName}</div>
        <div style={{ fontSize: 14, color: '#666', marginBottom: 24 }}>
          {isVideo ? '🎥' : '📞'} 正在呼叫你
        </div>

        <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
          <button onClick={acceptCall} style={{
            width: 56, height: 56, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: '#4caf50', fontSize: 24,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }} title="接听">✅</button>
          <button onClick={rejectCall} style={{
            width: 56, height: 56, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: '#e53935', fontSize: 24,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }} title="拒绝">❌</button>
        </div>
      </div>

      <style>{`
        @keyframes pulse-ring {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(1.4); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
