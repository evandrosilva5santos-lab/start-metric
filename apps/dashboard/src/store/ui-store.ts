import { create } from 'zustand';

interface UIState {
  loadingKeys: Record<string, boolean>;
  errorByKey: Record<string, string>;
  isLoading: boolean;
  error: string | null;
  sidebarOpen: boolean;
  startLoading: (key: string) => void;
  stopLoading: (key: string) => void;
  setErrorByKey: (key: string, error: string | null) => void;
  clearErrorByKey: (key: string) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  toggleSidebar: () => void;
  resetUI: () => void;
}

const MANUAL_LOADING_KEY = '__manual_loading__';
const MANUAL_ERROR_KEY = '__manual_error__';

export const useUIStore = create<UIState>((set) => ({
  loadingKeys: {},
  errorByKey: {},
  isLoading: false,
  error: null,
  sidebarOpen: true,
  startLoading: (key) =>
    set((state) => {
      if (state.loadingKeys[key]) return state;
      const loadingKeys = { ...state.loadingKeys, [key]: true };
      return { loadingKeys, isLoading: Object.keys(loadingKeys).length > 0 };
    }),
  stopLoading: (key) =>
    set((state) => {
      if (!state.loadingKeys[key]) return state;
      const loadingKeys = { ...state.loadingKeys };
      delete loadingKeys[key];
      return { loadingKeys, isLoading: Object.keys(loadingKeys).length > 0 };
    }),
  setErrorByKey: (key, error) =>
    set((state) => {
      const errorByKey = { ...state.errorByKey };
      if (error) errorByKey[key] = error;
      else delete errorByKey[key];
      const nextError = Object.values(errorByKey).at(-1) ?? null;
      return { errorByKey, error: nextError };
    }),
  clearErrorByKey: (key) =>
    set((state) => {
      if (!(key in state.errorByKey)) return state;
      const errorByKey = { ...state.errorByKey };
      delete errorByKey[key];
      const nextError = Object.values(errorByKey).at(-1) ?? null;
      return { errorByKey, error: nextError };
    }),
  setLoading: (isLoading) =>
    set((state) => {
      const loadingKeys = { ...state.loadingKeys };
      if (isLoading) loadingKeys[MANUAL_LOADING_KEY] = true;
      else delete loadingKeys[MANUAL_LOADING_KEY];
      return { loadingKeys, isLoading: Object.keys(loadingKeys).length > 0 };
    }),
  setError: (error) =>
    set((state) => {
      const errorByKey = { ...state.errorByKey };
      if (error) errorByKey[MANUAL_ERROR_KEY] = error;
      else delete errorByKey[MANUAL_ERROR_KEY];
      const nextError = Object.values(errorByKey).at(-1) ?? null;
      return { errorByKey, error: nextError };
    }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  resetUI: () => set({ loadingKeys: {}, errorByKey: {}, isLoading: false, error: null }),
}));
