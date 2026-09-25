import { Link } from 'react-router-dom';
import { PublicLayout } from '../../components/layout/PublicLayout';

export function NotFoundPage() {
  return (
    <PublicLayout title="Página não encontrada">
      <div className="card stack center">
        <span className="big-icon" aria-hidden>
          🍂
        </span>
        <h1 className="section-title">Página não encontrada</h1>
        <p className="muted">O endereço pode ter mudado ou não existe mais.</p>
        <Link to="/inicio" className="btn btn--primary">
          Ir para o início
        </Link>
      </div>
    </PublicLayout>
  );
}
