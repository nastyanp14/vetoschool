import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';
const KEY = 'vetoschool_theme';

export function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  return (localStorage.getItem(KEY) as Theme) || 'light';
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'dark') root.classList.add('dark');
  else root.classList.remove('dark');
}

const listeners = new Set<(t: Theme) => void>();

export function setTheme(theme: Theme) {
  localStorage.setItem(KEY, theme);
  applyTheme(theme);
  listeners.forEach(l => l(theme));
}

export function useTheme() {
  const [theme, setLocalTheme] = useState<Theme>(() => getStoredTheme());
  useEffect(() => {
    applyTheme(theme);
    const l = (t: Theme) => setLocalTheme(t);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return {
    theme,
    toggle: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
    setTheme,
  };
}
