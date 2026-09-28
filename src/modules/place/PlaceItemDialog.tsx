import { Modal } from '../../components/ui/Modal';
import { formatDate } from '../../logic/dates';
import type { ContentCatalog } from '../../models';
import { PLACE_CATEGORY_LABELS, PLACE_LOCATION_LABELS, type PlaceItemDef } from './catalog';
import { unlockHint, unlockSourceText, type OwnedPlaceItem } from './placeLogic';

interface Props {
  def: PlaceItemDef;
  owned: OwnedPlaceItem | null;
  content: ContentCatalog;
  onClose: () => void;
}

/** Nome + descrição + origem do objeto (e o registro do jogador, quando houver). */
export function PlaceItemDialog({ def, owned, content, onClose }: Props) {
  const cat = PLACE_CATEGORY_LABELS[def.category];
  return (
    <Modal
      titleId="place-item-title"
      onClose={onClose}
      title={
        <>
          <span className={`place-dialog__icon ${owned ? '' : 'is-locked'}`} aria-hidden>
            {def.icon}
          </span>
          <span className="block">{def.name}</span>
        </>
      }
    >
      <div className="place-dialog">
        <p className="place-dialog__tags">
          <span className="tag">
            <span aria-hidden>{cat.icon}</span> {cat.label}
          </span>
          <span className="tag">{PLACE_LOCATION_LABELS[def.location] ?? def.location}</span>
        </p>
        <p>{def.description}</p>
        <dl className="place-dialog__facts">
          {owned ? (
            <>
              <div>
                <dt>Origem</dt>
                <dd>{unlockSourceText(def, content, owned)}</dd>
              </div>
              <div>
                <dt>Desbloqueado em</dt>
                <dd>{formatDate(owned.unlockedAt)}</dd>
              </div>
              <div>
                <dt>O que representa</dt>
                <dd>{def.meaning}</dd>
              </div>
              {owned.originNote && (
                <div className="place-dialog__note">
                  <dt>📝 Seu registro</dt>
                  <dd>“{owned.originNote}”</dd>
                </div>
              )}
            </>
          ) : (
            <>
              <div>
                <dt>🔒 Ainda não está na sua casa</dt>
                <dd>{unlockHint(def, content)}</dd>
              </div>
              <div>
                <dt>O que vai representar</dt>
                <dd>{def.meaning}</dd>
              </div>
            </>
          )}
        </dl>
      </div>
    </Modal>
  );
}
