import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { CallProvider } from './contexts/CallContext';
import { MeetingProvider } from './contexts/MeetingContext';
import CallUI from './components/CallUI';
import IncomingCallDialog from './components/IncomingCallDialog';
import MeetingRoom from './components/MeetingRoom';
import LoginPage from './pages/LoginPage';
import ChatPage from './pages/ChatPage';
import './styles/global.css';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  return token ? <>{children}</> : <Navigate to="/login" />;
}

function AppRoutes() {
  const { token } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={token ? <Navigate to="/" /> : <LoginPage />} />
      <Route path="/" element={<PrivateRoute><ChatPage /></PrivateRoute>} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <SocketProvider>
            <CallProvider>
              <MeetingProvider>
                <AppRoutes />
                <CallUI />
                <IncomingCallDialog />
                <MeetingRoom />
              </MeetingProvider>
            </CallProvider>
          </SocketProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
