/**
 * Auth store — user, tokens, login/logout/refresh.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { authApi, profileApi } from '../services/endpoints.js';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      // State
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      profile: null,  // GNS3 profile

      // Actions
      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const { user, accessToken, refreshToken } = await authApi.login({ email, password });
          set({ user, accessToken, refreshToken, isAuthenticated: true, isLoading: false });
          // Fetch profile in background
          get().fetchProfile();
          return true;
        } catch (err) {
          set({ isLoading: false });
          throw err;
        }
      },

      register: async (email, password, name) => {
        set({ isLoading: true });
        try {
          const { user, accessToken, refreshToken } = await authApi.register({ email, password, name });
          set({ user, accessToken, refreshToken, isAuthenticated: true, isLoading: false });
          return true;
        } catch (err) {
          set({ isLoading: false });
          throw err;
        }
      },

      refresh: async () => {
        const currentRefresh = get().refreshToken;
        if (!currentRefresh) return false;
        try {
          const { user, accessToken, refreshToken } = await authApi.refresh(currentRefresh);
          set({ user, accessToken, refreshToken, isAuthenticated: true });
          return true;
        } catch {
          get().logoutLocal();
          return false;
        }
      },

      logout: async () => {
        const refreshToken = get().refreshToken;
        try { await authApi.logout(refreshToken); } catch {}
        get().logoutLocal();
      },

      logoutLocal: () => {
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false, profile: null });
      },

      fetchMe: async () => {
        try {
          const { user } = await authApi.me();
          set({ user, isAuthenticated: true });
          return true;
        } catch {
          get().logoutLocal();
          return false;
        }
      },

      fetchProfile: async () => {
        try {
          const { profile } = await profileApi.get();
          set({ profile });
        } catch { /* ignore */ }
      },

      updateProfile: async (data) => {
        const { profile } = await profileApi.update(data);
        set({ profile });
        return profile;
      },
    }),
    {
      name: 'structuranet-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
