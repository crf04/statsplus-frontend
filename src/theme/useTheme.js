import { useSyncExternalStore } from 'react';
import { createThemeStore } from './themeStore';

export const themeStore = createThemeStore();

// { preference: 'system' | 'light' | 'dark', resolved: 'light' | 'dark', setPreference }
export const useTheme = () => {
  const snapshot = useSyncExternalStore(themeStore.subscribe, themeStore.getSnapshot);
  return { ...snapshot, setPreference: themeStore.setPreference };
};
