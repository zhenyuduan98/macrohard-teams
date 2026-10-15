import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { useSocket } from './SocketContext';
import { useWebRTC } from '../hooks/useWebRTC';

type CallState = 'idle' | 'calling' | 'ringing' | 'in-call';

interface CallInfo {
  targetUserId: string;
  targetName: string;
  targetAvatar: string;
  callType: 'audio' | 'video';
  conversationId: string;
}

interface CallCtx {
  callState: CallState;
  callInfo: CallInfo | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
  remoteIsScreenSharing: boolean;
  screenSharingUser: string | null;
  callDuration: number;
  startCall: (info: CallInfo) => void;
  acceptCall: () => void;
  rejectCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  toggleScreenShare: () => void;
}

const CallContext = createContext<CallCtx>(null!);
export const useCall = () => useContext(CallContext);

export function CallProvider({ children }: { children: ReactNode }) {
  const { socket } = useSocket();
  const webrtc = useWebRTC();
  const [callState, setCallState] = useState<CallState>('idle');
  const [callInfo, setCallInfo] = useState<CallInfo | null>(null);
  const [incomingOffer, setIncomingOffer] = useState<any>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [screenSharingUser, setScreenSharingUser] = useState<string | null>(null);
  const timerRef = useRef<any>(null);

  // Duration timer
  useEffect(() => {
    if (callState === 'in-call') {
      setCallDuration(0);
      timerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
    } else {
      clearInterval(timerRef.current);
      setCallDuration(0);
    }
    return () => clearInterval(timerRef.current);
  }, [callState]);

  const startCall = useCallback(async (info: CallInfo) => {
    setCallInfo(info);
    setCallState('calling');
    try {
      await webrtc.getMedia(info.callType);
      webrtc.createPeerConnection(candidate => {
        socket?.emit('ice_candidate', { targetUserId: info.targetUserId, candidate });
      });
      const offer = await webrtc.createOffer();
      socket?.emit('call_user', {
        targetUserId: info.targetUserId,
        conversationId: info.conversationId,
        callType: info.callType,
        offer,
      });
    } catch {
      setCallState('idle');
      setCallInfo(null);
      webrtc.cleanup();
    }
  }, [socket, webrtc]);

  const acceptCall = useCallback(async () => {
    if (!callInfo || !incomingOffer) return;
    try {
      await webrtc.getMedia(callInfo.callType);
      webrtc.createPeerConnection(candidate => {
        socket?.emit('ice_candidate', { targetUserId: callInfo.targetUserId, candidate });
      });
      const answer = await webrtc.createAnswer(incomingOffer);
      socket?.emit('call_answer', { callerId: callInfo.targetUserId, answer });
      setCallState('in-call');
      setIncomingOffer(null);
    } catch {
      setCallState('idle');
      setCallInfo(null);
      webrtc.cleanup();
    }
  }, [socket, webrtc, callInfo, incomingOffer]);

  const rejectCall = useCallback(() => {
    if (callInfo) socket?.emit('call_reject', { callerId: callInfo.targetUserId });
    setCallState('idle');
    setCallInfo(null);
    setIncomingOffer(null);
    webrtc.cleanup();
  }, [socket, webrtc, callInfo]);

  const endCall = useCallback(() => {
    // 结束通话前停止屏幕共享
    if (webrtc.isScreenSharing && callInfo) {
      socket?.emit('screen_share_stop', { targetUserId: callInfo.targetUserId });
    }
    if (callInfo) socket?.emit('call_end', { targetUserId: callInfo.targetUserId });
    setCallState('idle');
    setCallInfo(null);
    setIncomingOffer(null);
    setScreenSharingUser(null);
    webrtc.cleanup();
  }, [socket, webrtc, callInfo]);

  // 屏幕共享切换
  const toggleScreenShare = useCallback(async () => {
    if (!callInfo) return;
    if (webrtc.isScreenSharing) {
      await webrtc.stopScreenShare();
      socket?.emit('screen_share_stop', { targetUserId: callInfo.targetUserId });
      setScreenSharingUser(null);
    } else {
      const success = await webrtc.startScreenShare();
      if (success) {
        socket?.emit('screen_share_start', { targetUserId: callInfo.targetUserId });
        setScreenSharingUser('me');
      }
    }
  }, [socket, webrtc, callInfo]);

  // Socket listeners
  useEffect(() => {
    if (!socket) return;

    const onIncoming = (data: any) => {
      if (callState !== 'idle') return; // busy
      setCallInfo({
        targetUserId: data.callerId,
        targetName: data.callerName,
        targetAvatar: data.callerAvatar || '',
        callType: data.callType,
        conversationId: data.conversationId,
      });
      setIncomingOffer(data.offer);
      setCallState('ringing');
    };

    const onAnswered = async (data: any) => {
      await webrtc.setRemoteAnswer(data.answer);
      setCallState('in-call');
    };

    const onIce = (data: any) => {
      webrtc.addIceCandidate(data.candidate);
    };

    const onRejected = () => {
      setCallState('idle');
      setCallInfo(null);
      webrtc.cleanup();
    };

    const onEnded = () => {
      setCallState('idle');
      setCallInfo(null);
      setScreenSharingUser(null);
      webrtc.cleanup();
    };

    // 屏幕共享信令
    const onScreenShareStarted = (data: { userId: string }) => {
      webrtc.setRemoteScreenSharing(true);
      setScreenSharingUser(data.userId);
    };

    const onScreenShareStopped = (_data: { userId: string }) => {
      webrtc.setRemoteScreenSharing(false);
      setScreenSharingUser(null);
    };

    socket.on('incoming_call', onIncoming);
    socket.on('call_answered', onAnswered);
    socket.on('ice_candidate', onIce);
    socket.on('call_rejected', onRejected);
    socket.on('call_ended', onEnded);
    socket.on('screen_share_started', onScreenShareStarted);
    socket.on('screen_share_stopped', onScreenShareStopped);

    return () => {
      socket.off('incoming_call', onIncoming);
      socket.off('call_answered', onAnswered);
      socket.off('ice_candidate', onIce);
      socket.off('call_rejected', onRejected);
      socket.off('call_ended', onEnded);
      socket.off('screen_share_started', onScreenShareStarted);
      socket.off('screen_share_stopped', onScreenShareStopped);
    };
  }, [socket, callState, webrtc]);

  return (
    <CallContext.Provider value={{
      callState, callInfo,
      localStream: webrtc.localStream, remoteStream: webrtc.remoteStream,
      isMuted: webrtc.isMuted, isCameraOff: webrtc.isCameraOff,
      isScreenSharing: webrtc.isScreenSharing,
      remoteIsScreenSharing: webrtc.remoteIsScreenSharing,
      screenSharingUser,
      callDuration,
      startCall, acceptCall, rejectCall, endCall,
      toggleMute: webrtc.toggleMute, toggleCamera: webrtc.toggleCamera,
      toggleScreenShare,
    }}>
      {children}
    </CallContext.Provider>
  );
}
