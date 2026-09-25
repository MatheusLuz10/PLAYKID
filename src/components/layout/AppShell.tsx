import { Suspense, useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useGame } from '../../state/GameContext';
import { CelebrationDialog } from '../gamification/CelebrationDialog';
import { OfflineBanner } from '../ui/OfflineBanner';
import { LoadingMessage } from '../ui/StateMessage';
import { Toasts } from '../ui/Toasts';
import { NavBar } from './NavBar';

export function AppShell() {
  const { player } = useGame();
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  // CADASTRO → LOGIN → CRIAR PERFIL → DASHBOARD
  if (!player.profile.displayName) return <Navigate to="/criar-perfil" replace />;

  return (
    <div className="app-shell">
      <NavBar />
      <main className="app-main">
        <OfflineBanner />
        <Suspense fallback={<LoadingMessage />}>
          <Outlet />
        </Suspense>
      </main>
      <Toasts />
      <CelebrationDialog />
    </div>
  );
}
