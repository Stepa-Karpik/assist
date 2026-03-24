import { useEffect, useState } from "react";

type RuntimeStatus = Awaited<
  ReturnType<NonNullable<Window["karpik"]>["getRuntimeStatus"]>
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

function formatBoolean(value: boolean): string {
  return value ? "yes" : "no";
}

export function ServicesPage() {
  const [status, setStatus] = useState<RuntimeStatus>(emptyRuntimeStatus);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isSubscribed = true;

    async function loadStatus() {
      try {
        const nextStatus = await (window.karpik?.getRuntimeStatus?.() ?? Promise.resolve(emptyRuntimeStatus));

        if (!isSubscribed) {
          return;
        }

        setStatus(nextStatus);
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

  return (
    <div className="page-shell">
      <p className="eyebrow">Сервисы</p>
      <h2>Connected Integrations</h2>
      <p className="muted-text">
        Desktop runtime snapshot: device, server endpoint, auth readiness, workspace routing and local chat activity.
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
        </div>
      ) : null}
    </div>
  );
}
