import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';

export const TOKEN_KEY   = 'th_access';
export const REFRESH_KEY = 'th_refresh';
export const USER_KEY    = 'th_user';

// SecureStore wrappers — uses Keychain (iOS) / EncryptedSharedPreferences (Android)
// Falls back silently on web where SecureStore is unavailable.
async function secureGet(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function secureSet(key: string, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    // no-op on unsupported platforms
  }
}

async function secureDelete(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // no-op
  }
}

export const storage = {
  get: secureGet,
  set: secureSet,
  delete: secureDelete,
  deleteMultiple: (keys: string[]) => Promise.all(keys.map(secureDelete)),
};

function resolveBaseUrl(): string {
  const configured = (process.env.EXPO_PUBLIC_API_BASE_URL || '').trim();
  if (configured) return configured;
  if (__DEV__) return 'http://localhost:8000';
  throw new Error(
    'EXPO_PUBLIC_API_BASE_URL is not set. ' +
    'Add it to eas.json under the correct build profile env section.',
  );
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
  const token = await secureGet(TOKEN_KEY);
  if (token && config.headers) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

async function refreshToken() {
  const refresh = await secureGet(REFRESH_KEY);
  if (!refresh) throw new Error('no refresh token');
  const res = await axios.post(`${BASE_URL}/api/auth/token/refresh/`, { refresh });
  const newAccess = res.data.access;
  await secureSet(TOKEN_KEY, newAccess);
  if (res.data.refresh) await secureSet(REFRESH_KEY, res.data.refresh);
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
        await storage.deleteMultiple([TOKEN_KEY, REFRESH_KEY, USER_KEY]);
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
