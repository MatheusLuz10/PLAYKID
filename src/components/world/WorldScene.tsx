import { useId, type JSX } from 'react';
import type { WorldItemKind } from '../../models';

interface PlacedItem {
  id: string;
  kind: WorldItemKind;
  x: number;
  y: number;
  scale?: number;
}

/** Espaço da primeira árvore (ilustração da tela de boas-vindas). */
const DEFAULT_LOCKED_SLOTS = [{ x: 200, y: 196 }];

interface WorldSceneProps {
  /** Itens desbloqueados pelo jogador (vindos de user_world_items). */
  placed?: PlacedItem[];
  /** Espaços vazios reservados para itens ainda bloqueados. */
  lockedSlots?: { x: number; y: number }[];
  /** Itens que acabaram de surgir — recebem a animação de crescimento. */
  highlightIds?: string[];
  className?: string;
}

/**
 * Ilustração do mundo usada na tela de boas-vindas. O mundo do jogador
 * (áreas e itens conquistados) é desenhado por WorldMap.
 */

/** Vegetação inicial do cenário (decoração, não depende do banco). */
const DECOR: PlacedItem[] = [
  { id: 'grama-1', kind: 'grass', x: 60, y: 200 },
  { id: 'grama-2', kind: 'grass', x: 300, y: 196 },
  { id: 'grama-3', kind: 'grass', x: 350, y: 212, scale: 0.8 },
  { id: 'broto-1', kind: 'sprout', x: 100, y: 208 },
  { id: 'arbusto-1', kind: 'bush', x: 330, y: 204, scale: 0.9 },
];

function Grass() {
  return (
    <path
      d="M-7 0 Q-6 -9 -10 -13 M-2 0 Q-2 -11 0 -16 M3 0 Q4 -9 8 -12 M7 0 Q9 -6 12 -8"
      stroke="var(--world-grass-dark)"
      strokeWidth="2"
      strokeLinecap="round"
      fill="none"
    />
  );
}

function Sprout() {
  return (
    <g>
      <path d="M0 0 V-13" stroke="var(--world-grass-dark)" strokeWidth="2" strokeLinecap="round" />
      <ellipse cx="-5" cy="-13" rx="6" ry="3.2" transform="rotate(-25 -5 -13)" fill="var(--world-leaf-light)" />
      <ellipse cx="5" cy="-16" rx="6" ry="3.2" transform="rotate(25 5 -16)" fill="var(--world-leaf)" />
    </g>
  );
}

function Bush() {
  return (
    <g>
      <ellipse cx="0" cy="1" rx="22" ry="4" fill="var(--world-shadow)" />
      <circle cx="-11" cy="-8" r="10" fill="var(--world-leaf-dark)" />
      <circle cx="10" cy="-8" r="10" fill="var(--world-leaf-dark)" />
      <circle cx="0" cy="-14" r="12" fill="var(--world-leaf)" />
    </g>
  );
}

function Tree() {
  return (
    <g>
      <ellipse cx="0" cy="2" rx="34" ry="6" fill="var(--world-shadow)" />
      <path d="M-5 0 L-4 -48 H4 L5 0 Z" fill="var(--world-trunk)" />
      <path d="M0 -34 L-12 -46 M1 -40 L11 -50" stroke="var(--world-trunk)" strokeWidth="3" strokeLinecap="round" />
      <circle cx="-20" cy="-58" r="20" fill="var(--world-leaf-dark)" />
      <circle cx="20" cy="-58" r="20" fill="var(--world-leaf-dark)" />
      <circle cx="0" cy="-70" r="27" fill="var(--world-leaf)" />
      <circle cx="-9" cy="-82" r="14" fill="var(--world-leaf-light)" />
      <circle cx="14" cy="-66" r="3" fill="var(--world-fruit)" />
      <circle cx="-14" cy="-60" r="3" fill="var(--world-fruit)" />
    </g>
  );
}


function Flower() {
  return (
    <g>
      <ellipse cx="0" cy="1" rx="10" ry="2.5" fill="var(--world-shadow)" />
      <path d="M0 0 V-22" stroke="var(--world-grass-dark)" strokeWidth="2.5" strokeLinecap="round" />
      <ellipse cx="-6" cy="-9" rx="6" ry="3" transform="rotate(-30 -6 -9)" fill="var(--world-leaf)" />
      <g fill="#f29bb5">
        <circle cx="0" cy="-30" r="5" />
        <circle cx="-6" cy="-24" r="5" />
        <circle cx="6" cy="-24" r="5" />
        <circle cx="-4" cy="-18" r="4.5" />
        <circle cx="4" cy="-18" r="4.5" />
      </g>
      <circle cx="0" cy="-23" r="4" fill="var(--world-fruit)" />
    </g>
  );
}

function Garden() {
  return (
    <g>
      <rect x="-30" y="-8" width="60" height="12" rx="3" fill="var(--world-soil)" stroke="var(--world-soil-dark)" strokeWidth="1.5" />
      {[-20, -7, 6, 19].map((x) => (
        <g key={x} transform={`translate(${x} -8)`}>
          <ellipse cx="-3" cy="-5" rx="4" ry="2.5" transform="rotate(-30 -3 -5)" fill="var(--world-leaf-light)" />
          <ellipse cx="3" cy="-6" rx="4" ry="2.5" transform="rotate(30 3 -6)" fill="var(--world-leaf)" />
        </g>
      ))}
    </g>
  );
}

