import { useEffect, useState } from 'react';
import type { Evidence } from '../../models';
import { useGame } from '../../state/GameContext';
import { safeImageSrc } from '../../logic/safeUrl';

/**
 * Mostra a foto privada de uma evidência. A URL assinada só é pedida
 * quando este componente aparece (nunca carregamos todas as fotos de uma vez).
 */
export function EvidencePhoto({ evidence }: { evidence: Evidence }) {
  const { actions } = useGame();
  const path = evidence.thumbnailPath ?? evidence.filePath;
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!path) return;
    let active = true;
    actions.getEvidenceImageUrl(path).then((u) => active && setUrl(u));
    return () => {
      active = false;
    };
  }, [path, actions]);

  if (!url) return null;
  return <img src={safeImageSrc(url)} alt="Foto enviada como evidência" className="evidence-photo" loading="lazy" />;
}
