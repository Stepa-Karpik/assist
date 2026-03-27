import { useEffect, useMemo, useState } from "react";

type OwnerProfileState = NonNullable<
  Awaited<ReturnType<NonNullable<Window["karpik"]>["getOwnerProfileState"]>>
>;

type ProfilePageProps = {
  profile: OwnerProfileState | null;
  onSave: (payload: Partial<OwnerProfileState>) => Promise<OwnerProfileState>;
};

const emptyProfile: OwnerProfileState = {
  fullName: null,
  gender: null,
  age: null,
  city: null,
  timezone: null,
  language: null,
  contacts: null,
  occupation: null,
  bio: null,
  notes: null
};

function buildInitials(profile: OwnerProfileState | null): string {
  const fullName = profile?.fullName?.trim();

  if (!fullName) {
    return "K";
  }

  return fullName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function stringifyField(value: string | number | null): string | null {
  if (value === null) {
    return null;
  }

  return String(value);
}

export function ProfilePage({ profile, onSave }: ProfilePageProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<OwnerProfileState>(profile ?? emptyProfile);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setDraft(profile ?? emptyProfile);
  }, [profile]);

  const visibleFields = useMemo(
    () =>
      [
        ["Пол", profile?.gender ?? null],
        ["Возраст", profile?.age ?? null],
        ["Город", profile?.city ?? null],
        ["Часовой пояс", profile?.timezone ?? null],
        ["Язык", profile?.language ?? null],
        ["Контакты", profile?.contacts ?? null],
        ["Род деятельности", profile?.occupation ?? null],
        ["Биография", profile?.bio ?? null],
        ["Заметки", profile?.notes ?? null]
      ].filter(([, value]) => value !== null && String(value).trim().length > 0),
    [profile]
  );

  function updateField<Key extends keyof OwnerProfileState>(key: Key, value: OwnerProfileState[Key]) {
    setDraft((current) => ({
      ...current,
      [key]: value
    }));
  }

  async function handleSave() {
    setIsSaving(true);
    setError(null);

    try {
      const nextProfile = await onSave(draft);
      setDraft(nextProfile);
      setIsEditing(false);
    } catch {
      setError("Не удалось сохранить профиль.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="page-shell profile-shell">
      <div className="page-header profile-shell__header">
        <div>
          <p className="eyebrow">Профиль</p>
          <h2>Профиль владельца</h2>
          <p className="muted-text">
            Эти данные синхронизируются с control plane и используются как персональный контекст в Telegram и локальных DeepSeek-диалогах.
          </p>
        </div>
        {isEditing ? (
          <div className="profile-shell__actions">
            <button className="shell-secondary-button" onClick={() => setIsEditing(false)} type="button">
              Отмена
            </button>
            <button
              className="shell-primary-button"
              disabled={isSaving}
              onClick={() => void handleSave()}
              type="button"
            >
              {isSaving ? "Сохраняем..." : "Сохранить"}
            </button>
          </div>
        ) : (
          <button className="shell-primary-button" onClick={() => setIsEditing(true)} type="button">
            Редактировать
          </button>
        )}
      </div>

      {error ? <p className="task-error">{error}</p> : null}

      <div className="profile-layout">
        <article className="profile-card profile-card--hero">
          <div className="profile-avatar" aria-hidden="true">
            {buildInitials(profile)}
          </div>
          <div>
            <h3>{profile?.fullName ?? "Профиль владельца"}</h3>
            <p className="muted-text">
              {[profile?.occupation, profile?.city].filter(Boolean).join(" · ") ||
                "Заполни ключевые поля, чтобы ассистент лучше понимал контекст владельца устройства."}
            </p>
          </div>
        </article>

        {isEditing ? (
          <form className="profile-card profile-form" onSubmit={(event) => event.preventDefault()}>
            <label>
              <span>ФИО</span>
              <input value={draft.fullName ?? ""} onChange={(event) => updateField("fullName", event.target.value || null)} />
            </label>
            <label>
              <span>Пол</span>
              <input value={draft.gender ?? ""} onChange={(event) => updateField("gender", event.target.value || null)} />
            </label>
            <label>
              <span>Возраст</span>
              <input
                type="number"
                value={draft.age ?? ""}
                onChange={(event) =>
                  updateField("age", event.target.value.trim().length === 0 ? null : Number(event.target.value))
                }
              />
            </label>
            <label>
              <span>Город</span>
              <input value={draft.city ?? ""} onChange={(event) => updateField("city", event.target.value || null)} />
            </label>
            <label>
              <span>Часовой пояс</span>
              <input value={draft.timezone ?? ""} onChange={(event) => updateField("timezone", event.target.value || null)} />
            </label>
            <label>
              <span>Язык</span>
              <input value={draft.language ?? ""} onChange={(event) => updateField("language", event.target.value || null)} />
            </label>
            <label>
              <span>Контакты</span>
              <input value={draft.contacts ?? ""} onChange={(event) => updateField("contacts", event.target.value || null)} />
            </label>
            <label>
              <span>Род деятельности</span>
              <input value={draft.occupation ?? ""} onChange={(event) => updateField("occupation", event.target.value || null)} />
            </label>
            <label className="profile-form__wide">
              <span>Биография</span>
              <textarea value={draft.bio ?? ""} onChange={(event) => updateField("bio", event.target.value || null)} rows={3} />
            </label>
            <label className="profile-form__wide">
              <span>Заметки</span>
              <textarea value={draft.notes ?? ""} onChange={(event) => updateField("notes", event.target.value || null)} rows={3} />
            </label>
          </form>
        ) : (
          <article className="profile-card profile-details">
            {visibleFields.length === 0 ? (
              <p className="muted-text">
                Пока заполнен только базовый аватар. Нажми «Редактировать» и добавь данные владельца.
              </p>
            ) : (
              visibleFields.map(([label, value]) => (
                <div className="profile-details__row" key={label}>
                  <span>{label}</span>
                  <strong>{stringifyField(value)}</strong>
                </div>
              ))
            )}
          </article>
        )}
      </div>
    </section>
  );
}
