import { useState } from 'react';
import api from '../services/api';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return new Uint8Array([...rawData].map(c => c.charCodeAt(0)));
}

export function usePushNotifications() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSupported = 'serviceWorker' in navigator && 'PushManager' in window;

  async function subscribe(): Promise<boolean> {
    if (!isSupported) {
      setError('Push notifications não são suportadas neste dispositivo.');
      return false;
    }
    if (!VAPID_PUBLIC_KEY) {
      setError('VAPID key não configurada. Defina VITE_VAPID_PUBLIC_KEY no .env.');
      return false;
    }
    setLoading(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      if (existing) await existing.unsubscribe();

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as ArrayBuffer,
      });
      const json = sub.toJSON();
      await api.post('/api/alerts/push-subscribe/', {
        endpoint: sub.endpoint,
        keys: json.keys,
      });
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao ativar notificações.';
      setError(msg);
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function unsubscribe(): Promise<boolean> {
    if (!isSupported) return false;
    setLoading(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await api.delete('/api/alerts/push-subscribe/', { data: { endpoint: sub.endpoint } });
        await sub.unsubscribe();
      }
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao desativar notificações.';
      setError(msg);
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function getPermissionState(): Promise<NotificationPermission | 'unsupported'> {
    if (!isSupported) return 'unsupported';
    return Notification.permission;
  }

  return { subscribe, unsubscribe, getPermissionState, isSupported, loading, error };
}
