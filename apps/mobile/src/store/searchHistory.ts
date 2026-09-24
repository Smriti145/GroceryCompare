import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
export const useSearchHistory = create<{
  recent: Record<string, string[]>;
  remember: (pincode: string, term: string) => void;
  clear: () => void;
}>()(
  persist(
    set => ({
      recent: {},
      clear: () => set({ recent: {} }),
      remember: (pincode, raw) => {
        const term = raw.trim().slice(0, 100);
        if (!/^[1-9][0-9]{5}$/.test(pincode) || !term) return;
        set(s => ({
          recent: {
            ...Object.fromEntries(
              Object.entries(s.recent)
                .filter(([key]) => key !== pincode)
                .slice(-9),
            ),
            [pincode]: [
              term,
              ...(s.recent[pincode] || []).filter(t => t !== term),
            ].slice(0, 10),
          },
        }));
      },
    }),
    {
      name: 'grocery-recent-searches',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: s => ({ recent: s.recent }),
      merge: (saved, current) => {
        const source = (saved as { recent?: unknown })?.recent;
        const recent: Record<string, string[]> = {};
        if (source && typeof source === 'object')
          for (const [key, value] of Object.entries(source).slice(0, 10))
            if (/^[1-9][0-9]{5}$/.test(key) && Array.isArray(value))
              recent[key] = value
                .filter(v => typeof v === 'string' && v.length <= 100)
                .slice(0, 10);
        return { ...current, recent };
      },
    },
  ),
);
