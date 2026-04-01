import React, { useEffect, useRef } from 'react';
import { useCall } from '../contexts/CallContext';

const formatDuration = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
};

export default function CallUI() {
  const { callState, callInfo, localStream, remoteStream, isMuted, isCameraOff, callDuration, endCall, toggleMute, toggleCamera } = useCall();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) localVideoRef.current.srcObject = localStream;
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) remoteVideoRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  if (callState !== 'in-call' && callState !== 'calling') return null;

  const isVideo = callInfo?.callType === 'video';
  const initial = (callInfo?.targetName || '?')[0].toUpperCase();

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 20000,
      background: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', color: '#fff',
    }}>
      {callState === 'calling' && (
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%', background: '#6264a7',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 36, fontWeight: 600, margin: '0 auto 16px',
          }}>{initial}</div>
          <div style={{ fontSize: 20, marginBottom: 8 }}>{callInfo?.targetName}</div>
          <div style={{ fontSize: 14, color: '#aaa' }}>正在呼叫...</div>
        </div>
      )}

      {callState === 'in-call' && (
        <>
          {isVideo ? (
            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
              <video ref={remoteVideoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <video ref={localVideoRef} autoPlay playsInline muted style={{
                position: 'absolute', bottom: 100, right: 20, width: 160, height: 120,
                borderRadius: 8, objectFit: 'cover', border: '2px solid #fff',
              }} />
            </div>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: 100, height: 100, borderRadius: '50%', background: '#6264a7',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 44, fontWeight: 600, margin: '0 auto 16px',
              }}>{initial}</div>
              <div style={{ fontSize: 22, marginBottom: 8 }}>{callInfo?.targetName}</div>
              <div style={{ fontSize: 18, color: '#aaa' }}>{formatDuration(callDuration)}</div>
            </div>
          )}
          {isVideo && (
            <div style={{ position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', fontSize: 16, color: '#ddd' }}>
              {formatDuration(callDuration)}
            </div>
          )}
        </>
      )}

      {/* Controls */}
      <div style={{
        position: 'absolute', bottom: 40, display: 'flex', gap: 20,
      }}>
        <button onClick={toggleMute} style={{
          width: 56, height: 56, borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: isMuted ? '#e53935' : 'rgba(255,255,255,0.2)', fontSize: 24,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} title={isMuted ? '取消静音' : '静音'}>
          {isMuted ? '🔇' : '🎤'}
        </button>
        {isVideo && (
          <button onClick={toggleCamera} style={{
            width: 56, height: 56, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: isCameraOff ? '#e53935' : 'rgba(255,255,255,0.2)', fontSize: 24,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }} title={isCameraOff ? '开启摄像头' : '关闭摄像头'}>
            {isCameraOff ? '🚫' : '📷'}
          </button>
        )}
        <button onClick={endCall} style={{
          width: 56, height: 56, borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: '#e53935', fontSize: 24,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} title="挂断">📞</button>
      </div>
    </div>
  );
}
