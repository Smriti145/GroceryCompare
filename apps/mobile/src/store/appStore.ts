import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { restoreLocation } from './persistence';
import config from '../config/runtime.json';
interface AppState {
  location: string;
  setLocation: (location: string) => void;
}
export const useAppStore = create<AppState>()(
  persist(
    set => ({
      location: /^[1-9][0-9]{5}$/.test(config.defaultLocation)
        ? config.defaultLocation
        : '',
      setLocation: location => {
        if (/^[1-9][0-9]{5}$/.test(location)) set({ location });
      },
    }),
    {
      name: 'grocery-preferences',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: state => ({ location: state.location }),
      merge: (saved, current) => ({
        ...current,
        location: restoreLocation(saved, current.location),
      }),
    },
  ),
);
