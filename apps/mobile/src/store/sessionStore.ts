import { create } from 'zustand';
export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
}
// Tokens stay in memory until native Keychain/Keystore persistence is provisioned.
export const useSessionStore = create<{
  tokens: SessionTokens | null;
  setTokens: (tokens: SessionTokens | null) => void;
}>(set => ({ tokens: null, setTokens: tokens => set({ tokens }) }));
