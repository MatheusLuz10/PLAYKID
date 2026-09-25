import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div className="offline-banner" role="alert">
      <span aria-hidden>📡</span> Você está sem conexão. Enquanto isso, seu progresso não pode ser salvo — continue
      quando a internet voltar.
    </div>
  );
}
