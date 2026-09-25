import { useCallback, useState, type FormEvent } from 'react';
import { useGame } from '../../state/GameContext';
import { Modal } from '../ui/Modal';

const CONFIRM_WORD = 'EXCLUIR';

/** "Excluir minha conta": explica o que será apagado e pede confirmação digitada. */
export function DeleteAccount() {
  const { actions, mode } = useGame();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const close = useCallback(() => {
    if (busy) return;
    setOpen(false);
    setTyped('');
    setError(null);
  }, [busy]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (typed.trim().toUpperCase() !== CONFIRM_WORD) return;
    setBusy(true);
    setError(null);
    try {
      await actions.deleteAccount();
      // A sessão acabou (ou, na demonstração, os dados locais foram apagados).
      window.location.assign('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível excluir a conta.');
      setBusy(false);
    }
  };

  return (
    <section className="card danger-zone" aria-labelledby="delete-account-title">
      <h2 className="section-title" id="delete-account-title">
        Excluir minha conta
      </h2>
      <p className="muted small">
        {mode === 'demo'
          ? 'Na demonstração, isto apaga todo o progresso deste jogador guardado neste navegador. Os outros jogadores continuam como estão.'
          : 'Remove permanentemente a sua conta e tudo o que é seu no ECO QUEST.'}
      </p>
      <button type="button" className="btn btn--danger-ghost" onClick={() => setOpen(true)}>
        Excluir minha conta…
      </button>

      {open && (
        <Modal titleId="delete-account-dialog" title="Excluir sua conta?" onClose={close} closeLabel="Cancelar">
          <form className="stack stack--sm delete-account" onSubmit={submit}>
            <p>Esta ação não pode ser desfeita. Serão apagados permanentemente:</p>
            <ul className="delete-account__list">
              <li>seu perfil e seu login;</li>
              <li>progresso das aulas e tentativas de quiz;</li>
              <li>desafios, evidências e as fotos enviadas;</li>
              <li>XP, níveis e conquistas;</li>
              <li>o seu mundo virtual.</li>
            </ul>
            {error && (
              <div className="banner banner--error" role="alert">
                {error}
              </div>
            )}
            <label className="field">
              <span className="field__label">
                Para confirmar, digite <strong>{CONFIRM_WORD}</strong>
              </span>
              <input
                className="input"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                aria-describedby="delete-account-help"
              />
              <span id="delete-account-help" className="muted small">
                Depois disso você volta para a página inicial.
              </span>
            </label>
            <button
              type="submit"
              className="btn btn--danger btn--block"
              disabled={busy || typed.trim().toUpperCase() !== CONFIRM_WORD}
            >
              {busy ? 'Excluindo…' : 'Excluir definitivamente'}
            </button>
          </form>
        </Modal>
      )}
    </section>
  );
}
