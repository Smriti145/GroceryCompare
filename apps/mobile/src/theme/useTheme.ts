import { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Colors, DarkColors, Palette } from './colors';
export type ThemeMode = 'system' | 'light' | 'dark';
export const useThemeStore = create<{ mode: ThemeMode; setMode: (mode: ThemeMode) => void }>()(persist(set => ({ mode: 'system', setMode: mode => set({ mode }) }), { name: 'grocery-theme', storage: createJSONStorage(() => AsyncStorage), partialize: s => ({ mode: s.mode }), merge: (value,current) => { const mode=(value as {mode?:ThemeMode})?.mode; return {...current,mode:mode && ['system','light','dark'].includes(mode)?mode:'system'}; } }));
export function useColors() { const mode=useThemeStore(s=>s.mode), system=useColorScheme(); return (mode==='system'?system:mode)==='dark'?DarkColors:Colors; }
export function useThemeStyles<T>(factory:(colors:Palette)=>T) { const colors=useColors(); return useMemo(()=>factory(colors),[colors,factory]); }
