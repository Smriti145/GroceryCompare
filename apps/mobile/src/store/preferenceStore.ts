import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  defaultPreferences,
  Preferences,
} from '../../../../packages/contracts/preferences';
import { RETAILERS } from '../../../../packages/contracts/checkout';
export function restorePreferences(value: unknown): Preferences {
  if (!value || typeof value !== 'object') return { ...defaultPreferences };
  const p = value as Partial<Preferences>;
  return {
    mode: ['CHEAPEST', 'FASTEST', 'BALANCED'].includes(p.mode || '')
      ? p.mode!
      : 'CHEAPEST',
    singlePlatformOnly: p.singlePlatformOnly === true,
    substitutionsAllowed: p.substitutionsAllowed === true,
    maxEtaMinutes:
      Number.isInteger(p.maxEtaMinutes) &&
      Number(p.maxEtaMinutes) > 0 &&
      Number(p.maxEtaMinutes) <= 10080
        ? p.maxEtaMinutes!
        : null,
    avoidedRetailers: Array.isArray(p.avoidedRetailers)
      ? p.avoidedRetailers.filter(v => RETAILERS.includes(v)).slice(0, 5)
      : [],
    preferredBrands: Array.isArray(p.preferredBrands)
      ? p.preferredBrands
          .filter(v => typeof v === 'string' && v.length <= 100)
          .slice(0, 20)
      : [],
    dietaryTags: Array.isArray(p.dietaryTags)
      ? p.dietaryTags
          .filter(v =>
            ['VEGETARIAN', 'VEGAN', 'ORGANIC', 'GLUTEN_FREE'].includes(v),
          )
          .slice(0, 4)
      : [],
  };
}
export const usePreferenceStore = create<{
  preferences: Preferences;
  setPreferences: (p: Preferences) => void;
}>()(
  persist(
    set => ({
      preferences: { ...defaultPreferences },
      setPreferences: preferences =>
        set({ preferences: restorePreferences(preferences) }),
    }),
    {
      name: 'grocery-recommendation-preferences',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: s => ({ preferences: s.preferences }),
      merge: (saved, current) => ({
        ...current,
        preferences: restorePreferences(
          (saved as { preferences?: unknown })?.preferences,
        ),
      }),
    },
  ),
);
