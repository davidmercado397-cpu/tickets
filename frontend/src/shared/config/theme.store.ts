import { create } from 'zustand';

export type Theme = 'light' | 'dark';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
}

/** Estado de tema (UI/cliente). El ThemeProvider aplica la clase al <html>. */
export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: 'light',
  setTheme: (theme) => set({ theme }),
  toggle: () => set({ theme: get().theme === 'light' ? 'dark' : 'light' }),
}));
