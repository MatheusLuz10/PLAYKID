import { formatDate } from '../../logic/dates';
import { itemSourceLabel, unlockHint } from '../../logic/world';
import type { ContentCatalog, PlayerWorldItem, WorldItem } from '../../models';
import { Modal } from '../ui/Modal';

interface WorldItemDialogProps {
  content: ContentCatalog;
  item: WorldItem;
  owned: PlayerWorldItem | undefined;
  onClose: () => void;
}

/** Informação educativa do item: quando e por qual ação real ele surgiu. */
export function WorldItemDialog({ content, item, owned, onClose }: WorldItemDialogProps) {
  const area = content.worldAreas.find((a) => a.code === item.area);
  const category = content.categories.find((c) => c.id === item.categoryId);
  return (
    <Modal
      titleId="world-item-title"
      onClose={onClose}
      title={
        <>
          <span className={`world-dialog__icon ${owned ? '' : 'is-locked'}`} aria-hidden>
            {item.icon}
          </span>
          <span className="block">{item.name}</span>
        </>
      }
    >
      <div className="world-dialog">
        <p className="world-dialog__tags">
          {area && (
            <span className="tag">
              <span aria-hidden>{area.icon}</span> {area.name}
            </span>
          )}
          {category && (
            <span className="tag">
              <span aria-hidden>{category.icon}</span> {category.name}
            </span>
          )}
          {item.milestone && <span className="tag tag--xp">⭐ Marco especial</span>}
        </p>
        {owned ? (
          <dl className="world-dialog__facts">
            <div>
              <dt>Desbloqueado em</dt>
              <dd>{formatDate(owned.unlockedAt)}</dd>
            </div>
            <div>
              <dt>Conquistado através de</dt>
              <dd>{itemSourceLabel(content, owned)}</dd>
            </div>
            {item.meaning && (
              <div>
                <dt>O que representa</dt>
                <dd>{item.meaning}</dd>
              </div>
            )}
          </dl>
        ) : (
          <dl className="world-dialog__facts">
            <div>
              <dt>🔒 Ainda bloqueado</dt>
              <dd>{item.description}</dd>
            </div>
            <div>
              <dt>Como desbloquear</dt>
              <dd>{unlockHint(content, item)}</dd>
            </div>
          </dl>
        )}
      </div>
    </Modal>
  );
}
