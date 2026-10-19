import { create } from 'zustand';

const KEY = 'helpdesk.ui.sidebar';

function loadCollapsed(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

interface UiState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;
  commandOpen: boolean;
  setCommandOpen: (v: boolean) => void;
}

/** Estado de UI del shell (colapsado del sidebar + command palette). Colapsado persistido. */
export const useUiStore = create<UiState>((set) => ({
  commandOpen: false,
  setCommandOpen: (v) => set({ commandOpen: v }),
  sidebarCollapsed: loadCollapsed(),
  toggleSidebar: () =>
    set((s) => {
      const next = !s.sidebarCollapsed;
      try {
        localStorage.setItem(KEY, next ? '1' : '0');
      } catch {
        /* noop */
      }
      return { sidebarCollapsed: next };
    }),
  setSidebarCollapsed: (v) => {
    try {
      localStorage.setItem(KEY, v ? '1' : '0');
    } catch {
      /* noop */
    }
    set({ sidebarCollapsed: v });
  },
}));
