import { NavLink, useLocation } from 'react-router-dom';
import { useGame } from '../../state/GameContext';

const NAV_ITEMS = [
  { to: '/inicio', icon: '🏠', label: 'Início' },
  { to: '/mundo', icon: '🌎', label: 'Meu Mundo' },
  { to: '/desafios', icon: '🎯', label: 'Desafios' },
  { to: '/aprender', icon: '📚', label: 'Aprender' },
  { to: '/conquistas', icon: '🏆', label: 'Conquistas' },
  { to: '/perfil', icon: '👤', label: 'Perfil' },
];

export function NavBar() {
  const { pathname } = useLocation();
  const { player } = useGame();
  // Admin aparece no menu lateral (no celular, o acesso fica no Perfil).
  // A casa (antigo "Meu Lugar") fica dentro do Meu Mundo.
  const items = [
    ...NAV_ITEMS,
    ...(player.profile.role === 'admin' ? [{ to: '/admin', icon: '🔐', label: 'Admin', desktopOnly: true }] : []),
  ];
  // As aulas (/aula/...) pertencem à área Aprender.
  const extraActive = (to: string) => to === '/aprender' && pathname.startsWith('/aula');
  return (
    <nav className="nav" aria-label="Menu principal">
      <div className="nav__brand">
        <span aria-hidden>🌱</span> ECO QUEST
      </div>
      <ul className="nav__list">
        {items.map((item) => (
          <li key={item.to} className={'desktopOnly' in item ? 'nav__item--desktop' : undefined}>
            <NavLink to={item.to} className={({ isActive }) => `nav__link${isActive || extraActive(item.to) ? ' is-active' : ''}`}>
              <span className="nav__icon" aria-hidden>
                {item.icon}
              </span>
              <span className="nav__label">{item.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
