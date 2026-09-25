import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

/** Links institucionais (Sobre, Termos, Privacidade). */
export function PublicFooter() {
  return (
    <footer className="public-footer">
      <nav aria-label="Informações">
        <Link to="/sobre">Sobre o ECO QUEST</Link>
        <Link to="/termos">Termos de uso</Link>
        <Link to="/privacidade">Privacidade</Link>
      </nav>
      <p className="muted small">ECO QUEST · Aprenda. Faça. Transforme.</p>
    </footer>
  );
}

/** Páginas públicas de texto (Sobre, Termos, Privacidade, recuperação de senha). */
export function PublicLayout({ title, children }: { title: string; children: ReactNode }) {
  useEffect(() => {
    document.title = `${title} · ECO QUEST`;
    window.scrollTo(0, 0);
  }, [title]);

  return (
    <div className="public-page">
      <header className="public-page__header">
        <Link to="/" className="logo logo--sm" aria-label="ECO QUEST — página inicial">
          <span className="logo__mark" aria-hidden>
            🌱
          </span>
          <span className="logo__text">
            ECO <span>QUEST</span>
          </span>
        </Link>
      </header>
      <main className="public-page__main" id="conteudo">
        {children}
      </main>
      <PublicFooter />
    </div>
  );
}
