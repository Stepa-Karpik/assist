import { useEffect, useMemo, useState } from "react";

type AppRegistryItem = Awaited<ReturnType<NonNullable<Window["karpik"]>["getAppsState"]>>["items"][number];
type AssistantProcessItem = Awaited<
  ReturnType<NonNullable<Window["karpik"]>["getAssistantProcesses"]>
>[number];

const emptyFormState = {
  appId: "",
  displayName: "",
  launchPath: "",
  aliasesText: "",
  linked: true
};

function sortApps(items: AppRegistryItem[]): AppRegistryItem[] {
  return [...items].sort((left, right) => left.displayName.localeCompare(right.displayName, "ru"));
}

function toAliasesText(item: AppRegistryItem): string {
  return item.aliases.join(", ");
}

function toFormState(item: AppRegistryItem) {
  return {
    appId: item.appId,
    displayName: item.displayName,
    launchPath: item.launchPath,
    aliasesText: toAliasesText(item),
    linked: item.linked
  };
}

function parseAliases(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function ApplicationsPage() {
  const [appsState, setAppsState] = useState<{ items: AppRegistryItem[] }>({ items: [] });
  const [assistantProcesses, setAssistantProcesses] = useState<AssistantProcessItem[]>([]);
  const [formState, setFormState] = useState(emptyFormState);
  const [isLoading, setIsLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const linkedApps = useMemo(
    () => sortApps(appsState.items.filter((item) => item.linked)),
    [appsState.items]
  );
  const discoveredApps = useMemo(
    () => sortApps(appsState.items.filter((item) => !item.linked)),
    [appsState.items]
  );

  useEffect(() => {
    let isSubscribed = true;

    async function loadState() {
      try {
        const [nextAppsState, nextProcesses] = await Promise.all([
          window.karpik?.getAppsState?.() ?? Promise.resolve({ items: [] }),
          window.karpik?.getAssistantProcesses?.() ?? Promise.resolve([])
        ]);

        if (!isSubscribed) {
          return;
        }

        setAppsState(nextAppsState);
        setAssistantProcesses(nextProcesses);
        setError(null);
      } catch {
        if (isSubscribed) {
          setError("Не удалось загрузить реестр приложений.");
        }
      } finally {
        if (isSubscribed) {
          setIsLoading(false);
        }
      }
    }

    void loadState();
    const processIntervalId = window.setInterval(() => {
      void (window.karpik?.getAssistantProcesses?.() ?? Promise.resolve([]))
        .then((items) => {
          if (isSubscribed) {
            setAssistantProcesses(items);
          }
        })
        .catch(() => undefined);
    }, 2_000);

    return () => {
      isSubscribed = false;
      window.clearInterval(processIntervalId);
    };
  }, []);

  function resetForm() {
    setFormState(emptyFormState);
  }

  async function handleRefreshDiscoveredApps() {
    if (!window.karpik?.refreshDiscoveredApps) {
      setError("API приложений недоступен в этом окружении.");
      return;
    }

    setBusyAction("refresh");
    setError(null);
    setSuccess(null);

    try {
      const nextState = await window.karpik.refreshDiscoveredApps();
      setAppsState(nextState);
      setSuccess("Список приложений обновлён.");
    } catch {
      setError("Не удалось обновить найденные приложения.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSave() {
    if (!window.karpik?.saveAppRegistryEntry) {
      setError("API приложений недоступен в этом окружении.");
      return;
    }

    if (!formState.displayName.trim() || !formState.launchPath.trim()) {
      setError("Укажи название и путь до приложения или ярлыка.");
      return;
    }

    setBusyAction("save");
    setError(null);
    setSuccess(null);

    try {
      const nextState = await window.karpik.saveAppRegistryEntry({
        appId: formState.appId || undefined,
        displayName: formState.displayName.trim(),
        launchPath: formState.launchPath.trim(),
        aliases: parseAliases(formState.aliasesText),
        linked: formState.linked,
        source: formState.appId ? undefined : "manual"
      });
      setAppsState(nextState);
      setSuccess("Приложение сохранено.");
      resetForm();
    } catch {
      setError("Не удалось сохранить приложение.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleRemove(appId: string) {
    if (!window.karpik?.removeAppRegistryEntry) {
      setError("API приложений недоступен в этом окружении.");
      return;
    }

    setBusyAction(`remove:${appId}`);
    setError(null);
    setSuccess(null);

    try {
      const nextState = await window.karpik.removeAppRegistryEntry(appId);
      setAppsState(nextState);
      if (formState.appId === appId) {
        resetForm();
      }
      setSuccess("Приложение удалено из реестра.");
    } catch {
      setError("Не удалось удалить приложение.");
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="page-shell page-shell--full">
      <div className="page-header">
        <div>
          <p className="eyebrow">Приложения</p>
          <h2>Реестр запуска и alias-связки</h2>
          <p className="muted-text">
            Здесь связываются программы и ярлыки с понятными именами. Связанные приложения попадают в
            `/apps`, а найденные автоматически используются как кандидаты для выбора в Telegram.
          </p>
        </div>
        <button
          className={`ghost-button ghost-button--primary${busyAction === "refresh" ? " is-busy" : ""}`}
          disabled={busyAction === "refresh"}
          onClick={() => {
            void handleRefreshDiscoveredApps();
          }}
          type="button"
        >
          {busyAction === "refresh" ? "Обновляем..." : "Обновить найденные"}
        </button>
      </div>

      {isLoading ? <p className="muted-text">Загружаем приложения...</p> : null}
      {error ? <p className="task-error">{error}</p> : null}
      {success ? <p className="task-success">{success}</p> : null}

      <div className="applications-layout">
        <section className="task-card application-editor">
          <div className="task-card-header">
            <strong>{formState.appId ? "Редактирование приложения" : "Связать приложение"}</strong>
            {formState.appId ? <span className="task-status">{formState.appId}</span> : null}
          </div>
          <label className="section-label" htmlFor="app-display-name">
            Название
          </label>
          <input
            className="quick-input"
            id="app-display-name"
            onChange={(event) =>
              setFormState((current) => ({
                ...current,
                displayName: event.target.value
              }))
            }
            placeholder="osu! lazer"
            type="text"
            value={formState.displayName}
          />

          <label className="section-label" htmlFor="app-launch-path">
            Путь до exe или ярлыка
          </label>
          <input
            className="quick-input"
            id="app-launch-path"
            onChange={(event) =>
              setFormState((current) => ({
                ...current,
                launchPath: event.target.value
              }))
            }
            placeholder="C:\\Program Files\\osu!\\osu!.exe"
            type="text"
            value={formState.launchPath}
          />

          <label className="section-label" htmlFor="app-aliases">
            Alias через запятую
          </label>
          <input
            className="quick-input"
            id="app-aliases"
            onChange={(event) =>
              setFormState((current) => ({
                ...current,
                aliasesText: event.target.value
              }))
            }
            placeholder="osu, осу, osu lazer, осу лазер"
            type="text"
            value={formState.aliasesText}
          />

          <label className="checkbox-row">
            <input
              checked={formState.linked}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  linked: event.target.checked
                }))
              }
              type="checkbox"
            />
            <span>Показывать в `/apps` и inline-кнопках</span>
          </label>

          <div className="action-row">
            <button
              className={`ghost-button ghost-button--primary${busyAction === "save" ? " is-busy" : ""}`}
              disabled={busyAction === "save"}
              onClick={() => {
                void handleSave();
              }}
              type="button"
            >
              {busyAction === "save" ? "Сохраняем..." : "Сохранить приложение"}
            </button>
            <button className="ghost-button" onClick={resetForm} type="button">
              Сбросить форму
            </button>
          </div>
        </section>

        <section className="task-card">
          <div className="task-card-header">
            <strong>Связанные приложения</strong>
            <span className="task-status">{linkedApps.length}</span>
          </div>
          {linkedApps.length === 0 ? (
            <p className="muted-text">Пока нет связанных приложений.</p>
          ) : (
            <div className="app-list">
              {linkedApps.map((item) => (
                <article className="app-list-item" key={item.appId}>
                  <div>
                    <strong>{item.displayName}</strong>
                    <p className="chat-list-item__meta">{item.launchPath}</p>
                    <p className="chat-list-item__meta">Alias: {item.aliases.join(", ") || "нет"}</p>
                  </div>
                  <div className="action-row">
                    <button
                      className="ghost-button"
                      onClick={() => setFormState(toFormState(item))}
                      type="button"
                    >
                      Редактировать
                    </button>
                    <button
                      className="ghost-button ghost-button--danger"
                      disabled={busyAction === `remove:${item.appId}`}
                      onClick={() => {
                        void handleRemove(item.appId);
                      }}
                      type="button"
                    >
                      Удалить
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="task-card">
          <div className="task-card-header">
            <strong>Найденные автоматически</strong>
            <span className="task-status">{discoveredApps.length}</span>
          </div>
          {discoveredApps.length === 0 ? (
            <p className="muted-text">Автообнаружение пока ничего не нашло.</p>
          ) : (
            <div className="app-list">
              {discoveredApps.map((item) => (
                <article className="app-list-item" key={item.appId}>
                  <div>
                    <strong>{item.displayName}</strong>
                    <p className="chat-list-item__meta">{item.launchPath}</p>
                    <p className="chat-list-item__meta">Источник: {item.source}</p>
                  </div>
                  <div className="action-row">
                    <button
                      className="ghost-button ghost-button--primary"
                      onClick={() =>
                        setFormState({
                          ...toFormState(item),
                          linked: true
                        })
                      }
                      type="button"
                    >
                      Связать
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="task-card">
          <div className="task-card-header">
            <strong>Процессы ассистента</strong>
            <span className="task-status">{assistantProcesses.length}</span>
          </div>
          {assistantProcesses.length === 0 ? (
            <p className="muted-text">Сейчас нет запущенных ассистентом приложений.</p>
          ) : (
            <div className="app-list">
              {assistantProcesses.map((item) => (
                <article className="app-list-item" key={item.taskId}>
                  <div>
                    <strong>{item.displayName}</strong>
                    <p className="chat-list-item__meta">PID: {item.pid ?? "неизвестен"}</p>
                    <p className="chat-list-item__meta">Task: {item.taskId}</p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
