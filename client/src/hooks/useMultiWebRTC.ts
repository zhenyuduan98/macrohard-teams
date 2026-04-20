import { useRef, useState, useCallback } from 'react';

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

export interface PeerStream {
  peerId: string;
  stream: MediaStream;
  username?: string;
  avatar?: string;
}

export function useMultiWebRTC() {
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peerStreams, setPeerStreams] = useState<PeerStream[]>([]);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  // Callback refs for signaling (set by MeetingContext)
  const onIceCandidateRef = useRef<(peerId: string, candidate: RTCIceCandidate) => void>();
  const onOfferRef = useRef<(peerId: string, offer: RTCSessionDescriptionInit) => void>();
  const onAnswerRef = useRef<(peerId: string, answer: RTCSessionDescriptionInit) => void>();

  const setSignalingCallbacks = useCallback((cbs: {
    onIceCandidate: (peerId: string, candidate: RTCIceCandidate) => void;
    onOffer: (peerId: string, offer: RTCSessionDescriptionInit) => void;
    onAnswer: (peerId: string, answer: RTCSessionDescriptionInit) => void;
  }) => {
    onIceCandidateRef.current = cbs.onIceCandidate;
    onOfferRef.current = cbs.onOffer;
    onAnswerRef.current = cbs.onAnswer;
  }, []);

  const getMedia = useCallback(async (withVideo: boolean) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: withVideo ? { width: { ideal: 640 }, height: { ideal: 480 } } : false,
    });
    localStreamRef.current = stream;
    setLocalStream(stream);
    return stream;
  }, []);

  const updatePeerStreams = useCallback(() => {
    // Collect all remote streams
    const streams: PeerStream[] = [];
    peersRef.current.forEach((pc, peerId) => {
      const receivers = pc.getReceivers();
      if (receivers.length > 0) {
        const remoteStream = new MediaStream();
        receivers.forEach(r => { if (r.track) remoteStream.addTrack(r.track); });
        if (remoteStream.getTracks().length > 0) {
          streams.push({ peerId, stream: remoteStream });
        }
      }
    });
    setPeerStreams([...streams]);
  }, []);

  const createPeerConnection = useCallback((peerId: string): RTCPeerConnection => {
    // Close existing if any
    const existing = peersRef.current.get(peerId);
    if (existing) { existing.close(); }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peersRef.current.set(peerId, pc);

    pc.onicecandidate = (e) => {
      if (e.candidate) onIceCandidateRef.current?.(peerId, e.candidate);
    };

    pc.ontrack = () => {
      // Small delay to ensure all tracks are added
      setTimeout(() => updatePeerStreams(), 100);
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        removePeer(peerId);
      }
    };

    // Add local tracks
    localStreamRef.current?.getTracks().forEach(track => {
      pc.addTrack(track, localStreamRef.current!);
    });

    // Add screen share track if active
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, screenStreamRef.current!);
      });
    }

    return pc;
  }, [updatePeerStreams]);

  // Caller side: create offer for a new peer
  const createOfferForPeer = useCallback(async (peerId: string) => {
    const pc = createPeerConnection(peerId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    onOfferRef.current?.(peerId, offer);
  }, [createPeerConnection]);

  // Callee side: handle incoming offer
  const handleOffer = useCallback(async (peerId: string, offer: RTCSessionDescriptionInit) => {
    const pc = createPeerConnection(peerId);
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    onAnswerRef.current?.(peerId, answer);
  }, [createPeerConnection]);

  // Caller side: handle answer
  const handleAnswer = useCallback(async (peerId: string, answer: RTCSessionDescriptionInit) => {
    const pc = peersRef.current.get(peerId);
    if (!pc) return;
    await pc.setRemoteDescription(new RTCSessionDescription(answer));
  }, []);

  const handleIceCandidate = useCallback(async (peerId: string, candidate: RTCIceCandidateInit) => {
    const pc = peersRef.current.get(peerId);
    if (!pc) return;
    try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
  }, []);

  const removePeer = useCallback((peerId: string) => {
    const pc = peersRef.current.get(peerId);
    if (pc) { pc.close(); peersRef.current.delete(peerId); }
    setPeerStreams(prev => prev.filter(p => p.peerId !== peerId));
  }, []);

  const toggleMute = useCallback(() => {
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setIsMuted(prev => !prev);
  }, []);

  const toggleCamera = useCallback(() => {
    localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
    setIsCameraOff(prev => !prev);
  }, []);

  const startScreenShare = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      screenStreamRef.current = stream;
      setScreenStream(stream);
      setIsScreenSharing(true);

      // Add screen track to all peers
      const videoTrack = stream.getVideoTracks()[0];
      peersRef.current.forEach((pc) => {
        pc.addTrack(videoTrack, stream);
        // Renegotiate
        pc.createOffer().then(offer => {
          pc.setLocalDescription(offer);
          // Need to signal this - handled via onNegotiationNeeded
        });
      });

      // When user stops sharing via browser UI
      videoTrack.onended = () => {
        stopScreenShare();
      };

      return stream;
    } catch {
      return null;
    }
  }, []);

  const stopScreenShare = useCallback(() => {
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current = null;
    setScreenStream(null);
    setIsScreenSharing(false);
  }, []);

  const cleanup = useCallback(() => {
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current = null;
    peersRef.current.forEach(pc => pc.close());
    peersRef.current.clear();
    setLocalStream(null);
    setPeerStreams([]);
    setScreenStream(null);
    setIsMuted(false);
    setIsCameraOff(false);
    setIsScreenSharing(false);
  }, []);

  return {
    localStream, peerStreams, screenStream,
    isMuted, isCameraOff, isScreenSharing,
    getMedia, setSignalingCallbacks,
    createOfferForPeer, handleOffer, handleAnswer, handleIceCandidate,
    removePeer, toggleMute, toggleCamera,
    startScreenShare, stopScreenShare, cleanup,
  };
}
