import { useState, type FormEvent } from 'react';
import { AVATAR_NAMES, AVATARS } from '../../data/avatars';
import type { Profile } from '../../models';
import { toAppError, type ProfileInput } from '../../services';
import { prepareEvidenceImage } from '../../services/imageService';
import { safeImageSrc } from '../../logic/safeUrl';

interface ProfileFormProps {
  profile: Profile;
  submitLabel: string;
  onSubmit: (input: ProfileInput) => Promise<void>;
}

/** Sugestão de nome de usuário a partir do nome exibido. */
function suggestUsername(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24);
}

export function ProfileForm({ profile, submitLabel, onSubmit }: ProfileFormProps) {
  const [displayName, setDisplayName] = useState(profile.displayName ?? '');
  const [username, setUsername] = useState(profile.username ?? '');
  const [usernameTouched, setUsernameTouched] = useState(Boolean(profile.username));
  const [avatar, setAvatar] = useState(profile.avatar);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const usernameValid = /^[a-z0-9_]{3,24}$/.test(username);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!displayName.trim() || !usernameValid) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ displayName: displayName.trim(), username, avatar, avatarUrl });
      setSaved(true);
    } catch (err) {
      setError(toAppError(err).message);
    } finally {
      setBusy(false);
    }
  };

  const changed = () => setSaved(false);

  const choosePhoto = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      const { thumbnail } = await prepareEvidenceImage(file);
      const reader = new FileReader();
      reader.onload = () => {
        setAvatarUrl(String(reader.result));
        changed();
      };
      reader.onerror = () => setError('Não foi possível ler essa foto.');
      reader.readAsDataURL(thumbnail);
    } catch (err) {
      setError(toAppError(err).message);
    }
  };

  return (
    <form className="card stack stack--sm" onSubmit={submit}>
      <div className="profile-hero">
        <span className="avatar avatar--xl" aria-hidden>
          {safeImageSrc(avatarUrl) ? <img className="avatar__image" src={safeImageSrc(avatarUrl)} alt="" /> : avatar}
        </span>
      </div>

      {error && <div className="banner banner--error" role="alert">{error}</div>}

      <label className="field">
        <span className="field__label">Nome</span>
        <input
          className="input"
          value={displayName}
          maxLength={40}
          required
          onChange={(e) => {
            setDisplayName(e.target.value);
            if (!usernameTouched) setUsername(suggestUsername(e.target.value));
            changed();
          }}
        />
      </label>

      <label className="field">
        <span className="field__label">Nome de usuário</span>
        <input
          className="input"
          value={username}
          maxLength={24}
          required
          autoCapitalize="none"
          spellCheck={false}
          aria-invalid={username.length > 0 && !usernameValid}
          onChange={(e) => {
            setUsername(e.target.value.toLowerCase());
            setUsernameTouched(true);
            changed();
          }}
        />
        <span className={`small ${username && !usernameValid ? 'text-danger' : 'muted'}`}>
          3 a 24 caracteres: letras minúsculas, números ou _
        </span>
      </label>

      <fieldset className="field">
        <legend className="field__label">Avatar</legend>
        <div className="avatar-picker">
          {AVATARS.map((a) => (
            <label key={a} className={`avatar-option ${a === avatar && !avatarUrl ? 'is-selected' : ''}`}>
              <input
                type="radio"
                name="avatar"
                value={a}
                aria-label={`Avatar ${AVATAR_NAMES[a] ?? a}`}
                checked={a === avatar && !avatarUrl}
                onChange={() => {
                  setAvatar(a);
                  setAvatarUrl(null);
                  changed();
                }}
              />
              <span aria-hidden>{a}</span>
            </label>
          ))}
        </div>
        <label className="photo-picker">
          <span className="btn btn--ghost">📷 Escolher uma foto</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => {
              void choosePhoto(e.target.files?.[0]);
              e.currentTarget.value = '';
            }}
          />
        </label>
        {avatarUrl && (
          <button type="button" className="btn btn--ghost" onClick={() => { setAvatarUrl(null); changed(); }}>
            Usar figurinha
          </button>
        )}
      </fieldset>

      <button type="submit" className="btn btn--primary" disabled={busy || !displayName.trim() || !usernameValid}>
        {busy ? 'Salvando…' : saved ? '✓ Salvo' : submitLabel}
      </button>
    </form>
  );
}
