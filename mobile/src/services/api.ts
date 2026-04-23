import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const TOKEN_KEY = 'th_access';
export const REFRESH_KEY = 'th_refresh';
export const USER_KEY = 'th_user';

function resolveBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_BASE_URL || '';
  if (configured) return configured;
  return 'http://localhost:8000';
}

export const BASE_URL = resolveBaseUrl();

export function mediaUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith('http')) return path;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${BASE_URL}${normalized}`;
}

let isRefreshing = false;
let pendingRequests: Array<(token: string) => void> = [];

const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (token && config.headers) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

async function refreshToken() {
  const refresh = await AsyncStorage.getItem(REFRESH_KEY);
  if (!refresh) throw new Error('no refresh token');
  const res = await axios.post(`${BASE_URL}/api/auth/token/refresh/`, { refresh });
  const newAccess = res.data.access;
  await AsyncStorage.setItem(TOKEN_KEY, newAccess);
  if (res.data.refresh) await AsyncStorage.setItem(REFRESH_KEY, res.data.refresh);
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
        await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_KEY, USER_KEY]);
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
  const detail = (data as Record<string, unknown>).detail;
  if (typeof detail === 'string') return detail;
  const parts: string[] = [];
  for (const [k, v] of Object.entries(data)) {
    if (Array.isArray(v)) parts.push(`${k}: ${v.join(', ')}`);
    else if (typeof v === 'string') parts.push(`${k}: ${v}`);
  }
  return parts.length ? parts.join(' • ') : ax.message || 'Erro desconhecido';
}
