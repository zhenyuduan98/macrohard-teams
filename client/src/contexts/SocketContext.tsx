import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { SOCKET_URL } from '../utils/config';

interface UserStatus { statusText?: string; statusType?: string; }
interface SocketCtx {
  socket: Socket | null;
  onlineUsers: Set<string>;
  userStatuses: Map<string, UserStatus>;
}

const SocketContext = createContext<SocketCtx>({ socket: null, onlineUsers: new Set(), userStatuses: new Map() });
export const useSocket = () => useContext(SocketContext);

export function SocketProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [userStatuses, setUserStatuses] = useState<Map<string, UserStatus>>(new Map());

  useEffect(() => {
    if (!token) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      return;
    }

    const s = io(SOCKET_URL, { auth: { token } });
    socketRef.current = s;

    s.on('user_online', ({ userId }: { userId: string }) => {
      setOnlineUsers(prev => new Set(prev).add(userId));
    });

    s.on('user_offline', ({ userId }: { userId: string }) => {
      setOnlineUsers(prev => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    });

    s.on('status_change', ({ userId, statusText, statusType }: { userId: string; statusText?: string; statusType?: string }) => {
      setUserStatuses(prev => {
        const next = new Map(prev);
        next.set(userId, { statusText, statusType });
        return next;
      });
    });

    return () => { s.disconnect(); };
  }, [token]);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, onlineUsers, userStatuses }}>
      {children}
    </SocketContext.Provider>
  );
}
