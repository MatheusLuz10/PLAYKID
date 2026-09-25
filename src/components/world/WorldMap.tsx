import type { JSX } from 'react';
import { buildAreas } from '../../logic/world';
import type { ContentCatalog, PlayerState, WorldItem } from '../../models';

interface WorldMapProps {
  content: ContentCatalog;
  player: PlayerState;
  /** Itens que acabaram de surgir (animação de crescimento). */
  highlightIds?: string[];
  onSelect: (item: WorldItem) => void;
}

/** Fundos leves em SVG, um por área (sem imagens pesadas). */
const backgrounds: Record<string, () => JSX.Element> = {
  natural: () => (
    <>
      <path d="M0 78 Q 70 52 150 70 T 300 62 V150 H0 Z" fill="var(--world-hill)" />
      <path d="M0 96 Q 150 80 300 94 V150 H0 Z" fill="var(--world-ground)" />
    </>
  ),
  water: () => (
    <>
      <path d="M0 84 Q 150 70 300 84 V150 H0 Z" fill="var(--world-ground)" />
      <ellipse cx="150" cy="118" rx="118" ry="24" fill="var(--world-water-dark)" />
      <ellipse cx="150" cy="116" rx="108" ry="19" fill="var(--world-water)" />
      <g className="world-shimmer" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" opacity="0.7">
        <path d="M92 112 h18" />
        <path d="M160 120 h24" />
        <path d="M204 110 h14" />
      </g>
    </>
  ),
  garden: () => (
    <>
      <path d="M0 80 Q 150 70 300 80 V150 H0 Z" fill="var(--world-ground)" />
      {[96, 118, 140].map((y) => (
        <rect key={y} x="18" y={y - 8} width="264" height="12" rx="6" fill="var(--world-soil)" opacity="0.85" />
      ))}
    </>
  ),
  pollinators: () => (
    <>
      <path d="M0 82 Q 150 66 300 82 V150 H0 Z" fill="var(--world-meadow)" />
      <g opacity="0.55">
        {[
          [30, 110, '#f29bb5'],
          [80, 132, '#f2bf4e'],
          [130, 104, '#b58cf2'],
          [190, 128, '#f29bb5'],
          [240, 108, '#f2bf4e'],
          [270, 136, '#b58cf2'],
        ].map(([x, y, c]) => (
          <circle key={`${x}-${y}`} cx={x as number} cy={y as number} r="3" fill={c as string} />
        ))}
      </g>
    </>
  ),
  community: () => (
    <>
      <path d="M0 80 Q 150 70 300 80 V150 H0 Z" fill="var(--world-ground)" />
      <ellipse cx="150" cy="124" rx="96" ry="18" fill="var(--world-stone)" />
      <path d="M150 150 L140 106 H160 Z" fill="var(--world-stone)" opacity="0.8" />
    </>
  ),
};

/** 🌎 Mapa do mundo: áreas com os itens conquistados e os espaços ainda bloqueados. */
export function WorldMap({ content, player, highlightIds = [], onSelect }: WorldMapProps) {
  const areas = buildAreas(content, player);
  return (
    <div className="world-map">
      {areas.map(({ area, items, owned, unlocked }) => {
        const Background = backgrounds[area.code] ?? backgrounds.natural;
        const headingId = `world-area-${area.code}`;
        return (
          <section key={area.code} className={`world-area world-area--${area.code}`} aria-labelledby={headingId}>
            <header className="world-area__head">
              <h3 id={headingId} className="world-area__title">
                <span aria-hidden>{area.icon}</span> {area.name}
              </h3>
              <span className="world-area__count">
                {unlocked}/{items.length} <span className="sr-only">itens conquistados</span>
              </span>
            </header>
            <div className="world-area__scene">
              <svg className="world-area__bg" viewBox="0 0 300 150" preserveAspectRatio="xMidYMax slice" aria-hidden focusable="false">
                <rect width="300" height="150" fill="url(#world-sky)" />
                <Background />
              </svg>
              {items.map((item) => {
                const mine = owned.get(item.id);
                const x = mine?.x ?? item.slot?.x ?? 50;
                const y = mine?.y ?? item.slot?.y ?? 80;
                const style = { left: `${x}%`, top: `${y}%` };
                if (!mine) {
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className="world-slot"
                      style={style}
                      onClick={() => onSelect(item)}
                      aria-label={`Espaço bloqueado: ${item.name}. Ver como desbloquear`}
                    >
                      <span aria-hidden>🔒</span>
                    </button>
                  );
                }
                const cls = [
                  'world-item',
                  `world-item--${item.itemType}`,
                  item.milestone ? 'is-milestone' : '',
                  highlightIds.includes(item.id) ? 'is-new' : '',
                ]
                  .filter(Boolean)
                  .join(' ');
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={cls}
                    style={style}
                    onClick={() => onSelect(item)}
                    aria-label={`${item.name}${item.milestone ? ' (marco especial)' : ''}. Ver detalhes`}
                  >
                    <span className="world-item__icon" aria-hidden>
                      {item.icon}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
      {/* Gradiente do céu compartilhado pelas áreas */}
      <svg width="0" height="0" aria-hidden focusable="false" className="world-defs">
        <defs>
          <linearGradient id="world-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--world-sky-top)" />
            <stop offset="100%" stopColor="var(--world-sky-bottom)" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
