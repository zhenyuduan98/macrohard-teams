import React, { createContext, useContext, useState, useEffect } from 'react';

interface ThemeContextType {
  isDark: boolean;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextType>({ isDark: false, toggle: () => {} });

const lightVars: Record<string, string> = {
  '--bg-primary': '#fff',
  '--bg-secondary': '#f5f5f5',
  '--bg-sidebar': '#292929',
  '--text-primary': '#1a1a1a',
  '--text-secondary': '#616161',
  '--border': '#e0e0e0',
  '--msg-sent': '#e8ebfa',
  '--msg-received': '#f0f0f0',
  '--bg-hover': '#f0f0f0',
  '--bg-input': '#e8e8e8',
  '--bg-card': '#fff',
  '--shadow': 'rgba(0,0,0,0.15)',
};

const darkVars: Record<string, string> = {
  '--bg-primary': '#1f1f1f',
  '--bg-secondary': '#2d2d2d',
  '--bg-sidebar': '#1a1a1a',
  '--text-primary': '#e0e0e0',
  '--text-secondary': '#a0a0a0',
  '--border': '#3a3a3a',
  '--msg-sent': '#3b3d6e',
  '--msg-received': '#383838',
  '--bg-hover': '#3a3a3a',
  '--bg-input': '#3a3a3a',
  '--bg-card': '#2d2d2d',
  '--shadow': 'rgba(0,0,0,0.4)',
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(() => {
    try { return localStorage.getItem('theme') === 'dark'; } catch { return false; }
  });

  useEffect(() => {
    const vars = isDark ? darkVars : lightVars;
    const root = document.documentElement;
    Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  return (
    <ThemeContext.Provider value={{ isDark, toggle: () => setIsDark(p => !p) }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
