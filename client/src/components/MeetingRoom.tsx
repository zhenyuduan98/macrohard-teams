import React, { useEffect, useRef, useState } from 'react';
import { useMeeting } from '../contexts/MeetingContext';
import { imageUrl } from '../utils/config';

const formatDuration = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
};

export default function MeetingRoom() {
  const {
    meetingState, meetingInfo, participants,
    localStream, peerStreams, screenStream, remoteScreenStream,
    isMuted, isCameraOff, isScreenSharing, meetingDuration,
    leaveMeeting, endMeeting, toggleMute, toggleCamera, toggleScreenShare,
  } = useMeeting();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [showParticipants, setShowParticipants] = useState(false);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  if (meetingState === 'idle') return null;

  // Joining state
  if (meetingState === 'joining') {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 20000,
        background: 'rgba(0,0,0,0.9)', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', color: '#fff',
      }}>
        <div style={{ fontSize: 20, marginBottom: 12 }}>正在加入会议...</div>
        <div style={{ fontSize: 14, color: '#aaa' }}>{meetingInfo?.title || ''}</div>
      </div>
    );
  }

  const totalStreams = peerStreams.length;
  const hasScreenShare = isScreenSharing || participants.some(p => p.isScreenSharing);

  // Determine grid layout
  const getGridStyle = (count: number): React.CSSProperties => {
    if (count <= 1) return { gridTemplateColumns: '1fr' };
    if (count <= 2) return { gridTemplateColumns: '1fr 1fr' };
    if (count <= 4) return { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' };
    if (count <= 6) return { gridTemplateColumns: '1fr 1fr 1fr', gridTemplateRows: '1fr 1fr' };
    return { gridTemplateColumns: '1fr 1fr 1fr 1fr', gridAutoRows: '1fr' };
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 20000,
      background: '#1a1a2e', display: 'flex', flexDirection: 'column',
      color: '#fff',
    }}>
      {/* Top bar */}
      <div style={{
        padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: 'rgba(0,0,0,0.3)', flexShrink: 0,
      }}>
        <div>
          <span style={{ fontWeight: 600, fontSize: 16 }}>{meetingInfo?.title || '会议'}</span>
          <span style={{ marginLeft: 12, fontSize: 14, color: '#aaa' }}>{formatDuration(meetingDuration)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, color: '#aaa' }}>{participants.length + 1} 位参会者</span>
          <button onClick={() => setShowParticipants(!showParticipants)} style={{
            background: showParticipants ? '#6264a7' : 'rgba(255,255,255,0.1)',
            border: 'none', borderRadius: 6, padding: '6px 12px', color: '#fff',
            cursor: 'pointer', fontSize: 13,
          }}>👥 参会者</button>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Video grid */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {hasScreenShare ? (
            // Screen share layout: big screen + small videos
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', position: 'relative' }}>
                {isScreenSharing && screenStream ? (
                  <VideoTile stream={screenStream} label="你的屏幕共享" isBig />
                ) : remoteScreenStream ? (
                  <VideoTile stream={remoteScreenStream.stream} label="屏幕共享" isBig />
                ) : null}
              </div>
              {/* Small video strip */}
              <div style={{ height: 120, display: 'flex', gap: 4, padding: 4, background: 'rgba(0,0,0,0.5)', overflowX: 'auto', flexShrink: 0 }}>
                <SmallVideoTile stream={localStream} label="你" isMuted={isMuted} isCameraOff={isCameraOff} ref={localVideoRef} />
                {peerStreams.map(ps => {
                  const p = participants.find(pp => pp.userId === ps.peerId);
                  return <SmallVideoTile key={ps.peerId} stream={ps.stream} label={p?.username || '参会者'} isMuted={p?.isMuted} isCameraOff={p?.isCameraOff} />;
                })}
              </div>
            </div>
          ) : (
            // Normal grid layout
            <div style={{
              flex: 1, display: 'grid', gap: 4, padding: 8,
              ...getGridStyle(totalStreams + 1),
              alignContent: 'center',
            }}>
              {/* Local */}
              <VideoTile stream={localStream} label="你" isMuted={isMuted} isCameraOff={isCameraOff} muted />
              {/* Peers */}
              {peerStreams.map(ps => {
                const p = participants.find(pp => pp.userId === ps.peerId);
                return <VideoTile key={ps.peerId} stream={ps.stream} label={p?.username || '参会者'} isMuted={p?.isMuted} isCameraOff={p?.isCameraOff} />;
              })}
            </div>
          )}
        </div>

        {/* Participants sidebar */}
        {showParticipants && (
          <div style={{
            width: 260, borderLeft: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(0,0,0,0.3)', overflowY: 'auto', padding: 12,
          }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>参会者 ({participants.length + 1})</div>
            {/* Self */}
            <ParticipantItem name="你" isMuted={isMuted} isCameraOff={isCameraOff} isHost={meetingInfo?.hostId === undefined} />
            {participants.map(p => (
              <ParticipantItem key={p.userId} name={p.username} avatar={p.avatar} isMuted={p.isMuted} isCameraOff={p.isCameraOff}
                isHost={p.userId === meetingInfo?.hostId} isScreenSharing={p.isScreenSharing} />
            ))}
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div style={{
        padding: '16px 0', display: 'flex', justifyContent: 'center', gap: 16,
        background: 'rgba(0,0,0,0.4)', flexShrink: 0,
      }}>
        <ControlButton icon={isMuted ? '🔇' : '🎤'} label={isMuted ? '取消静音' : '静音'} active={isMuted} onClick={toggleMute} />
        <ControlButton icon={isCameraOff ? '🚫' : '📷'} label={isCameraOff ? '开启摄像头' : '关闭摄像头'} active={isCameraOff} onClick={toggleCamera} />
        <ControlButton icon="🖥️" label={isScreenSharing ? '停止共享' : '共享屏幕'} active={isScreenSharing} onClick={toggleScreenShare} />
        <ControlButton icon="📞" label="离开" danger onClick={leaveMeeting} />
      </div>
    </div>
  );
}

// Video tile component
function VideoTile({ stream, label, isMuted, isCameraOff, muted, isBig }: {
  stream: MediaStream | null; label: string; isMuted?: boolean; isCameraOff?: boolean; muted?: boolean; isBig?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const hasVideo = stream?.getVideoTracks().some(t => t.enabled && t.readyState === 'live');

  return (
    <div style={{
      position: 'relative', background: '#16213e', borderRadius: 8, overflow: 'hidden',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: isBig ? '100%' : 120,
      width: isBig ? '100%' : undefined,
      height: isBig ? '100%' : undefined,
    }}>
      {(!isCameraOff && hasVideo !== false) ? (
        <video ref={videoRef} autoPlay playsInline muted={muted} style={{
          width: '100%', height: '100%', objectFit: isBig ? 'contain' : 'cover',
        }} />
      ) : (
        <>
          <video ref={videoRef} autoPlay playsInline muted={muted} style={{ display: 'none' }} />
          <div style={{
            width: 64, height: 64, borderRadius: '50%', background: '#6264a7',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, fontWeight: 600,
          }}>{label[0]?.toUpperCase() || '?'}</div>
        </>
      )}
      {/* Label */}
      <div style={{
        position: 'absolute', bottom: 8, left: 8, display: 'flex', alignItems: 'center', gap: 6,
        background: 'rgba(0,0,0,0.6)', borderRadius: 4, padding: '2px 8px',
      }}>
        <span style={{ fontSize: 12, color: '#fff' }}>{label}</span>
        {isMuted && <span style={{ fontSize: 10 }}>🔇</span>}
      </div>
    </div>
  );
}

// Small video for PiP strip
const SmallVideoTile = React.forwardRef<HTMLVideoElement, {
  stream: MediaStream | null; label: string; isMuted?: boolean; isCameraOff?: boolean;
}>(({ stream, label, isMuted, isCameraOff }, ref) => {
  const internalRef = useRef<HTMLVideoElement>(null);
  const videoRef = (ref as React.RefObject<HTMLVideoElement>) || internalRef;

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div style={{
      width: 140, height: 110, borderRadius: 6, overflow: 'hidden', background: '#16213e',
      position: 'relative', flexShrink: 0,
    }}>
      <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      <div style={{ position: 'absolute', bottom: 4, left: 4, fontSize: 10, color: '#fff', background: 'rgba(0,0,0,0.5)', borderRadius: 3, padding: '1px 4px' }}>
        {label} {isMuted && '🔇'}
      </div>
    </div>
  );
});

// Participant list item
function ParticipantItem({ name, avatar, isMuted, isCameraOff, isHost, isScreenSharing }: {
  name: string; avatar?: string; isMuted?: boolean; isCameraOff?: boolean; isHost?: boolean; isScreenSharing?: boolean;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      {avatar ? (
        <img src={imageUrl(avatar)} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
      ) : (
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#6264a7', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600 }}>
          {name[0]?.toUpperCase() || '?'}
        </div>
      )}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500 }}>
          {name} {isHost && <span style={{ fontSize: 10, color: '#ffd700' }}>👑</span>}
        </div>
        <div style={{ display: 'flex', gap: 4, fontSize: 11, color: '#aaa' }}>
          {isMuted && <span>🔇</span>}
          {isCameraOff && <span>📷❌</span>}
          {isScreenSharing && <span>🖥️</span>}
        </div>
      </div>
    </div>
  );
}

// Control button
function ControlButton({ icon, label, active, danger, onClick }: {
  icon: string; label: string; active?: boolean; danger?: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick} title={label} style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      background: danger ? '#e53935' : active ? '#e53935' : 'rgba(255,255,255,0.1)',
      border: 'none', borderRadius: 12, padding: '12px 16px', cursor: 'pointer',
      color: '#fff', minWidth: 64,
    }}>
      <span style={{ fontSize: 24 }}>{icon}</span>
      <span style={{ fontSize: 11 }}>{label}</span>
    </button>
  );
}
