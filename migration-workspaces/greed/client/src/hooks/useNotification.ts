import { useEffect, useCallback, useRef } from 'react';

function getSettings() {
  try {
    const s = localStorage.getItem('notificationSettings');
    return s ? JSON.parse(s) : { desktop: true, sound: true };
  } catch { return { desktop: true, sound: true }; }
}

export function useNotification() {
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const playSound = useCallback(() => {
    const settings = getSettings();
    if (!settings.sound) return;
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.2);
    } catch {}
  }, []);

  const showNotification = useCallback((title: string, body: string, onClick?: () => void) => {
    const settings = getSettings();
    if (!settings.desktop) return;
    if ('Notification' in window && Notification.permission === 'granted') {
      const n = new Notification(title, { body, icon: '💬' });
      if (onClick) {
        n.onclick = () => {
          window.focus();
          onClick();
          n.close();
        };
      }
    }
  }, []);

  const notify = useCallback((title: string, body: string, onClick?: () => void) => {
    playSound();
    showNotification(title, body, onClick);
  }, [playSound, showNotification]);

  return { notify, playSound, showNotification };
}
