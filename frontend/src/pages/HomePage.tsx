import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Clock, Sparkles, Bell, Loader2 } from 'lucide-react';
import { TournamentEditionList, PlayerProfile } from '../types';
import { closingSoon, compatibleForProfile, listEditions } from '../services/tournaments';
import { listProfiles, unreadAlerts } from '../services/data';
import { TournamentCard } from '../components/TournamentCard';
import { useAuth } from '../contexts/AuthContext';
import { pickBestProfile } from '../utils/profile';

export const HomePage: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [compat, setCompat] = useState<TournamentEditionList[]>([]);
  const [closing, setClosing] = useState<TournamentEditionList[]>([]);
  const [recent, setRecent] = useState<TournamentEditionList[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const [profiles, closingData, recentData, alerts] = await Promise.all([
          listProfiles().catch(() => []),
          closingSoon(14).catch(() => []),
          listEditions({ page_size: 8, ordering: '-created_at' }).catch(() => ({ results: [] } as any)),
          unreadAlerts().catch(() => []),
        ]);
        const primary = pickBestProfile(profiles);
        setProfile(primary);
        setClosing((closingData as TournamentEditionList[]).slice(0, 6));
        setRecent((recentData.results || []).slice(0, 6));
        setUnreadCount((alerts || []).length);

        if (primary) {
          const compatData = await compatibleForProfile(primary.id, { page_size: 6 }).catch(
            () => ({ results: [] as TournamentEditionList[] }),
          );
          setCompat((compatData.results || []).slice(0, 6));
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="py-16 flex justify-center">
        <Loader2 className="w-8 h-8 text-accent-neon animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="card text-center py-10">
        <Sparkles className="w-10 h-10 text-accent-neon mx-auto mb-3" />
        <h2 className="text-lg font-semibold mb-1">Vamos montar seu perfil</h2>
        <p className="text-sm text-text-secondary mb-4">
          Precisamos de alguns dados para mostrar torneios compatíveis com você.
        </p>
        <Link to="/onboarding" className="btn-primary inline-flex items-center gap-2">
          Completar perfil <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-text-muted">Olá,</div>
            <h1 className="text-2xl font-bold">
              {user?.full_name || profile.display_name}
            </h1>
            <div className="text-xs text-text-secondary mt-1">
              {profile.tennis_class && `Classe ${profile.tennis_class}`}
              {profile.sporting_age ? ` • ${profile.sporting_age} anos esportivos` : ''}
              {profile.home_state && ` • ${profile.home_state}`}
            </div>
          </div>
          <Link to="/alertas" className="btn-ghost relative">
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-accent-neon text-bg-base text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>
        </div>
      </section>

      <Section
        title="Compatíveis com você"
        subtitle="Baseado no seu perfil e classe"
        icon={<Sparkles className="w-4 h-4 text-accent-neon" />}
        emptyText="Nenhum torneio compatível encontrado ainda. Novas ingestões acontecem a cada hora."
        items={compat}
        accent
      />

      <Section
        title="Inscrições fechando"
        subtitle="Próximos 14 dias"
        icon={<Clock className="w-4 h-4 text-status-closing" />}
        emptyText="Nenhum prazo se aproximando."
        items={closing}
      />

      <Section
        title="Recentemente adicionados"
        subtitle="Últimos torneios agregados"
        items={recent}
        viewAll="/torneios"
        emptyText="Nenhum torneio na base ainda."
      />
    </div>
  );
};

const Section: React.FC<{
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  items: TournamentEditionList[];
  emptyText: string;
  viewAll?: string;
  accent?: boolean;
}> = ({ title, subtitle, icon, items, emptyText, viewAll, accent = false }) => (
  <section>
    <div className="flex items-end justify-between mb-3">
      <div>
        <h2 className="font-semibold flex items-center gap-1.5">
          {icon}
          <span className={accent ? 'text-accent-neon' : ''}>{title}</span>
        </h2>
        {subtitle && <p className="text-xs text-text-muted">{subtitle}</p>}
      </div>
      {viewAll && (
        <Link to={viewAll} className="text-xs text-accent-blue hover:underline flex items-center gap-0.5">
          Ver todos <ChevronRight className="w-3 h-3" />
        </Link>
      )}
    </div>
    {items.length === 0 ? (
      <div className="card text-center text-sm text-text-muted py-8">{emptyText}</div>
    ) : (
      <div className="space-y-3">
        {items.map((ed) => (
          <TournamentCard key={ed.id} edition={ed} showEligibility={accent} />
        ))}
      </div>
    )}
  </section>
);
