import { useEffect, useMemo, useState } from "react";

type DeviceIdentityState = Awaited<
  ReturnType<NonNullable<Window["karpik"]>["getDeviceIdentity"]>
>;
type OwnerProfileState = Awaited<
  ReturnType<NonNullable<Window["karpik"]>["getOwnerProfileState"]>
>;
type AuthConfigState = Awaited<
  ReturnType<NonNullable<Window["karpik"]>["getAuthConfigState"]>
>;
type DeviceOnboardingStatus = Awaited<
  ReturnType<NonNullable<Window["karpik"]>["getOnboardingStatus"]>
>;
type PairingState = Awaited<
  ReturnType<NonNullable<Window["karpik"]>["openPairingSession"]>
>;
type TotpEnrollment = Awaited<
  ReturnType<NonNullable<Window["karpik"]>["createTotpEnrollment"]>
>;

type OnboardingPageProps = {
  initialStatus: DeviceOnboardingStatus;
  onCompleted: () => void;
};

const emptyIdentity: DeviceIdentityState = {
  deviceId: "",
  deviceLabel: "",
  createdAt: ""
};

const emptyProfile: NonNullable<OwnerProfileState> = {
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

const emptyAuthConfig: AuthConfigState = {
  passwordConfigured: false,
  totpConfigured: false
};

function formatStatusLabel(isDone: boolean): string {
  return isDone ? "Готово" : "Не настроено";
}

function parseAge(value: string): number | null {
  const normalized = value.trim();

  if (normalized.length === 0) {
    return null;
  }

  const nextAge = Number(normalized);
  return Number.isFinite(nextAge) && nextAge > 0 ? Math.trunc(nextAge) : null;
}

export function OnboardingPage({ initialStatus, onCompleted }: OnboardingPageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isCreatingTotp, setIsCreatingTotp] = useState(false);
  const [isConfirmingTotp, setIsConfirmingTotp] = useState(false);
  const [isOpeningTelegram, setIsOpeningTelegram] = useState(false);
  const [isOpeningPairing, setIsOpeningPairing] = useState(false);
  const [isRefreshingStatus, setIsRefreshingStatus] = useState(false);
  const [deviceIdentity, setDeviceIdentity] = useState<DeviceIdentityState>(emptyIdentity);
  const [deviceLabel, setDeviceLabel] = useState("");
  const [ownerProfile, setOwnerProfile] = useState<NonNullable<OwnerProfileState>>(emptyProfile);
  const [fullName, setFullName] = useState("");
  const [gender, setGender] = useState("");
  const [age, setAge] = useState("");
  const [city, setCity] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [authConfigState, setAuthConfigState] = useState<AuthConfigState>(emptyAuthConfig);
  const [pendingTotpEnrollment, setPendingTotpEnrollment] = useState<TotpEnrollment | null>(null);
  const [pairingState, setPairingState] = useState<PairingState | null>(null);
  const [onboardingStatus, setOnboardingStatus] = useState<DeviceOnboardingStatus>(initialStatus);
  const [startLink, setStartLink] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const progressItems = useMemo(
    () => [
      {
        id: "device",
        label: "Устройство зарегистрировано",
        ready: onboardingStatus.device_registered
      },
      {
        id: "telegram",
        label: "Telegram привязан",
        ready: onboardingStatus.trusted_telegram_user_count > 0
      },
      {
        id: "profile",
        label: "Профиль заполнен",
        ready: onboardingStatus.owner_profile_complete
      },
      {
        id: "password",
        label: "Пароль настроен",
        ready: onboardingStatus.password_configured
      },
      {
        id: "totp",
        label: "TOTP настроен",
        ready: onboardingStatus.totp_configured
      }
    ],
    [onboardingStatus]
  );

  async function refreshStatus() {
    if (!window.karpik?.getOnboardingStatus) {
      throw new Error("Onboarding status API недоступен в этом окружении.");
    }

    const nextStatus = await window.karpik.getOnboardingStatus();
    setOnboardingStatus(nextStatus);

    if (nextStatus.completed) {
      onCompleted();
    }

    return nextStatus;
  }

  useEffect(() => {
    let isSubscribed = true;

    async function loadState() {
      try {
        const [identity, profile, authConfig, status] = await Promise.all([
          window.karpik?.getDeviceIdentity?.() ?? Promise.resolve(emptyIdentity),
          window.karpik?.getOwnerProfileState?.() ?? Promise.resolve(emptyProfile),
          window.karpik?.getAuthConfigState?.() ?? Promise.resolve(emptyAuthConfig),
          window.karpik?.getOnboardingStatus?.() ?? Promise.resolve(initialStatus)
        ]);

        if (!isSubscribed) {
          return;
        }

        setDeviceIdentity(identity);
        setDeviceLabel(identity.deviceLabel);
        setOwnerProfile(profile ?? emptyProfile);
        setFullName(profile?.fullName ?? "");
        setGender(profile?.gender ?? "");
        setAge(profile?.age === null || profile?.age === undefined ? "" : String(profile.age));
        setCity(profile?.city ?? "");
        setAuthConfigState(authConfig);
        setOnboardingStatus(status);
      } catch {
        if (isSubscribed) {
          setError("Не удалось загрузить onboarding-состояние.");
        }
      } finally {
        if (isSubscribed) {
          setIsLoading(false);
        }
      }
    }

    void loadState();

    return () => {
      isSubscribed = false;
    };
  }, [initialStatus]);

  async function handleSaveProfile() {
    if (!window.karpik?.saveDeviceLabel || !window.karpik?.saveOwnerProfile || !window.karpik?.registerDevice) {
      setError("Onboarding API недоступен в этом окружении.");
      return;
    }

    setIsSavingProfile(true);
    setError(null);
    setFeedback(null);

    try {
      const nextIdentity = await window.karpik.saveDeviceLabel({
        deviceLabel
      });
      const nextProfile = await window.karpik.saveOwnerProfile({
        fullName,
        gender,
        age: parseAge(age),
        city
      });

      await window.karpik.registerDevice();
      setDeviceIdentity(nextIdentity);
      setOwnerProfile(nextProfile);
      await refreshStatus();
      setFeedback("Данные устройства сохранены.");
    } catch {
      setError("Не удалось сохранить данные устройства.");
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleSavePassword() {
    if (!window.karpik?.saveAuthConfig) {
      setError("Auth API недоступен в этом окружении.");
      return;
    }

    if (password.trim().length === 0) {
      setError("Введите пароль для локальной защиты.");
      return;
    }

    setIsSavingPassword(true);
    setError(null);
    setFeedback(null);

    try {
      const nextState = await window.karpik.saveAuthConfig({
        password
      });
      setAuthConfigState(nextState);
      setPassword("");
      await refreshStatus();
      setFeedback("Пароль сохранён.");
    } catch {
      setError("Не удалось сохранить пароль.");
    } finally {
      setIsSavingPassword(false);
    }
  }

  async function handleCreateTotpEnrollment() {
    if (!window.karpik?.createTotpEnrollment) {
      setError("TOTP API недоступен в этом окружении.");
      return;
    }

    setIsCreatingTotp(true);
    setError(null);
    setFeedback(null);

    try {
      const enrollment = await window.karpik.createTotpEnrollment();
      setPendingTotpEnrollment(enrollment);
      setTotpCode("");
      setFeedback("Отсканируйте QR и введите текущий код.");
    } catch {
      setError("Не удалось подготовить QR для TOTP.");
    } finally {
      setIsCreatingTotp(false);
    }
  }

  async function handleConfirmTotp() {
    if (!window.karpik?.confirmTotpEnrollment) {
      setError("TOTP API недоступен в этом окружении.");
      return;
    }

    if (pendingTotpEnrollment === null) {
      setError("Сначала создайте QR для TOTP.");
      return;
    }

    setIsConfirmingTotp(true);
    setError(null);
    setFeedback(null);

    try {
      const nextState = await window.karpik.confirmTotpEnrollment({
        code: totpCode
      });
      setAuthConfigState(nextState);
      setPendingTotpEnrollment(null);
      setTotpCode("");
      await refreshStatus();
      setFeedback("TOTP подтверждён.");
    } catch {
      setError("Не удалось подтвердить TOTP.");
    } finally {
      setIsConfirmingTotp(false);
    }
  }

  async function handleOpenTelegram() {
    if (!window.karpik?.createOnboardingToken) {
      setError("Onboarding token API недоступен в этом окружении.");
      return;
    }

    setIsOpeningTelegram(true);
    setError(null);
    setFeedback(null);

    try {
      const token = await window.karpik.createOnboardingToken();
      setStartLink(token.start_link);
      window.open(token.start_link, "_blank", "noopener,noreferrer");
      setFeedback("Ссылка Telegram открыта. Завершите привязку в боте.");
    } catch {
      setError("Не удалось создать Telegram-ссылку.");
    } finally {
      setIsOpeningTelegram(false);
    }
  }

  async function handleOpenPairingFallback() {
    if (!window.karpik?.openPairingSession) {
      setError("Pairing API недоступен в этом окружении.");
      return;
    }

    setIsOpeningPairing(true);
    setError(null);
    setFeedback(null);

    try {
      const nextState = await window.karpik.openPairingSession();
      setPairingState(nextState);
      setFeedback("Если deep link не открылся, используйте код pairing ниже.");
    } catch {
      setError("Не удалось открыть pairing-сессию.");
    } finally {
      setIsOpeningPairing(false);
    }
  }

  async function handleRefresh() {
    setIsRefreshingStatus(true);
    setError(null);

    try {
      await refreshStatus();
    } catch {
      setError("Не удалось обновить onboarding-статус.");
    } finally {
      setIsRefreshingStatus(false);
    }
  }

  if (isLoading) {
    return (
      <main className="onboarding-shell">
        <section className="onboarding-card">
          <h1>Подготовка Karpik</h1>
          <p className="muted-text">Загружаю состояние устройства…</p>
        </section>
      </main>
    );
  }

  return (
    <main className="onboarding-shell">
      <section className="onboarding-card">
        <header className="onboarding-hero">
          <p className="eyebrow">Первый запуск</p>
          <h1>Настройка Karpik</h1>
          <p className="muted-text">
            Сначала зарегистрируйте этот ПК, настройте локальную защиту и свяжите Telegram, затем
            приложение откроет основную рабочую оболочку.
          </p>
        </header>

        <section className="onboarding-progress">
          {progressItems.map((item) => (
            <article className="onboarding-progress__item" key={item.id}>
              <strong>{item.label}</strong>
              <span>{formatStatusLabel(item.ready)}</span>
            </article>
          ))}
        </section>

        <section className="onboarding-grid">
          <article className="settings-card onboarding-section">
            <div className="settings-card__header">
              <div>
                <p className="eyebrow">Шаг 1</p>
                <h2>Данные владельца</h2>
              </div>
            </div>
            <label className="settings-field">
              <span>Название этого ПК</span>
              <input onChange={(event) => setDeviceLabel(event.target.value)} value={deviceLabel} />
            </label>
            <label className="settings-field">
              <span>ФИО</span>
              <input onChange={(event) => setFullName(event.target.value)} value={fullName} />
            </label>
            <label className="settings-field">
              <span>Пол</span>
              <input onChange={(event) => setGender(event.target.value)} value={gender} />
            </label>
            <label className="settings-field">
              <span>Возраст</span>
              <input onChange={(event) => setAge(event.target.value)} value={age} />
            </label>
            <label className="settings-field">
              <span>Город</span>
              <input onChange={(event) => setCity(event.target.value)} value={city} />
            </label>
            <div className="action-row">
              <button disabled={isSavingProfile} onClick={() => void handleSaveProfile()} type="button">
                Сохранить данные
              </button>
            </div>
            <p className="muted-text">{`Локальный идентификатор устройства: ${deviceIdentity.deviceId}`}</p>
          </article>

          <article className="settings-card onboarding-section">
            <div className="settings-card__header">
              <div>
                <p className="eyebrow">Шаг 2</p>
                <h2>Локальная защита</h2>
              </div>
            </div>
            <label className="settings-field">
              <span>Пароль</span>
              <input
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                value={password}
              />
            </label>
            <div className="action-row">
              <button disabled={isSavingPassword} onClick={() => void handleSavePassword()} type="button">
                Сохранить пароль
              </button>
            </div>
            <div className="settings-card__divider" />
            <div className="action-row">
              <button disabled={isCreatingTotp} onClick={() => void handleCreateTotpEnrollment()} type="button">
                Создать QR для TOTP
              </button>
            </div>
            {pendingTotpEnrollment ? (
              <div className="onboarding-totp">
                <img alt="TOTP QR" className="onboarding-totp__qr" src={pendingTotpEnrollment.qrDataUrl} />
                <label className="settings-field">
                  <span>Код из приложения</span>
                  <input onChange={(event) => setTotpCode(event.target.value)} value={totpCode} />
                </label>
                <div className="action-row">
                  <button disabled={isConfirmingTotp} onClick={() => void handleConfirmTotp()} type="button">
                    Подтвердить TOTP
                  </button>
                </div>
              </div>
            ) : null}
            <p className="muted-text">{`Пароль: ${formatStatusLabel(authConfigState.passwordConfigured)} · TOTP: ${formatStatusLabel(authConfigState.totpConfigured)}`}</p>
          </article>

          <article className="settings-card onboarding-section">
            <div className="settings-card__header">
              <div>
                <p className="eyebrow">Шаг 3</p>
                <h2>Telegram</h2>
              </div>
            </div>
            <p className="muted-text">
              Основной путь: открыть Telegram по специальной ссылке и завершить привязку в общем
              боте.
            </p>
            <div className="action-row">
              <button disabled={isOpeningTelegram} onClick={() => void handleOpenTelegram()} type="button">
                Открыть Telegram
              </button>
              <button disabled={isOpeningPairing} onClick={() => void handleOpenPairingFallback()} type="button">
                Показать код /pair
              </button>
              <button disabled={isRefreshingStatus} onClick={() => void handleRefresh()} type="button">
                Обновить статус
              </button>
            </div>
            {startLink ? (
              <div className="settings-inline-note">
                <strong>Telegram deep link</strong>
                <p>{startLink}</p>
              </div>
            ) : null}
            {pairingState?.code ? (
              <div className="settings-inline-note">
                <strong>Fallback pairing</strong>
                <p>{`/pair ${pairingState.code}`}</p>
              </div>
            ) : null}
            <p className="muted-text">
              После успешной привязки бот закрепит ваш Telegram за этим устройством и дальнейшие
              задачи будут идти только на этот ПК.
            </p>
          </article>
        </section>

        {feedback ? <p className="settings-feedback settings-feedback--success">{feedback}</p> : null}
        {error ? <p className="settings-feedback settings-feedback--error">{error}</p> : null}
      </section>
    </main>
  );
}
