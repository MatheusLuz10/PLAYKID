import { useEffect, useId, useState, type FormEvent } from 'react';
import { todayDateInput } from '../../logic/dates';
import { toAppError, type EvidenceInput } from '../../services';
import { ACCEPTED_IMAGE_TYPES, validateEvidenceFile } from '../../services/imageService';
import { safeImageSrc } from '../../logic/safeUrl';

const NOTE_MAX = 500;

interface EvidenceFormProps {
  title: string;
  mode: 'demo' | 'supabase';
  /** photo: foto obrigatória (observação opcional) · text: observação obrigatória. */
  kind?: 'photo' | 'text';
  /** Pede a data informada pelo usuário (a data do registro é sempre a do servidor). */
  askDate?: boolean;
  dateLabel?: string;
  photoHint?: string;
  noteLabel?: string;
  notePlaceholder?: string;
  submitLabel?: string;
  /** Data mínima permitida (YYYY-MM-DD) — ex.: dia em que a missão foi aceita. */
  minDate?: string;
  onSubmit: (input: EvidenceInput) => Promise<boolean>;
  onCancel: () => void;
}

export function EvidenceForm({
  title,
  mode,
  kind = 'photo',
  askDate = kind === 'photo',
  dateLabel = 'Data da ação',
  photoHint = 'Uma foto que mostre a ação realizada',
  noteLabel,
  notePlaceholder = 'Conte com suas palavras o que você fez.',
  submitLabel = 'Enviar registro',
  minDate,
  onSubmit,
  onCancel,
}: EvidenceFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [date, setDate] = useState(todayDateInput());
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const noteId = useId();
  const needsPhoto = kind === 'photo';
  const needsNote = kind === 'text';

  // Libera a URL temporária da pré-visualização quando a imagem muda ou a tela fecha.
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Validação imediata (tipo e tamanho) — nada é enviado antes do "Enviar registro".
  const pick = (picked: File | null | undefined) => {
    if (!picked) return;
    try {
      validateEvidenceFile(picked);
      setFile(picked);
      setFileError(null);
    } catch (err) {
      setFile(null);
      setFileError(toAppError(err).message);
    }
  };

  const noteOk = !needsNote || note.trim().length >= 3;
  const canSubmit = !sending && (!needsPhoto || Boolean(file)) && noteOk && (!askDate || Boolean(date));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSending(true);
    const ok = await onSubmit({ file, description: note, capturedAt: askDate ? date : null });
    // Em caso de sucesso a tela muda; em caso de erro o jogador pode tentar de novo.
    if (!ok) setSending(false);
  };

  return (
    <form className="card stack stack--sm evidence-form" onSubmit={submit}>
      <h3 className="section-title">
        {needsPhoto ? '📷' : '📝'} {title}
      </h3>

      {needsPhoto && (
        <>
          {mode === 'demo' ? (
            <div className="banner banner--info">
              <span className="banner__icon" aria-hidden>
                🧪
              </span>
              <p>
                <strong>Modo demonstração.</strong> A imagem não é enviada nem armazenada — ela aparece só aqui.
                Configure o Supabase para guardar as fotos de verdade.
              </p>
            </div>
          ) : (
            <div className="banner banner--info">
              <span className="banner__icon" aria-hidden>
                🔒
              </span>
              <p>
                Sua foto fica guardada em um espaço privado: só você pode vê-la. Antes do envio ela é reduzida e os
                dados de localização são removidos.
              </p>
            </div>
          )}

          {previewUrl ? (
            <div className="evidence-preview-wrap">
              <img src={safeImageSrc(previewUrl)} alt="Pré-visualização da foto escolhida" className="dropzone__preview evidence-preview" />
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setFile(null)} disabled={sending}>
                🗑️ Remover foto
              </button>
            </div>
          ) : (
            <div className="dropzone dropzone--static">
              <span className="dropzone__empty">
                <span className="big-icon big-icon--sm" aria-hidden>
                  🖼️
                </span>
                <strong>Adicione uma foto</strong>
                <span className="muted small">{photoHint}</span>
              </span>
            </div>
          )}

          {/* Duas formas de enviar: câmera na hora (celular) ou arquivo já existente. */}
          <div className="photo-actions">
            <label className="btn btn--primary photo-actions__btn">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={(e) => {
                  pick(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
              <span aria-hidden>📷</span> {file ? 'Tirar outra foto' : 'Tirar foto agora'}
            </label>
            <label className="btn btn--ghost photo-actions__btn">
              <input
                type="file"
                accept={ACCEPTED_IMAGE_TYPES.join(',')}
                className="sr-only"
                onChange={(e) => {
                  pick(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
              <span aria-hidden>🖼️</span> {file ? 'Trocar por outra imagem' : 'Anexar da galeria'}
            </label>
          </div>
          {fileError ? (
            <p className="banner banner--error" role="alert">
              {fileError}
            </p>
          ) : (
            <p className="muted small">
              {file ? `Foto selecionada: ${file.name}` : 'JPG, PNG ou WEBP, até 10 MB. No celular, “Tirar foto agora” abre a câmera.'}
            </p>
          )}
        </>
      )}

      {askDate && (
        <label className="field">
          <span className="field__label">{dateLabel}</span>
          <input
            type="date"
            className="input"
            value={date}
            max={todayDateInput()}
            min={minDate}
            required
            onChange={(e) => setDate(e.target.value)}
          />
          <span className="muted small">A data e a hora do registro são salvas automaticamente pelo servidor.</span>
        </label>
      )}

      <div className="field">
        <label className="field__label" htmlFor={noteId}>
          {noteLabel ?? (needsNote ? 'Observação (obrigatória)' : 'Observação (opcional)')}
        </label>
        <textarea
          id={noteId}
          className="input"
          rows={3}
          maxLength={NOTE_MAX}
          placeholder={notePlaceholder}
          value={note}
          required={needsNote}
          onChange={(e) => setNote(e.target.value)}
        />
        <span className="muted small note-counter" aria-live="polite">
          {note.length}/{NOTE_MAX}
        </span>
      </div>

      <div className="actions">
        <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={sending}>
          Cancelar
        </button>
        <button type="submit" className="btn btn--primary" disabled={!canSubmit}>
          {sending ? 'Enviando…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
