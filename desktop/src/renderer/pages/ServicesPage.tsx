import { useEffect, useState } from "react";

type RuntimeStatus = Awaited<
  ReturnType<NonNullable<Window["karpik"]>["getRuntimeStatus"]>
>;
type UpdateState = Awaited<
  ReturnType<NonNullable<Window["karpik"]>["getUpdateState"]>
>;

const emptyRuntimeStatus: RuntimeStatus = {
  deviceId: "",
  serverUrl: "",
  serverHeartbeatState: "offline",
  serverHeartbeatReachable: false,
  serverHeartbeatAt: null,
  pairingActive: false,
  trustedTelegramUserCount: 0,
  passwordConfigured: false,
  totpConfigured: false,
  workspaceCount: 0,
  defaultWorkspaceName: "",
  defaultWorkspaceRoot: "",
  localChatCount: 0,
  lastActiveChatTitle: null,
  activityLogCount: 0,
  pendingTaskCount: 0,
  blockedTaskCount: 0
};
const emptyUpdateState: UpdateState = {
  currentVersion: "",
  feedUrl: null,
  isSupported: false,
  phase: "disabled",
  lastCheckedAt: null,
  availableReleaseName: null,
  message: null
};

function formatBoolean(value: boolean): string {
  return value ? "yes" : "no";
}

export function ServicesPage() {
  const [status, setStatus] = useState<RuntimeStatus>(emptyRuntimeStatus);
  const [updateState, setUpdateState] = useState<UpdateState>(emptyUpdateState);
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [isInstallingUpdate, setIsInstallingUpdate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isSubscribed = true;

    async function loadStatus() {
      try {
        const [nextStatus, nextUpdateState] = await Promise.all([
          window.karpik?.getRuntimeStatus?.() ?? Promise.resolve(emptyRuntimeStatus),
          window.karpik?.getUpdateState?.() ?? Promise.resolve(emptyUpdateState)
        ]);

        if (!isSubscribed) {
          return;
        }

        setStatus(nextStatus);
        setUpdateState(nextUpdateState ?? emptyUpdateState);
        setError(null);
      } catch {
        if (isSubscribed) {
          setError("Не удалось загрузить runtime status.");
        }
      } finally {
        if (isSubscribed) {
          setIsLoading(false);
        }
      }
    }

    void loadStatus();
    const intervalId = window.setInterval(() => {
      void loadStatus();
    }, 2_000);

    return () => {
      isSubscribed = false;
      window.clearInterval(intervalId);
    };
  }, []);

  async function handleCheckForUpdates() {
    try {
      setIsCheckingUpdates(true);
      const nextState = await (window.karpik?.checkForUpdates?.() ?? Promise.resolve(emptyUpdateState));
      setUpdateState((currentState) =>
        currentState.phase === "downloaded" && nextState.phase === "checking"
          ? currentState
          : nextState
      );
      setError(null);
    } catch {
      setError("Не удалось проверить обновления.");
    } finally {
      setIsCheckingUpdates(false);
    }
  }

  async function handleInstallUpdate() {
    try {
      setIsInstallingUpdate(true);
      await window.karpik?.installUpdate?.();
      setError(null);
    } catch {
      setError("Не удалось запустить установку обновления.");
    } finally {
      setIsInstallingUpdate(false);
    }
  }

  return (
    <div className="page-shell">
      <p className="eyebrow">Сервисы</p>
      <h2>Connected Integrations</h2>
      <p className="muted-text">
        Desktop runtime snapshot: device, server endpoint, auth readiness, workspace routing, local chat activity and updates.
      </p>

      {isLoading ? <p className="muted-text">Загружаем runtime status...</p> : null}
      {error !== null ? <p className="task-error">{error}</p> : null}

      {!isLoading ? (
        <div className="task-list">
          <article className="task-card">
            <div className="task-card-header">
              <strong>Runtime</strong>
              <span className="task-status">Desktop</span>
            </div>
            <p>Device ID: {status.deviceId}</p>
            <p>Server URL: {status.serverUrl}</p>
            <p>Server heartbeat: {status.serverHeartbeatState}</p>
            <p>Server reachable: {formatBoolean(status.serverHeartbeatReachable)}</p>
            <p>Last server heartbeat: {status.serverHeartbeatAt ?? "none"}</p>
            <p>Pairing active: {formatBoolean(status.pairingActive)}</p>
            <p>Trusted Telegram users: {status.trustedTelegramUserCount}</p>
          </article>

          <article className="task-card">
            <div className="task-card-header">
              <strong>Auth and workspaces</strong>
              <span className="task-status">Ready</span>
            </div>
            <p>Password configured: {formatBoolean(status.passwordConfigured)}</p>
            <p>TOTP configured: {formatBoolean(status.totpConfigured)}</p>
            <p>Workspaces: {status.workspaceCount}</p>
            <p>Default workspace: {status.defaultWorkspaceName}</p>
            <p>{status.defaultWorkspaceRoot}</p>
          </article>

          <article className="task-card">
            <div className="task-card-header">
              <strong>Local activity</strong>
              <span className="task-status">Observed</span>
            </div>
            <p>Local chats: {status.localChatCount}</p>
            <p>Last active chat: {status.lastActiveChatTitle ?? "none"}</p>
            <p>Activity log entries: {status.activityLogCount}</p>
            <p>Pending tasks: {status.pendingTaskCount}</p>
            <p>Blocked tasks: {status.blockedTaskCount}</p>
          </article>

          <article className="task-card">
            <div className="task-card-header">
              <strong>Desktop updates</strong>
              <span className="task-status">{updateState.phase}</span>
            </div>
            <p>Current version: {updateState.currentVersion || "unknown"}</p>
            <p>Feed URL: {updateState.feedUrl ?? "not configured"}</p>
            <p>Updater enabled: {formatBoolean(updateState.isSupported)}</p>
            <p>Last checked: {updateState.lastCheckedAt ?? "never"}</p>
            <p>Available release: {updateState.availableReleaseName ?? "none"}</p>
            <p>{updateState.message ?? "No updater activity yet."}</p>
            <div className="action-row">
              <button
                type="button"
                onClick={() => {
                  void handleCheckForUpdates();
                }}
                disabled={isCheckingUpdates || !updateState.isSupported}
              >
                {isCheckingUpdates ? "Проверяем..." : "Проверить обновления"}
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleInstallUpdate();
                }}
                disabled={isInstallingUpdate || updateState.phase !== "downloaded"}
              >
                {isInstallingUpdate ? "Запускаем..." : "Установить обновление"}
              </button>
            </div>
          </article>
        </div>
      ) : null}
    </div>
  );
}
