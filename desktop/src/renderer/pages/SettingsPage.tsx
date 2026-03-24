import { useEffect, useState } from "react";

type PairingState = {
  code: string | null;
  expiresAt: string | null;
  isActive: boolean;
  trustedTelegramUserIds: number[];
};

type AuthConfigState = {
  passwordConfigured: boolean;
  totpConfigured: boolean;
};

type CodexConfigState = {
  workspaceRoot: string;
};

const emptyPairingState: PairingState = {
  code: null,
  expiresAt: null,
  isActive: false,
  trustedTelegramUserIds: []
};

const emptyAuthConfigState: AuthConfigState = {
  passwordConfigured: false,
  totpConfigured: false
};

const emptyCodexConfigState: CodexConfigState = {
  workspaceRoot: ""
};

function formatExpiryHint(expiresAt: string | null): string {
  if (expiresAt === null) {
    return "Код действует 5 минут и принимается только пока ПК онлайн.";
  }

  const expiresAtDate = new Date(expiresAt);

  if (Number.isNaN(expiresAtDate.getTime())) {
    return `Действует до: ${expiresAt}`;
  }

  return `Действует до: ${expiresAtDate.toLocaleString("ru-RU")}`;
}

function describeAuthStatus(isConfigured: boolean): string {
  return isConfigured ? "настроен" : "не настроен";
}

export function SettingsPage() {
  const [pairingState, setPairingState] = useState<PairingState>(emptyPairingState);
  const [authConfigState, setAuthConfigState] = useState<AuthConfigState>(emptyAuthConfigState);
  const [codexConfigState, setCodexConfigState] = useState<CodexConfigState>(emptyCodexConfigState);
  const [password, setPassword] = useState("");
  const [totpSecret, setTotpSecret] = useState("");
  const [workspaceRoot, setWorkspaceRoot] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isOpeningPairing, setIsOpeningPairing] = useState(false);
  const [isSavingAuthConfig, setIsSavingAuthConfig] = useState(false);
  const [isSavingCodexConfig, setIsSavingCodexConfig] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isSubscribed = true;

    async function loadSettingsState() {
      try {
        const [nextPairingState, nextAuthConfigState, nextCodexConfigState] = await Promise.all([
          window.karpik?.getPairingState?.() ?? Promise.resolve(emptyPairingState),
          window.karpik?.getAuthConfigState?.() ?? Promise.resolve(emptyAuthConfigState),
          window.karpik?.getCodexConfigState?.() ?? Promise.resolve(emptyCodexConfigState)
        ]);

        if (isSubscribed) {
          setPairingState(nextPairingState);
          setAuthConfigState(nextAuthConfigState);
          setCodexConfigState(nextCodexConfigState);
          setWorkspaceRoot(nextCodexConfigState.workspaceRoot);
        }
      } catch {
        if (isSubscribed) {
          setError("Не удалось получить локальное состояние безопасности.");
        }
      } finally {
        if (isSubscribed) {
          setIsLoading(false);
        }
      }
    }

    void loadSettingsState();

    return () => {
      isSubscribed = false;
    };
  }, []);

  async function handleOpenPairingSession() {
    if (!window.karpik?.openPairingSession) {
      setError("Pairing API недоступен в этом окружении.");
      return;
    }

    setError(null);
    setIsOpeningPairing(true);

    try {
      const nextState = await window.karpik.openPairingSession();
      setPairingState(nextState);
    } catch {
      setError("Не удалось открыть pairing-сессию.");
    } finally {
      setIsOpeningPairing(false);
    }
  }

  async function handleSaveAuthConfig() {
    if (!window.karpik?.saveAuthConfig) {
      setError("Auth API недоступен в этом окружении.");
      return;
    }

    setError(null);
    setIsSavingAuthConfig(true);

    try {
      const nextState = await window.karpik.saveAuthConfig({
        password,
        totpSecret
      });
      setAuthConfigState(nextState);
      setPassword("");
      setTotpSecret("");
    } catch {
      setError("Не удалось сохранить auth-настройки.");
    } finally {
      setIsSavingAuthConfig(false);
    }
  }

  async function handleSaveCodexConfig() {
    if (!window.karpik?.saveCodexConfig) {
      setError("Codex settings API недоступен в этом окружении.");
      return;
    }

    setError(null);
    setIsSavingCodexConfig(true);

    try {
      const nextState = await window.karpik.saveCodexConfig({
        workspaceRoot
      });
      setCodexConfigState(nextState);
      setWorkspaceRoot(nextState.workspaceRoot);
    } catch {
      setError("Не удалось сохранить настройки Codex.");
    } finally {
      setIsSavingCodexConfig(false);
    }
  }

  const pairingStatus = isLoading ? "Загрузка pairing-состояния..." : "Pairing не активен";

  return (
    <div className="page-shell">
      <p className="eyebrow">Настройки</p>
      <h2>Локальные настройки устройства</h2>
      <p className="muted-text">
        Здесь управляются pairing-код, доверенные Telegram ID и локальная политика доступа.
      </p>

      <section className="quick-card">
        <p className="section-label">Remote auth</p>
        <p>Password: {describeAuthStatus(authConfigState.passwordConfigured)}</p>
        <p>TOTP: {describeAuthStatus(authConfigState.totpConfigured)}</p>
        <label className="section-label" htmlFor="settings-password">
          Пароль для remote auth
        </label>
        <input
          className="quick-input"
          id="settings-password"
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          value={password}
        />
        <label className="section-label" htmlFor="settings-totp-secret">
          TOTP secret
        </label>
        <input
          className="quick-input"
          id="settings-totp-secret"
          onChange={(event) => setTotpSecret(event.target.value)}
          type="text"
          value={totpSecret}
        />
        <button
          className="ghost-button"
          disabled={isLoading || isSavingAuthConfig}
          onClick={() => {
            void handleSaveAuthConfig();
          }}
          type="button"
        >
          {isSavingAuthConfig ? "Сохраняем..." : "Сохранить auth-настройки"}
        </button>
      </section>

      <section className="quick-card">
        <p className="section-label">Telegram pairing</p>
        <p>{pairingStatus}</p>
        {!isLoading && pairingState.isActive && pairingState.code !== null ? (
          <p>Код: {pairingState.code}</p>
        ) : null}
        <p className="muted-text">
          {formatExpiryHint(pairingState.isActive ? pairingState.expiresAt : null)}
        </p>
        <p className="muted-text">
          Доверенные Telegram ID: {pairingState.trustedTelegramUserIds.length}
        </p>
        {error !== null ? <p className="muted-text">{error}</p> : null}
        <button
          className="ghost-button"
          disabled={isLoading || isOpeningPairing}
          onClick={() => {
            void handleOpenPairingSession();
          }}
          type="button"
        >
          {isOpeningPairing ? "Открываем..." : "Открыть pairing"}
        </button>
      </section>

      <section className="quick-card">
        <p className="section-label">Local codex</p>
        <p className="muted-text">
          Workspace root: {codexConfigState.workspaceRoot || "не задан"}
        </p>
        <label className="section-label" htmlFor="settings-codex-workspace">
          Codex workspace root
        </label>
        <input
          className="quick-input"
          id="settings-codex-workspace"
          onChange={(event) => setWorkspaceRoot(event.target.value)}
          type="text"
          value={workspaceRoot}
        />
        <button
          className="ghost-button"
          disabled={isLoading || isSavingCodexConfig}
          onClick={() => {
            void handleSaveCodexConfig();
          }}
          type="button"
        >
          {isSavingCodexConfig ? "Saving..." : "Save codex settings"}
        </button>
      </section>
    </div>
  );
}
