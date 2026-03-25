import { useEffect, useMemo, useState } from "react";

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

type AppPreferencesState = {
  launchAtLogin: boolean;
  notificationsEnabled: boolean;
  startHiddenOnLaunch: boolean;
  closeToTrayOnClose: boolean;
};

type CodexWorkspace = {
  id: string;
  name: string;
  rootPath: string;
};

type CodexConfigState = {
  workspaces: CodexWorkspace[];
  defaultWorkspaceId: string;
  chatBindings: Record<string, string>;
};

type WorkspaceDraft = {
  id: string;
  name: string;
  rootPath: string;
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

const emptyAppPreferencesState: AppPreferencesState = {
  launchAtLogin: false,
  notificationsEnabled: true,
  startHiddenOnLaunch: true,
  closeToTrayOnClose: true
};

const emptyCodexConfigState: CodexConfigState = {
  workspaces: [],
  defaultWorkspaceId: "",
  chatBindings: {}
};

const supportedRemoteTasks = [
  "/pair <code>",
  "/task low status",
  "/task low screenshot",
  "/task low read docs/notes/<file>",
  "/task low list docs/notes",
  "/task low write-note <name> :: <text>",
  "/task high codex <prompt>",
  "/task high codex-write <prompt>",
  "/status [task_id]",
  "/auth <value>",
  "/confirm",
  "/decline"
];

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

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function createWorkspaceId(name: string, rootPath: string, usedIds: Set<string>): string {
  const baseId = slugify(name) || slugify(rootPath) || "workspace";
  let candidate = baseId;
  let suffix = 2;

  while (usedIds.has(candidate)) {
    candidate = `${baseId}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

function buildWorkspaceDrafts(configState: CodexConfigState): WorkspaceDraft[] {
  return configState.workspaces.map((workspace) => ({
    id: workspace.id,
    name: workspace.name,
    rootPath: workspace.rootPath
  }));
}

function buildWorkspacePayload(workspaceDrafts: WorkspaceDraft[]): CodexWorkspace[] {
  const usedIds = new Set<string>();

  return workspaceDrafts.flatMap((workspaceDraft, index) => {
    const name = workspaceDraft.name.trim();
    const rootPath = workspaceDraft.rootPath.trim();

    if (!name && !rootPath) {
      return [];
    }

    if (!rootPath) {
      return [];
    }

    const requestedId = workspaceDraft.id.trim();
    const id =
      requestedId && !usedIds.has(requestedId)
        ? requestedId
        : createWorkspaceId(name || `workspace-${index + 1}`, rootPath, usedIds);
    const normalizedWorkspace = {
      id,
      name: name || `Workspace ${index + 1}`,
      rootPath
    };

    usedIds.add(id);
    return [normalizedWorkspace];
  });
}

function buildButtonClass(isBusy: boolean, isSuccess: boolean): string {
  return `ghost-button${isBusy ? " is-busy" : ""}${isSuccess ? " is-success" : ""}`;
}

export function SettingsPage() {
  const [pairingState, setPairingState] = useState<PairingState>(emptyPairingState);
  const [authConfigState, setAuthConfigState] = useState<AuthConfigState>(emptyAuthConfigState);
  const [appPreferences, setAppPreferences] = useState<AppPreferencesState>(emptyAppPreferencesState);
  const [codexConfigState, setCodexConfigState] = useState<CodexConfigState>(emptyCodexConfigState);
  const [password, setPassword] = useState("");
  const [totpSecret, setTotpSecret] = useState("");
  const [workspaceDrafts, setWorkspaceDrafts] = useState<WorkspaceDraft[]>([]);
  const [selectedDefaultWorkspaceId, setSelectedDefaultWorkspaceId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isOpeningPairing, setIsOpeningPairing] = useState(false);
  const [isSavingAuthConfig, setIsSavingAuthConfig] = useState(false);
  const [isSavingAppPreferences, setIsSavingAppPreferences] = useState(false);
  const [isSavingCodexConfig, setIsSavingCodexConfig] = useState(false);
  const [pairingFeedback, setPairingFeedback] = useState<string | null>(null);
  const [authFeedback, setAuthFeedback] = useState<string | null>(null);
  const [appPreferencesFeedback, setAppPreferencesFeedback] = useState<string | null>(null);
  const [codexFeedback, setCodexFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const workspaceOptions = useMemo(() => buildWorkspacePayload(workspaceDrafts), [workspaceDrafts]);

  useEffect(() => {
    let isSubscribed = true;

    async function loadSettingsState() {
      try {
        const [nextPairingState, nextAuthConfigState, nextAppPreferences, nextCodexConfigState] =
          await Promise.all([
            window.karpik?.getPairingState?.() ?? Promise.resolve(emptyPairingState),
            window.karpik?.getAuthConfigState?.() ?? Promise.resolve(emptyAuthConfigState),
            window.karpik?.getAppPreferences?.() ?? Promise.resolve(emptyAppPreferencesState),
            window.karpik?.getCodexConfigState?.() ?? Promise.resolve(emptyCodexConfigState)
          ]);

        if (isSubscribed) {
          setPairingState(nextPairingState);
          setAuthConfigState(nextAuthConfigState);
          setAppPreferences(nextAppPreferences);
          setCodexConfigState(nextCodexConfigState);
          setWorkspaceDrafts(buildWorkspaceDrafts(nextCodexConfigState));
          setSelectedDefaultWorkspaceId(nextCodexConfigState.defaultWorkspaceId);
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
    setPairingFeedback(null);
    setIsOpeningPairing(true);

    try {
      const nextState = await window.karpik.openPairingSession();
      setPairingState(nextState);
      setPairingFeedback(
        "Pairing window opened. Use the current code within 5 minutes while the desktop is online."
      );
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
    setAuthFeedback(null);
    setIsSavingAuthConfig(true);

    try {
      const nextState = await window.karpik.saveAuthConfig({
        password,
        totpSecret
      });
      setAuthConfigState(nextState);
      setPassword("");
      setTotpSecret("");
      setAuthFeedback("Auth settings saved locally.");
    } catch {
      setError("Не удалось сохранить auth-настройки.");
    } finally {
      setIsSavingAuthConfig(false);
    }
  }

  async function handleSaveAppPreferences() {
    if (!window.karpik?.saveAppPreferences) {
      setError("Desktop preferences API недоступен в этом окружении.");
      return;
    }

    setError(null);
    setAppPreferencesFeedback(null);
    setIsSavingAppPreferences(true);

    try {
      const nextState = await window.karpik.saveAppPreferences(appPreferences);
      setAppPreferences(nextState);
      setAppPreferencesFeedback("Desktop behavior saved.");
    } catch {
      setError("Не удалось сохранить настройки desktop behavior.");
    } finally {
      setIsSavingAppPreferences(false);
    }
  }

  async function handleSaveCodexConfig() {
    if (!window.karpik?.saveCodexConfig) {
      setError("Codex settings API недоступен в этом окружении.");
      return;
    }

    const workspaces = buildWorkspacePayload(workspaceDrafts);

    if (workspaces.length === 0) {
      setError("Нужен хотя бы один workspace с именем и путём.");
      return;
    }

    const defaultWorkspaceId = workspaces.some(
      (workspace) => workspace.id === selectedDefaultWorkspaceId
    )
      ? selectedDefaultWorkspaceId
      : workspaces[0].id;

    setError(null);
    setCodexFeedback(null);
    setIsSavingCodexConfig(true);

    try {
      const nextState = await window.karpik.saveCodexConfig({
        workspaces,
        defaultWorkspaceId
      });
      setCodexConfigState(nextState);
      setWorkspaceDrafts(buildWorkspaceDrafts(nextState));
      setSelectedDefaultWorkspaceId(nextState.defaultWorkspaceId);
      setCodexFeedback("Workspace settings saved.");
    } catch {
      setError("Не удалось сохранить настройки Codex.");
    } finally {
      setIsSavingCodexConfig(false);
    }
  }

  function handleWorkspaceDraftChange(index: number, field: "name" | "rootPath", value: string) {
    setCodexFeedback(null);
    setWorkspaceDrafts((currentDrafts) =>
      currentDrafts.map((draft, draftIndex) =>
        draftIndex === index ? { ...draft, [field]: value } : draft
      )
    );
  }

  function handleAddWorkspace() {
    setCodexFeedback(null);
    setWorkspaceDrafts((currentDrafts) => [
      ...currentDrafts,
      {
        id: "",
        name: "",
        rootPath: ""
      }
    ]);
  }

  const pairingStatus = isLoading
    ? "Загрузка pairing-состояния..."
    : pairingState.isActive
      ? "Pairing активен"
      : "Pairing не активен";

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
          onChange={(event) => {
            setAuthFeedback(null);
            setPassword(event.target.value);
          }}
          type="password"
          value={password}
        />
        <label className="section-label" htmlFor="settings-totp-secret">
          TOTP secret
        </label>
        <input
          className="quick-input"
          id="settings-totp-secret"
          onChange={(event) => {
            setAuthFeedback(null);
            setTotpSecret(event.target.value);
          }}
          type="text"
          value={totpSecret}
        />
        <button
          aria-busy={isSavingAuthConfig}
          className={buildButtonClass(isSavingAuthConfig, authFeedback !== null)}
          disabled={isLoading || isSavingAuthConfig}
          onClick={() => {
            void handleSaveAuthConfig();
          }}
          type="button"
        >
          {isSavingAuthConfig ? "Сохраняем..." : "Сохранить auth-настройки"}
        </button>
        {authFeedback !== null ? <p className="task-success status-feedback">{authFeedback}</p> : null}
      </section>

      <section className="quick-card">
        <p className="section-label">Desktop behavior</p>
        <label htmlFor="settings-launch-at-login">
          <input
            checked={appPreferences.launchAtLogin}
            id="settings-launch-at-login"
            onChange={(event) => {
              setAppPreferencesFeedback(null);
              setAppPreferences((currentState) => ({
                ...currentState,
                launchAtLogin: event.target.checked
              }));
            }}
            type="checkbox"
          />{" "}
          Launch at login
        </label>
        <label htmlFor="settings-desktop-notifications">
          <input
            checked={appPreferences.notificationsEnabled}
            id="settings-desktop-notifications"
            onChange={(event) => {
              setAppPreferencesFeedback(null);
              setAppPreferences((currentState) => ({
                ...currentState,
                notificationsEnabled: event.target.checked
              }));
            }}
            type="checkbox"
          />{" "}
          Desktop notifications
        </label>
        <label htmlFor="settings-start-hidden">
          <input
            checked={appPreferences.startHiddenOnLaunch}
            id="settings-start-hidden"
            onChange={(event) => {
              setAppPreferencesFeedback(null);
              setAppPreferences((currentState) => ({
                ...currentState,
                startHiddenOnLaunch: event.target.checked
              }));
            }}
            type="checkbox"
          />{" "}
          Start hidden in tray
        </label>
        <label htmlFor="settings-close-to-tray">
          <input
            checked={appPreferences.closeToTrayOnClose}
            id="settings-close-to-tray"
            onChange={(event) => {
              setAppPreferencesFeedback(null);
              setAppPreferences((currentState) => ({
                ...currentState,
                closeToTrayOnClose: event.target.checked
              }));
            }}
            type="checkbox"
          />{" "}
          Close main window to tray
        </label>
        <button
          aria-busy={isSavingAppPreferences}
          className={buildButtonClass(isSavingAppPreferences, appPreferencesFeedback !== null)}
          disabled={isLoading || isSavingAppPreferences}
          onClick={() => {
            void handleSaveAppPreferences();
          }}
          type="button"
        >
          {isSavingAppPreferences ? "Saving..." : "Save desktop behavior"}
        </button>
        {appPreferencesFeedback !== null ? (
          <p className="task-success status-feedback">{appPreferencesFeedback}</p>
        ) : null}
      </section>

      <section className="quick-card">
        <p className="section-label">Supported remote tasks</p>
        <p className="muted-text">Codex and codex-write are always treated as high-risk tasks.</p>
        {supportedRemoteTasks.map((taskExample) => (
          <p className="muted-text" key={taskExample}>
            {taskExample}
          </p>
        ))}
      </section>

      <section className="quick-card">
        <p className="section-label">Telegram pairing</p>
        <p>{pairingStatus}</p>
        {!isLoading && pairingState.isActive && pairingState.code !== null ? (
          <p>Код: {pairingState.code}</p>
        ) : null}
        <p className="muted-text">{formatExpiryHint(pairingState.isActive ? pairingState.expiresAt : null)}</p>
        <p className="muted-text">Доверенные Telegram ID: {pairingState.trustedTelegramUserIds.length}</p>
        {error !== null ? <p className="muted-text">{error}</p> : null}
        <button
          aria-busy={isOpeningPairing}
          className={buildButtonClass(isOpeningPairing, pairingFeedback !== null)}
          disabled={isLoading || isOpeningPairing}
          onClick={() => {
            void handleOpenPairingSession();
          }}
          type="button"
        >
          {isOpeningPairing ? "Открываем..." : "Открыть pairing"}
        </button>
        {pairingFeedback !== null ? <p className="task-success status-feedback">{pairingFeedback}</p> : null}
      </section>

      <section className="quick-card">
        <p className="section-label">Local codex</p>
        <p className="muted-text">Workspaces: {codexConfigState.workspaces.length || workspaceOptions.length}</p>
        {workspaceDrafts.map((workspaceDraft, index) => (
          <div className="task-card" key={`${workspaceDraft.id || "draft"}-${index}`}>
            <label className="section-label" htmlFor={`settings-workspace-name-${index + 1}`}>
              Workspace name {index + 1}
            </label>
            <input
              className="quick-input"
              id={`settings-workspace-name-${index + 1}`}
              onChange={(event) => handleWorkspaceDraftChange(index, "name", event.target.value)}
              type="text"
              value={workspaceDraft.name}
            />
            <label className="section-label" htmlFor={`settings-workspace-path-${index + 1}`}>
              Workspace path {index + 1}
            </label>
            <input
              className="quick-input"
              id={`settings-workspace-path-${index + 1}`}
              onChange={(event) => handleWorkspaceDraftChange(index, "rootPath", event.target.value)}
              type="text"
              value={workspaceDraft.rootPath}
            />
          </div>
        ))}
        <label className="section-label" htmlFor="settings-default-workspace">
          Default workspace
        </label>
        <select
          className="quick-input"
          id="settings-default-workspace"
          onChange={(event) => {
            setCodexFeedback(null);
            setSelectedDefaultWorkspaceId(event.target.value);
          }}
          value={selectedDefaultWorkspaceId}
        >
          {workspaceOptions.map((workspace) => (
            <option key={workspace.id} value={workspace.id}>
              {workspace.name} ({workspace.id})
            </option>
          ))}
        </select>
        <div className="task-card-header">
          <button className="ghost-button" disabled={isLoading} onClick={handleAddWorkspace} type="button">
            Add workspace
          </button>
          <button
            aria-busy={isSavingCodexConfig}
            className={buildButtonClass(isSavingCodexConfig, codexFeedback !== null)}
            disabled={isLoading || isSavingCodexConfig}
            onClick={() => {
              void handleSaveCodexConfig();
            }}
            type="button"
          >
            {isSavingCodexConfig ? "Saving..." : "Save workspaces"}
          </button>
        </div>
        {codexFeedback !== null ? <p className="task-success status-feedback">{codexFeedback}</p> : null}
      </section>
    </div>
  );
}