function Pollinator() {
  return (
    <g>
      {[
        [-10, '#f2bf4e'],
        [0, '#b58cf2'],
        [10, '#f29bb5'],
      ].map(([x, color]) => (
        <g key={x as number} transform={`translate(${x} 0)`}>
          <path d="M0 0 V-14" stroke="var(--world-grass-dark)" strokeWidth="2" strokeLinecap="round" />
          <circle cx="0" cy="-17" r="4.5" fill={color as string} />
          <circle cx="0" cy="-17" r="1.8" fill="#fffdf6" />
        </g>
      ))}
      <g transform="translate(8 -32)">
        <ellipse rx="5" ry="3.5" fill="#f2bf4e" />
        <path d="M-1.5 -3.5 V3.5 M1.5 -3.5 V3.5" stroke="#1e2b22" strokeWidth="1.3" />
        <ellipse cx="-1" cy="-5" rx="3" ry="2" fill="#fff" opacity="0.85" />
      </g>
    </g>
  );
}

const shapes: Record<WorldItemKind, () => JSX.Element> = {
  grass: Grass,
  sprout: Sprout,
  bush: Bush,
  tree: Tree,
  flower: Flower,
  garden: Garden,
  pollinator: Pollinator,
};

/** Marca de um espaço ainda vazio que pode receber um item desbloqueável. */
function LockedPlot() {
  return (
    <g>
      <ellipse cx="0" cy="0" rx="26" ry="7" fill="var(--world-plot)" stroke="var(--world-trunk)" strokeWidth="1.5" strokeDasharray="4 4" />
      <circle cx="0" cy="-24" r="12" fill="#fffdf6" stroke="var(--world-trunk)" strokeWidth="1.2" />
      <text x="0" y="-20" textAnchor="middle" fontSize="12">
        🔒
      </text>
    </g>
  );
}

function renderPlaced(item: PlacedItem, highlight: boolean) {
  const Shape = shapes[item.kind];
  return (
    <g key={item.id} transform={`translate(${item.x} ${item.y}) scale(${item.scale ?? 1})`}>
      <g className={highlight ? 'world-grow' : undefined}>
        <Shape />
      </g>
    </g>
  );
}

export function WorldScene({
  placed = [],
  lockedSlots = DEFAULT_LOCKED_SLOTS,
  highlightIds = [],
  className,
}: WorldSceneProps) {
  // Ids do useId podem conter caracteres inválidos para url(#...).
  const skyId = `world-sky-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const trees = placed.filter((p) => p.kind === 'tree').length;
  const others = placed.length - trees;
  const label =
    placed.length > 0
      ? `Seu mundo ecológico com ${trees} ${trees === 1 ? 'árvore' : 'árvores'} e ${others} ${others === 1 ? 'outro elemento' : 'outros elementos'} conquistados.`
      : 'Seu mundo ecológico: um terreno com poucas plantas e um espaço vazio esperando uma árvore.';

  // Itens mais ao fundo (menor y) são desenhados primeiro.
  const items = [...DECOR, ...placed].sort((a, b) => a.y - b.y);
  return (
    <svg className={`world-scene ${className ?? ''}`} viewBox="0 0 400 260" role="img" aria-label={label}>
      <defs>
        <linearGradient id={skyId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--world-sky-top)" />
          <stop offset="100%" stopColor="var(--world-sky-bottom)" />
        </linearGradient>
      </defs>

      <rect width="400" height="260" fill={`url(#${skyId})`} />
      <circle cx="336" cy="52" r="22" fill="var(--world-sun)" />
      <circle cx="336" cy="52" r="32" fill="var(--world-sun)" opacity="0.18" />

      <g fill="#ffffff" opacity="0.9">
        <ellipse cx="86" cy="56" rx="26" ry="10" />
        <ellipse cx="104" cy="48" rx="18" ry="11" />
        <ellipse cx="70" cy="50" rx="14" ry="8" />
      </g>

      <path d="M0 168 Q 90 118 190 156 T 400 142 V260 H0 Z" fill="var(--world-hill)" />
      <path d="M0 192 Q 190 160 400 186 V260 H0 Z" fill="var(--world-ground)" />
      <path d="M0 232 Q 200 220 400 232 V260 H0 Z" fill="var(--world-soil)" />
      <g fill="var(--world-soil-dark)" opacity="0.5">
        <circle cx="40" cy="246" r="2" />
        <circle cx="130" cy="242" r="1.6" />
        <circle cx="210" cy="250" r="2.2" />
        <circle cx="290" cy="244" r="1.8" />
        <circle cx="365" cy="250" r="2" />
      </g>

      {lockedSlots.map((slot) => (
        <g key={`slot-${slot.x}-${slot.y}`} transform={`translate(${slot.x} ${slot.y})`}>
          <LockedPlot />
        </g>
      ))}
      {items.map((item) => renderPlaced(item, highlightIds.includes(item.id)))}
    </svg>
  );
}
