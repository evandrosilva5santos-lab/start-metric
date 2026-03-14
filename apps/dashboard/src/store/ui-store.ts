import { create } from 'zustand';

interface UIState {
  isLoading: boolean;
  error: string | null;
  sidebarOpen: boolean;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  toggleSidebar: () => void;
  resetUI: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  isLoading: false,
  error: null,
  sidebarOpen: true,
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  resetUI: () => set({ isLoading: false, error: null }),
}));
