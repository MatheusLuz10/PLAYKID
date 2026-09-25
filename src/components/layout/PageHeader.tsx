import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  backTo?: string;
  backLabel?: string;
}

export function PageHeader({ title, subtitle, backTo, backLabel = 'Voltar' }: PageHeaderProps) {
  // Título da aba do navegador (sem emojis), útil para leitores de tela e histórico.
  useEffect(() => {
    const clean = title.replace(/[^\p{L}\p{N}\s·:,.!?-]/gu, '').trim();
    document.title = clean ? `${clean} · ECO QUEST` : 'ECO QUEST';
  }, [title]);
  return (
    <header className="page-header">
      {backTo && (
        <Link to={backTo} className="back-link">
          ← {backLabel}
        </Link>
      )}
      <h1 className="page-title">{title}</h1>
      {subtitle && <p className="page-subtitle">{subtitle}</p>}
    </header>
  );
}
