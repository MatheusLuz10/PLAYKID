import { calculateUserLevel, formatXp } from '../../logic/xp';
import type { Level, Profile } from '../../models';
import { ProgressBar } from '../ui/ProgressBar';

/**
 * Nível atual e progresso até o próximo. A barra mostra só a faixa do nível
 * atual (tabela levels do banco), sem porcentagem inventada.
 */
export function LevelProgress({ profile, levels }: { profile: Profile; levels: Level[] }) {
  const info = calculateUserLevel(profile.totalXp, levels);
  const { current, next } = info;

  return (
    <div className="level-progress">
      <div className="level-progress__head">
        <span className="level-progress__icon" aria-hidden>
          {current.icon}
        </span>
        <div>
          <span className="eyebrow">Nível {current.number}</span>
          <strong className="level-progress__title">{current.name}</strong>
        </div>
      </div>
      <p className="level-progress__xp">
        {/* key: o número "pulsa" quando o XP muda */}
        <strong key={info.totalXp} className="xp-bump">
          {formatXp(info.totalXp)}
        </strong>
        {next ? ` / ${formatXp(next.xpRequired)} XP` : ' XP'}
      </p>
      <ProgressBar
        value={next ? info.xpInLevel : 1}
        max={next ? info.xpForNext : 1}
        label={`Progresso do nível ${current.number}`}
        valueText={
          next
            ? `${formatXp(info.xpInLevel)} de ${formatXp(info.xpForNext)} XP dentro do nível ${current.number}`
            : 'Nível máximo alcançado'
        }
      />
      <p className="level-progress__next">
        {next ? (
          <>
            <strong>{formatXp(info.xpToNext)} XP</strong> para o nível {next.number} · {next.name}
          </>
        ) : (
          'Nível máximo alcançado!'
        )}
      </p>
    </div>
  );
}

/** XP separado por origem: conhecimento, ações, conquistas e (quando houver) bônus. */
export function XpBreakdown({ profile }: { profile: Profile }) {
  const parts = [
    { key: 'knowledge', icon: '🌱', label: 'Conhecimento', value: profile.knowledgeXp },
    { key: 'action', icon: '🌳', label: 'Ações', value: profile.actionXp },
    { key: 'achievement', icon: '🏆', label: 'Conquistas', value: profile.achievementXp },
    ...(profile.bonusXp > 0 ? [{ key: 'bonus', icon: '⭐', label: 'Bônus', value: profile.bonusXp }] : []),
  ];
  return (
    <dl className="xp-breakdown">
      <div className="xp-breakdown__total">
        <dt>XP total</dt>
        <dd>{formatXp(profile.totalXp)} XP</dd>
      </div>
      {parts.map((p) => (
        <div key={p.key}>
          <dt>
            <span aria-hidden>{p.icon}</span> {p.label}
          </dt>
          <dd>{formatXp(p.value)} XP</dd>
        </div>
      ))}
    </dl>
  );
}
