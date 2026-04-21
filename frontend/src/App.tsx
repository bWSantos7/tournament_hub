import React from 'react';
import { Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { ProtectedRoute, PublicOnlyRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { HomePage } from './pages/HomePage';
import { TournamentsPage } from './pages/TournamentsPage';
import { TournamentDetailPage } from './pages/TournamentDetailPage';
import { WatchlistPage } from './pages/WatchlistPage';
import { AlertsPage } from './pages/AlertsPage';
import { ProfilePage } from './pages/ProfilePage';
import { AdminPanelPage } from './pages/AdminPanelPage';

const App: React.FC = () => {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <LoginPage />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicOnlyRoute>
            <RegisterPage />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute>
            <OnboardingPage />
          </ProtectedRoute>
        }
      />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<HomePage />} />
        <Route path="torneios" element={<TournamentsPage />} />
        <Route path="torneios/:id" element={<TournamentDetailPage />} />
        <Route path="watchlist" element={<WatchlistPage />} />
        <Route path="alertas" element={<AlertsPage />} />
        <Route path="perfil" element={<ProfilePage />} />
        <Route
          path="admin-panel"
          element={
            <ProtectedRoute admin>
              <AdminPanelPage />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route
        path="*"
        element={
          <div className="min-h-screen bg-bg-base flex items-center justify-center text-center px-4">
            <div>
              <h1 className="text-4xl font-bold text-accent-neon mb-2">404</h1>
              <p className="text-text-secondary">Página não encontrada.</p>
              <a href="/" className="text-accent-blue hover:underline text-sm mt-2 inline-block">
                Voltar ao início
              </a>
            </div>
          </div>
        }
      />
    </Routes>
  );
};

export default App;
