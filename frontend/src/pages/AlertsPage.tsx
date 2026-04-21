import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell, Loader2, CheckCheck, Clock, AlertCircle, Sparkles, XCircle, ExternalLink,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Alert } from '../types';
import { listAlerts, markAlertRead, markAllAlertsRead } from '../services/data';
import { fmtRelative } from '../utils/format';
import { extractApiError } from '../services/api';

const KIND_ICONS: Record<Alert['kind'], React.ReactNode> = {
  deadline: <Clock className="w-5 h-5 text-status-closing" />,
  change: <AlertCircle className="w-5 h-5 text-accent-blue" />,
  draws: <Sparkles className="w-5 h-5 text-accent-neon" />,
  canceled: <XCircle className="w-5 h-5 text-status-canceled" />,
  other: <Bell className="w-5 h-5 text-text-secondary" />,
};

export const AlertsPage: React.FC = () => {
  const [items, setItems] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const data = await listAlerts();
      setItems(data);
    } catch (err) {
      toast.error(extractApiError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function markRead(id: number) {
    try {
      await markAlertRead(id);
      setItems((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: 'read', read_at: new Date().toISOString() } : a)),
      );
    } catch { /* ignore */ }
  }

  async function markAll() {
    try {
      await markAllAlertsRead();
      toast.success('Alertas marcados como lidos');
      load();
    } catch (err) {
      toast.error(extractApiError(err));
    }
  }

  if (loading) {
    return (
      <div className="py-16 flex justify-center">
        <Loader2 className="w-8 h-8 text-accent-neon animate-spin" />
      </div>
    );
  }

  const unreadCount = items.filter((a) => a.status !== 'read').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Alertas</h1>
          <p className="text-sm text-text-muted">
            {unreadCount > 0 ? `${unreadCount} não lidos` : 'Tudo em dia'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button className="btn-ghost flex items-center gap-1 text-xs" onClick={markAll}>
            <CheckCheck className="w-4 h-4" /> Marcar todos
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="card text-center py-10">
          <Bell className="w-10 h-10 text-text-muted mx-auto mb-3" />
          <p className="text-sm text-text-secondary">Nenhum alerta ainda.</p>
          <p className="text-xs text-text-muted mt-2">
            Adicione torneios à sua agenda e receberemos avisos de prazos e mudanças.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((a) => (
            <div
              key={a.id}
              onClick={() => a.status !== 'read' && markRead(a.id)}
              className={`card flex gap-3 cursor-pointer hover:border-accent-neon/30 transition-colors ${
                a.status === 'read' ? 'opacity-60' : ''
              }`}
            >
              <div className="shrink-0 mt-0.5">{KIND_ICONS[a.kind]}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-sm leading-tight">{a.title}</h3>
                  {a.status !== 'read' && (
                    <span className="w-2 h-2 rounded-full bg-accent-neon shrink-0 mt-1.5" />
                  )}
                </div>
                {a.body && (
                  <p className="text-xs text-text-secondary mt-1 whitespace-pre-line line-clamp-3">
                    {a.body}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-2 text-[10px] text-text-muted">
                  <span>{fmtRelative(a.created_at)}</span>
                  {a.edition && (
                    <Link
                      to={`/torneios/${a.edition}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-accent-blue hover:underline flex items-center gap-0.5"
                    >
                      <ExternalLink className="w-3 h-3" /> Ver torneio
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
