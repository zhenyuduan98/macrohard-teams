import { useRef, useState, useCallback } from 'react';

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

export function useWebRTC() {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const originalVideoTrackRef = useRef<MediaStreamTrack | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [remoteIsScreenSharing, setRemoteIsScreenSharing] = useState(false);

  const getMedia = useCallback(async (callType: 'audio' | 'video') => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: callType === 'video',
    });
    localStreamRef.current = stream;
    setLocalStream(stream);
    return stream;
  }, []);

  const createPeerConnection = useCallback((onIceCandidate: (candidate: RTCIceCandidate) => void) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    const remote = new MediaStream();
    setRemoteStream(remote);

    pc.ontrack = (e) => {
      e.streams[0]?.getTracks().forEach(track => remote.addTrack(track));
      setRemoteStream(new MediaStream(remote.getTracks()));
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) onIceCandidate(e.candidate);
    };

    // Add local tracks
    localStreamRef.current?.getTracks().forEach(track => {
      pc.addTrack(track, localStreamRef.current!);
    });

    return pc;
  }, []);

  const createOffer = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc) return null;
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    return offer;
  }, []);

  const createAnswer = useCallback(async (offer: RTCSessionDescriptionInit) => {
    const pc = pcRef.current;
    if (!pc) return null;
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    return answer;
  }, []);

  const setRemoteAnswer = useCallback(async (answer: RTCSessionDescriptionInit) => {
    const pc = pcRef.current;
    if (!pc) return;
    await pc.setRemoteDescription(new RTCSessionDescription(answer));
  }, []);

  const addIceCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
    try {
      await pcRef.current?.addIceCandidate(new RTCIceCandidate(candidate));
    } catch {}
  }, []);

  const toggleMute = useCallback(() => {
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setIsMuted(prev => !prev);
  }, []);

  const toggleCamera = useCallback(() => {
    localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
    setIsCameraOff(prev => !prev);
  }, []);

  // 屏幕共享：用 replaceTrack 替换视频轨道，避免 renegotiation
  const startScreenShare = useCallback(async (): Promise<boolean> => {
    const pc = pcRef.current;
    if (!pc) return false;

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      screenStreamRef.current = screenStream;

      const screenTrack = screenStream.getVideoTracks()[0];
      if (!screenTrack) return false;

      // 找到当前的视频 sender，保存原始摄像头轨道
      const videoSender = pc.getSenders().find(s => s.track?.kind === 'video');
      if (videoSender) {
        originalVideoTrackRef.current = videoSender.track;
        await videoSender.replaceTrack(screenTrack);
      } else {
        // 如果没有 video sender（音频通话），添加屏幕轨道
        originalVideoTrackRef.current = null;
        pc.addTrack(screenTrack, screenStream);
      }

      // 监听浏览器原生的「停止共享」按钮
      screenTrack.addEventListener('ended', () => {
        stopScreenShare();
      });

      setIsScreenSharing(true);
      return true;
    } catch (err: any) {
      // 用户拒绝权限 or 不支持
      console.warn('Screen share failed:', err?.message || err);
      return false;
    }
  }, []);

  const stopScreenShare = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc) return;

    // 停止屏幕流
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current = null;

    // 恢复原始摄像头轨道
    const videoSender = pc.getSenders().find(s => s.track?.kind === 'video' || !s.track);
    if (videoSender && originalVideoTrackRef.current) {
      await videoSender.replaceTrack(originalVideoTrackRef.current);
    }
    originalVideoTrackRef.current = null;

    setIsScreenSharing(false);
  }, []);

  const setRemoteScreenSharing = useCallback((sharing: boolean) => {
    setRemoteIsScreenSharing(sharing);
  }, []);

  const cleanup = useCallback(() => {
    // 清理屏幕共享流
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current = null;
    originalVideoTrackRef.current = null;

    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setIsMuted(false);
    setIsCameraOff(false);
    setIsScreenSharing(false);
    setRemoteIsScreenSharing(false);
  }, []);

  return {
    localStream, remoteStream, isMuted, isCameraOff,
    isScreenSharing, remoteIsScreenSharing,
    getMedia, createPeerConnection, createOffer, createAnswer,
    setRemoteAnswer, addIceCandidate, toggleMute, toggleCamera,
    startScreenShare, stopScreenShare, setRemoteScreenSharing,
    cleanup,
  };
}
