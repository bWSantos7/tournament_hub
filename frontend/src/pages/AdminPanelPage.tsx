import React, { useEffect, useState } from 'react';
import { Loader2, RefreshCcw, Play, Database, AlertTriangle, Link2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { extractApiError } from '../services/api';
import { TournamentEditionList } from '../types';
import { TournamentCard } from '../components/TournamentCard';

interface Dashboard {
  counts: {
    tournaments_total: number;
    tournaments_open: number;
    tournaments_closing_soon: number;
    data_sources_enabled: number;
    data_sources_total: number;
    manual_overrides: number;
    low_confidence: number;
    missing_official_url: number;
  };
  ingestion: { runs_24h: number; failed_24h: number; partial_24h: number };
  alerts: { total_7d: number; failed_7d: number };
  audit: { actions_24h: number };
}

interface ReviewQueue {
  low_confidence: TournamentEditionList[];
  missing_official_url: TournamentEditionList[];
  recently_changed: TournamentEditionList[];
}

export const AdminPanelPage: React.FC = () => {
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [queue, setQueue] = useState<ReviewQueue | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [d, q] = await Promise.all([
        api.get<Dashboard>('/api/admin-panel/dashboard/'),
        api.get<ReviewQueue>('/api/admin-panel/review-queue/'),
      ]);
      setDash(d.data);
      setQueue(q.data);
    } catch (err) {
      toast.error(extractApiError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function runAll() {
    setRunning(true);
    try {
      await api.post('/api/ingestion/runs/run-all/');
      toast.success('Ingestão disparada em background');
    } catch (err) {
      toast.error(extractApiError(err));
    } finally {
      setRunning(false);
    }
  }

  if (loading || !dash) {
    return (
      <div className="py-16 flex justify-center">
        <Loader2 className="w-8 h-8 text-accent-neon animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Painel administrativo</h1>
          <p className="text-sm text-text-muted">Curadoria, ingestão e monitoramento</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary !py-2 !px-3" onClick={load} title="Atualizar">
            <RefreshCcw className="w-4 h-4" />
          </button>
          <button
            className="btn-primary !py-2 !px-3 flex items-center gap-1"
            onClick={runAll}
            disabled={running}
          >
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Ingerir agora
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Torneios" value={dash.counts.tournaments_total} icon={<Database />} />
        <StatCard label="Abertos" value={dash.counts.tournaments_open} accent />
        <StatCard label="Fechando" value={dash.counts.tournaments_closing_soon} warn />
        <StatCard label="Fontes ativas" value={`${dash.counts.data_sources_enabled}/${dash.counts.data_sources_total}`} />
        <StatCard label="Overrides manuais" value={dash.counts.manual_overrides} />
        <StatCard label="Baixa confiança" value={dash.counts.low_confidence} warn />
        <StatCard label="Sem URL oficial" value={dash.counts.missing_official_url} warn />
        <StatCard label="Execuções 24h" value={`${dash.ingestion.runs_24h} (${dash.ingestion.failed_24h} falhas)`} />
      </div>

      {queue && (
        <>
          <QueueSection
            title="Baixa confiança"
            icon={<AlertTriangle className="w-4 h-4 text-status-closing" />}
            items={queue.low_confidence}
            emptyText="Nenhuma edição com baixa confiança."
          />
          <QueueSection
            title="Sem link oficial"
            icon={<Link2 className="w-4 h-4 text-status-canceled" />}
            items={queue.missing_official_url}
            emptyText="Todas as edições possuem link oficial."
          />
          <QueueSection
            title="Alteradas recentemente"
            icon={<RefreshCcw className="w-4 h-4 text-accent-blue" />}
            items={queue.recently_changed}
            emptyText="Nenhuma alteração recente."
          />
        </>
      )}
    </div>
  );
};

const StatCard: React.FC<{
  label: string;
  value: number | string;
  icon?: React.ReactNode;
  accent?: boolean;
  warn?: boolean;
}> = ({ label, value, accent, warn }) => (
  <div className="card !p-3">
    <div className="text-[10px] text-text-muted uppercase">{label}</div>
    <div className={`text-xl font-bold mt-1 ${
      accent ? 'text-accent-neon' : warn ? 'text-status-closing' : ''
    }`}>{value}</div>
  </div>
);

const QueueSection: React.FC<{
  title: string;
  icon: React.ReactNode;
  items: TournamentEditionList[];
  emptyText: string;
}> = ({ title, icon, items, emptyText }) => (
  <section>
    <h2 className="font-semibold flex items-center gap-2 mb-2">{icon} {title}</h2>
    {items.length === 0 ? (
      <div className="card text-center py-6 text-sm text-text-muted">{emptyText}</div>
    ) : (
      <div className="space-y-2">
        {items.slice(0, 5).map((ed) => (
          <TournamentCard key={ed.id} edition={ed} />
        ))}
      </div>
    )}
  </section>
);
