import React, { useEffect, useMemo, useState } from 'react';
import { Search, Filter, Loader2, X } from 'lucide-react';
import { TournamentEditionList } from '../types';
import { listEditions, TournamentFilters } from '../services/tournaments';
import { TournamentCard } from '../components/TournamentCard';

const STATES = [
  '', 'SP','RJ','MG','RS','SC','PR','BA','PE','CE','DF','GO','ES',
  'MT','MS','PA','AM','MA','RN','PB','AL','SE','PI','TO','RO','RR','AP','AC',
];

const STATUS_OPTS = [
  { v: '', l: 'Todos' },
  { v: 'open', l: 'Abertas' },
  { v: 'closing_soon', l: 'Encerrando' },
  { v: 'announced', l: 'Anunciados' },
  { v: 'in_progress', l: 'Em andamento' },
  { v: 'draws_published', l: 'Chaves publicadas' },
];

export const TournamentsPage: React.FC = () => {
  const [items, setItems] = useState<TournamentEditionList[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<TournamentFilters>({ status: '', state: '' });
  const [showFilters, setShowFilters] = useState(false);
  const [q, setQ] = useState('');

  const hasAnyFilter = useMemo(
    () => !!(filters.status || filters.state || filters.q || filters.modality || filters.surface),
    [filters],
  );

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    // Default ordering: upcoming first (start_date asc skips very old; -created_at as tiebreak)
    listEditions({ ...filters, page, page_size: 20 })
      .then((data) => {
        if (cancel) return;
        setItems(data.results);
        setTotalPages(data.total_pages || 1);
      })
      .catch(() => setItems([]))
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => { cancel = true; };
  }, [filters, page]);

  function applySearch() {
    setPage(1);
    setFilters((f) => ({ ...f, q: q.trim() || undefined }));
  }

  function clearFilters() {
    setQ('');
    setFilters({ status: '', state: '' });
    setPage(1);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Torneios</h1>
        <p className="text-sm text-text-muted">Agregados de CBT, FPT e federações parceiras</p>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            className="input-base pl-10"
            placeholder="Buscar por nome, cidade..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applySearch()}
          />
        </div>
        <button
          className="btn-secondary !px-3 relative"
          onClick={() => setShowFilters((v) => !v)}
        >
          <Filter className="w-4 h-4" />
          {hasAnyFilter && (
            <span className="absolute -top-1 -right-1 bg-accent-neon w-2 h-2 rounded-full" />
          )}
        </button>
      </div>

      {showFilters && (
        <div className="card space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-text-secondary mb-1 block">UF</label>
              <select
                className="input-base"
                value={filters.state || ''}
                onChange={(e) => { setPage(1); setFilters((f) => ({ ...f, state: e.target.value })); }}
              >
                {STATES.map((s) => (
                  <option key={s} value={s}>{s || 'Todos'}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-text-secondary mb-1 block">Status</label>
              <select
                className="input-base"
                value={filters.status || ''}
                onChange={(e) => { setPage(1); setFilters((f) => ({ ...f, status: e.target.value })); }}
              >
                {STATUS_OPTS.map((o) => (
                  <option key={o.v} value={o.v}>{o.l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-text-secondary mb-1 block">Modalidade</label>
              <select
                className="input-base"
                value={filters.modality || ''}
                onChange={(e) => { setPage(1); setFilters((f) => ({ ...f, modality: e.target.value })); }}
              >
                <option value="">Todas</option>
                <option value="tennis">Tênis</option>
                <option value="beach_tennis">Beach Tennis</option>
                <option value="wheelchair">Cadeira de rodas</option>
                <option value="padel">Padel</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-text-secondary mb-1 block">Superfície</label>
              <select
                className="input-base"
                value={filters.surface || ''}
                onChange={(e) => { setPage(1); setFilters((f) => ({ ...f, surface: e.target.value })); }}
              >
                <option value="">Todas</option>
                <option value="clay">Saibro</option>
                <option value="hard">Rápida</option>
                <option value="grass">Grama</option>
                <option value="sand">Areia</option>
              </select>
            </div>
          </div>
          {hasAnyFilter && (
            <button
              className="text-xs text-accent-blue flex items-center gap-1 hover:underline"
              onClick={clearFilters}
            >
              <X className="w-3 h-3" /> Limpar filtros
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 text-accent-neon animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="card text-center py-10 text-text-muted">
          Nenhum torneio encontrado com estes filtros.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((ed) => (
            <TournamentCard key={ed.id} edition={ed} />
          ))}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button
                className="btn-secondary !py-2 !px-3 text-sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Anterior
              </button>
              <span className="text-xs text-text-muted">Página {page} de {totalPages}</span>
              <button
                className="btn-secondary !py-2 !px-3 text-sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
