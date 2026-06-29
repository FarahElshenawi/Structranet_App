/**
 * Axios instance with interceptors:
 * - Request: attach Authorization header
 * - Response: auto-refresh on 401, retry original request
 */
import axios from 'axios';
import { useAuthStore } from '../stores/authStore.js';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 30_000,
});

// ── Request: attach token ──────────────────────────────────
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response: auto-refresh on 401 ──────────────────────────
let isRefreshing = false;
let waitQueue = [];

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;

    // Don't retry on auth endpoints or already-retried
    const isAuthEndpoint = original.url?.includes('/auth/');
    if (status !== 401 || original._retry || isAuthEndpoint) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      // Queue this request until refresh completes
      return new Promise((resolve, reject) => {
        waitQueue.push({ resolve, reject, original });
      });
    }

    original._retry = true;
    isRefreshing = true;

    try {
      const refreshed = await useAuthStore.getState().refresh();
      if (!refreshed) throw error;

      // Replay queued requests
      waitQueue.forEach(({ resolve, reject, original: req }) => {
        api(req).then(resolve).catch(reject);
      });
      waitQueue = [];

      return api(original);
    } catch (refreshError) {
      // Refresh failed — log out
      waitQueue.forEach(({ reject }) => reject(refreshError));
      waitQueue = [];
      useAuthStore.getState().logoutLocal();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;
