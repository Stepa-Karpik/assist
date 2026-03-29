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
  return value ? "Да" : "Нет";
}

function formatHeartbeatState(value: RuntimeStatus["serverHeartbeatState"]): string {
  return value === "online" ? "На связи" : "Недоступен";
}

function formatUpdatePhase(value: UpdateState["phase"]): string {
  switch (value) {
    case "idle":
      return "Готово";
    case "checking":
      return "Проверка";
    case "downloading":
      return "Загрузка";
    case "downloaded":
      return "Готово к установке";
    case "error":
      return "Ошибка";
    case "disabled":
    default:
      return "Выключено";
  }
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
          setError("Не удалось загрузить состояние сервисов.");
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
      const nextState =
        (await window.karpik?.checkForUpdates?.()) ?? emptyUpdateState;
      setUpdateState((currentState) =>
        currentState.phase === "downloaded" && nextState.phase === "checking" ? currentState : nextState
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
    <div className="page-shell page-shell--full">
      <div className="page-header">
        <div>
          <p className="eyebrow">Сервисы</p>
          <h2>Состояние приложения</h2>
          <p className="muted-text">
            Подключение к серверу, готовность защиты, локальная активность и обновления.
          </p>
        </div>
      </div>

      {isLoading ? <p className="muted-text">Загружаем состояние сервисов...</p> : null}
      {error !== null ? <p className="task-error">{error}</p> : null}

      {!isLoading ? (
        <div className="service-grid">
          <article className="task-card">
            <div className="task-card-header">
              <strong>Подключение</strong>
              <span className="task-status">{formatHeartbeatState(status.serverHeartbeatState)}</span>
            </div>
            <p>Устройство: {status.deviceId}</p>
            <p>Сервер на связи: {formatBoolean(status.serverHeartbeatReachable)}</p>
            <p>Последний пинг: {status.serverHeartbeatAt ?? "ещё не было"}</p>
            <p>Pairing активен: {formatBoolean(status.pairingActive)}</p>
            <p>Доверенных Telegram-пользователей: {status.trustedTelegramUserCount}</p>
          </article>

          <article className="task-card">
            <div className="task-card-header">
              <strong>Безопасность и окружение</strong>
              <span className="task-status">Готовность</span>
            </div>
            <p>Пароль настроен: {formatBoolean(status.passwordConfigured)}</p>
            <p>TOTP настроен: {formatBoolean(status.totpConfigured)}</p>
            <p>Workspace: {status.workspaceCount}</p>
            <p>Основной workspace: {status.defaultWorkspaceName || "не выбран"}</p>
            <p>{status.defaultWorkspaceRoot || "Путь будет показан после настройки."}</p>
          </article>

          <article className="task-card">
            <div className="task-card-header">
              <strong>Локальная активность</strong>
              <span className="task-status">Мониторинг</span>
            </div>
            <p>Локальных чатов: {status.localChatCount}</p>
            <p>Последний активный чат: {status.lastActiveChatTitle ?? "нет данных"}</p>
            <p>Записей в логе: {status.activityLogCount}</p>
            <p>Активных задач: {status.pendingTaskCount}</p>
            <p>Проблемных задач: {status.blockedTaskCount}</p>
          </article>

          <article className="task-card">
            <div className="task-card-header">
              <strong>Обновления</strong>
              <span className="task-status">{formatUpdatePhase(updateState.phase)}</span>
            </div>
            <p>Текущая версия: {updateState.currentVersion || "неизвестно"}</p>
            <p>Обновления доступны: {formatBoolean(updateState.isSupported)}</p>
            <p>Последняя проверка: {updateState.lastCheckedAt ?? "ещё не запускалась"}</p>
            <p>Доступный релиз: {updateState.availableReleaseName ?? "нет"}</p>
            <p>{updateState.message ?? "Пока нет событий обновления."}</p>
            <div className="action-row">
              <button
                aria-busy={isCheckingUpdates}
                className={`ghost-button${isCheckingUpdates ? " is-busy" : ""}`}
                disabled={isCheckingUpdates || !updateState.isSupported}
                onClick={() => {
                  void handleCheckForUpdates();
                }}
                type="button"
              >
                {isCheckingUpdates ? "Проверяем..." : "Проверить обновления"}
              </button>
              <button
                aria-busy={isInstallingUpdate}
                className={`ghost-button${isInstallingUpdate ? " is-busy" : ""}`}
                disabled={isInstallingUpdate || updateState.phase !== "downloaded"}
                onClick={() => {
                  void handleInstallUpdate();
                }}
                type="button"
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
