import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';
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
  callDuration: number;
  startCall: (info: CallInfo) => void;
  acceptCall: () => void;
  rejectCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
}

const CallContext = createContext<CallCtx>(null!);
export const useCall = () => useContext(CallContext);

export function CallProvider({ children }: { children: ReactNode }) {
  const { socket } = useSocket();
  const { user } = useAuth();
  const webrtc = useWebRTC();
  const [callState, setCallState] = useState<CallState>('idle');
  const [callInfo, setCallInfo] = useState<CallInfo | null>(null);
  const [incomingOffer, setIncomingOffer] = useState<any>(null);
  const [callDuration, setCallDuration] = useState(0);
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

  const sendIce = useCallback((candidate: RTCIceCandidate) => {
    if (callInfo) socket?.emit('ice_candidate', { targetUserId: callInfo.targetUserId, candidate });
  }, [socket, callInfo]);

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
    if (callInfo) socket?.emit('call_end', { targetUserId: callInfo.targetUserId });
    setCallState('idle');
    setCallInfo(null);
    setIncomingOffer(null);
    webrtc.cleanup();
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
      webrtc.cleanup();
    };

    socket.on('incoming_call', onIncoming);
    socket.on('call_answered', onAnswered);
    socket.on('ice_candidate', onIce);
    socket.on('call_rejected', onRejected);
    socket.on('call_ended', onEnded);

    return () => {
      socket.off('incoming_call', onIncoming);
      socket.off('call_answered', onAnswered);
      socket.off('ice_candidate', onIce);
      socket.off('call_rejected', onRejected);
      socket.off('call_ended', onEnded);
    };
  }, [socket, callState, webrtc]);

  return (
    <CallContext.Provider value={{
      callState, callInfo,
      localStream: webrtc.localStream, remoteStream: webrtc.remoteStream,
      isMuted: webrtc.isMuted, isCameraOff: webrtc.isCameraOff,
      callDuration,
      startCall, acceptCall, rejectCall, endCall,
      toggleMute: webrtc.toggleMute, toggleCamera: webrtc.toggleCamera,
    }}>
      {children}
    </CallContext.Provider>
  );
}
