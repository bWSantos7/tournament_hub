import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';

function resolveBaseUrl(): string {
  const configured = (import.meta.env.VITE_API_BASE_URL as string) || '';
  if (configured) return configured;
  // Dev fallback only — VITE_API_BASE_URL must be set in production.
  return 'http://localhost:8000';
}

const BASE_URL = resolveBaseUrl();

export const TOKEN_KEY = 'th_access';
export const REFRESH_KEY = 'th_refresh';
export const USER_KEY = 'th_user';

let isRefreshing = false;
let pendingRequests: Array<(token: string) => void> = [];

const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

async function refreshToken(): Promise<string> {
  const refresh = localStorage.getItem(REFRESH_KEY);
  if (!refresh) throw new Error('no refresh token');
  const res = await axios.post(`${BASE_URL}/api/auth/token/refresh/`, { refresh });
  const newAccess = res.data.access;
  localStorage.setItem(TOKEN_KEY, newAccess);
  if (res.data.refresh) localStorage.setItem(REFRESH_KEY, res.data.refresh);
  return newAccess;
}

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    if (
      error.response?.status === 401 &&
      original &&
      !original._retry &&
      !original.url?.includes('/auth/login') &&
      !original.url?.includes('/auth/token/refresh') &&
      !original.url?.includes('/auth/register')
    ) {
      original._retry = true;
      if (isRefreshing) {
        return new Promise((resolve) => {
          pendingRequests.push((token) => {
            if (original.headers) original.headers.Authorization = `Bearer ${token}`;
            resolve(api(original));
          });
        });
      }
      isRefreshing = true;
      try {
        const token = await refreshToken();
        pendingRequests.forEach((cb) => cb(token));
        pendingRequests = [];
        if (original.headers) original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      } catch (err) {
        pendingRequests = [];
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_KEY);
        localStorage.removeItem(USER_KEY);
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  },
);

export default api;

export function extractApiError(err: unknown): string {
  const ax = err as AxiosError<Record<string, unknown>>;
  const data = ax.response?.data;
  if (!data) return ax.message || 'Erro desconhecido';
  if (typeof data === 'string') return data;
  if (typeof data === 'object') {
    const detail = (data as Record<string, unknown>).detail;
    if (typeof detail === 'string') return detail;
    const parts: string[] = [];
    for (const [k, v] of Object.entries(data)) {
      if (Array.isArray(v)) parts.push(`${k}: ${v.join(', ')}`);
      else if (typeof v === 'string') parts.push(`${k}: ${v}`);
    }
    if (parts.length) return parts.join(' • ');
  }
  return ax.message || 'Erro desconhecido';
}
