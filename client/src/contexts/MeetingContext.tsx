import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';
import { useMultiWebRTC, PeerStream } from '../hooks/useMultiWebRTC';
import axios from 'axios';
import { API_BASE as API } from '../utils/config';

function headers() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

type MeetingState = 'idle' | 'joining' | 'in-meeting';

interface Participant {
  userId: string;
  username: string;
  avatar?: string;
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
}

interface MeetingInfo {
  meetingId: string;
  title: string;
  hostId: string;
}

interface MeetingCtx {
  meetingState: MeetingState;
  meetingInfo: MeetingInfo | null;
  participants: Participant[];
  localStream: MediaStream | null;
  peerStreams: PeerStream[];
  screenStream: MediaStream | null;
  remoteScreenStream: PeerStream | null;
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
  meetingDuration: number;
  createMeeting: (title: string, channelId?: string, conversationId?: string) => Promise<string | null>;
  joinMeeting: (meetingId: string) => Promise<void>;
  leaveMeeting: () => void;
  endMeeting: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  toggleScreenShare: () => void;
}

const MeetingContext = createContext<MeetingCtx>(null!);
export const useMeeting = () => useContext(MeetingContext);

export function MeetingProvider({ children }: { children: ReactNode }) {
  const { socket } = useSocket();
  const { user } = useAuth();
  const webrtc = useMultiWebRTC();
  const [meetingState, setMeetingState] = useState<MeetingState>('idle');
  const [meetingInfo, setMeetingInfo] = useState<MeetingInfo | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [remoteScreenStream, setRemoteScreenStream] = useState<PeerStream | null>(null);
  const [meetingDuration, setMeetingDuration] = useState(0);
  const timerRef = useRef<any>(null);

  // Duration timer
  useEffect(() => {
    if (meetingState === 'in-meeting') {
      setMeetingDuration(0);
      timerRef.current = setInterval(() => setMeetingDuration(d => d + 1), 1000);
    } else {
      clearInterval(timerRef.current);
      setMeetingDuration(0);
    }
    return () => clearInterval(timerRef.current);
  }, [meetingState]);

  // Set up signaling callbacks
  useEffect(() => {
    if (!socket) return;
    webrtc.setSignalingCallbacks({
      onIceCandidate: (peerId, candidate) => {
        socket.emit('meeting_ice_candidate', { meetingId: meetingInfo?.meetingId, targetUserId: peerId, candidate });
      },
      onOffer: (peerId, offer) => {
        socket.emit('meeting_offer', { meetingId: meetingInfo?.meetingId, targetUserId: peerId, offer });
      },
      onAnswer: (peerId, answer) => {
        socket.emit('meeting_answer', { meetingId: meetingInfo?.meetingId, targetUserId: peerId, answer });
      },
    });
  }, [socket, meetingInfo, webrtc]);

  const createMeeting = useCallback(async (title: string, channelId?: string, conversationId?: string) => {
    try {
      const body: any = { title };
      if (channelId) body.channelId = channelId;
      if (conversationId) body.conversationId = conversationId;
      const r = await axios.post(`${API}/meetings`, body, { headers: headers() });
      return r.data._id || r.data.id;
    } catch {
      return null;
    }
  }, []);

  const joinMeeting = useCallback(async (meetingId: string) => {
    if (meetingState !== 'idle') return;
    setMeetingState('joining');
    try {
      // Get meeting info
      const r = await axios.get(`${API}/meetings/${meetingId}`, { headers: headers() });
      const meeting = r.data;
      setMeetingInfo({ meetingId, title: meeting.title, hostId: meeting.hostId || meeting.host });

      // Get media
      await webrtc.getMedia(true);

      // Join via API
      await axios.post(`${API}/meetings/${meetingId}/join`, {}, { headers: headers() });

      // Join socket room
      socket?.emit('meeting_join', { meetingId });
      setMeetingState('in-meeting');
    } catch {
      setMeetingState('idle');
      setMeetingInfo(null);
      webrtc.cleanup();
    }
  }, [socket, webrtc, meetingState]);

  const leaveMeeting = useCallback(() => {
    if (!meetingInfo) return;
    socket?.emit('meeting_leave', { meetingId: meetingInfo.meetingId });
    axios.post(`${API}/meetings/${meetingInfo.meetingId}/leave`, {}, { headers: headers() }).catch(() => {});
    setMeetingState('idle');
    setMeetingInfo(null);
    setParticipants([]);
    setRemoteScreenStream(null);
    webrtc.cleanup();
  }, [socket, webrtc, meetingInfo]);

  const endMeeting = useCallback(() => {
    if (!meetingInfo) return;
    socket?.emit('meeting_end', { meetingId: meetingInfo.meetingId });
    axios.post(`${API}/meetings/${meetingInfo.meetingId}/end`, {}, { headers: headers() }).catch(() => {});
    setMeetingState('idle');
    setMeetingInfo(null);
    setParticipants([]);
    setRemoteScreenStream(null);
    webrtc.cleanup();
  }, [socket, webrtc, meetingInfo]);

  const toggleScreenShare = useCallback(async () => {
    if (webrtc.isScreenSharing) {
      webrtc.stopScreenShare();
      socket?.emit('meeting_screen_share_stop', { meetingId: meetingInfo?.meetingId });
    } else {
      const stream = await webrtc.startScreenShare();
      if (stream) {
        socket?.emit('meeting_screen_share_start', { meetingId: meetingInfo?.meetingId });
      }
    }
  }, [socket, webrtc, meetingInfo]);

  // Socket listeners
  useEffect(() => {
    if (!socket) return;

    // A new participant joined - create offer to them
    const onParticipantJoined = (data: { userId: string; username: string; avatar?: string }) => {
      if (data.userId === user?.id) return;
      setParticipants(prev => {
        if (prev.some(p => p.userId === data.userId)) return prev;
        return [...prev, { userId: data.userId, username: data.username, avatar: data.avatar, isMuted: false, isCameraOff: false, isScreenSharing: false }];
      });
      // Create WebRTC offer to the new peer
      webrtc.createOfferForPeer(data.userId);
    };

    // Existing participants list when we join
    const onParticipantsList = (data: { participants: Array<{ userId: string; username: string; avatar?: string }> }) => {
      const others = data.participants.filter(p => p.userId !== user?.id);
      setParticipants(others.map(p => ({ ...p, isMuted: false, isCameraOff: false, isScreenSharing: false })));
      // Create offers to all existing participants
      others.forEach(p => { webrtc.createOfferForPeer(p.userId); });
    };

    const onParticipantLeft = (data: { userId: string }) => {
      setParticipants(prev => prev.filter(p => p.userId !== data.userId));
      webrtc.removePeer(data.userId);
    };

    const onMeetingEnded = () => {
      setMeetingState('idle');
      setMeetingInfo(null);
      setParticipants([]);
      setRemoteScreenStream(null);
      webrtc.cleanup();
    };

    // WebRTC signaling
    const onOffer = (data: { fromUserId: string; offer: RTCSessionDescriptionInit }) => {
      webrtc.handleOffer(data.fromUserId, data.offer);
    };
    const onAnswer = (data: { fromUserId: string; answer: RTCSessionDescriptionInit }) => {
      webrtc.handleAnswer(data.fromUserId, data.answer);
    };
    const onIce = (data: { fromUserId: string; candidate: RTCIceCandidateInit }) => {
      webrtc.handleIceCandidate(data.fromUserId, data.candidate);
    };

    // Media state sync
    const onToggleCamera = (data: { userId: string; isCameraOff: boolean }) => {
      setParticipants(prev => prev.map(p => p.userId === data.userId ? { ...p, isCameraOff: data.isCameraOff } : p));
    };
    const onToggleMic = (data: { userId: string; isMuted: boolean }) => {
      setParticipants(prev => prev.map(p => p.userId === data.userId ? { ...p, isMuted: data.isMuted } : p));
    };
    const onScreenShareStart = (data: { userId: string }) => {
      setParticipants(prev => prev.map(p => p.userId === data.userId ? { ...p, isScreenSharing: true } : p));
    };
    const onScreenShareStop = (data: { userId: string }) => {
      setParticipants(prev => prev.map(p => p.userId === data.userId ? { ...p, isScreenSharing: false } : p));
      if (remoteScreenStream?.peerId === data.userId) setRemoteScreenStream(null);
    };

    socket.on('meeting_participant_joined', onParticipantJoined);
    socket.on('meeting_participants_list', onParticipantsList);
    socket.on('meeting_participant_left', onParticipantLeft);
    socket.on('meeting_ended', onMeetingEnded);
    socket.on('meeting_offer', onOffer);
    socket.on('meeting_answer', onAnswer);
    socket.on('meeting_ice_candidate', onIce);
    socket.on('meeting_toggle_camera', onToggleCamera);
    socket.on('meeting_toggle_mic', onToggleMic);
    socket.on('meeting_screen_share_start', onScreenShareStart);
    socket.on('meeting_screen_share_stop', onScreenShareStop);

    return () => {
      socket.off('meeting_participant_joined', onParticipantJoined);
      socket.off('meeting_participants_list', onParticipantsList);
      socket.off('meeting_participant_left', onParticipantLeft);
      socket.off('meeting_ended', onMeetingEnded);
      socket.off('meeting_offer', onOffer);
      socket.off('meeting_answer', onAnswer);
      socket.off('meeting_ice_candidate', onIce);
      socket.off('meeting_toggle_camera', onToggleCamera);
      socket.off('meeting_toggle_mic', onToggleMic);
      socket.off('meeting_screen_share_start', onScreenShareStart);
      socket.off('meeting_screen_share_stop', onScreenShareStop);
    };
  }, [socket, user?.id, webrtc, remoteScreenStream]);

  // Sync local toggle state to server
  const toggleMute = useCallback(() => {
    webrtc.toggleMute();
    socket?.emit('meeting_toggle_mic', { meetingId: meetingInfo?.meetingId, isMuted: !webrtc.isMuted });
  }, [socket, webrtc, meetingInfo]);

  const toggleCamera = useCallback(() => {
    webrtc.toggleCamera();
    socket?.emit('meeting_toggle_camera', { meetingId: meetingInfo?.meetingId, isCameraOff: !webrtc.isCameraOff });
  }, [socket, webrtc, meetingInfo]);

  return (
    <MeetingContext.Provider value={{
      meetingState, meetingInfo, participants,
      localStream: webrtc.localStream, peerStreams: webrtc.peerStreams,
      screenStream: webrtc.screenStream, remoteScreenStream,
      isMuted: webrtc.isMuted, isCameraOff: webrtc.isCameraOff,
      isScreenSharing: webrtc.isScreenSharing, meetingDuration,
      createMeeting, joinMeeting, leaveMeeting, endMeeting,
      toggleMute, toggleCamera, toggleScreenShare,
    }}>
      {children}
    </MeetingContext.Provider>
  );
}
