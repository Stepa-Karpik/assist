import { useEffect, useMemo, useState } from "react";

import type { NavigationItem } from "../layout/Sidebar";
import designLogo from "../assets/design-logo.png";
import { formatTaskStatus, type TaskSnapshot } from "./taskSnapshot";

type HomePageProps = {
  ownerProfile: NonNullable<Awaited<ReturnType<NonNullable<Window["karpik"]>["getOwnerProfileState"]>>> | null;
  onOpenSection: (section: NavigationItem["id"]) => void;
};

type RuntimeStatus = Awaited<ReturnType<NonNullable<Window["karpik"]>["getRuntimeStatus"]>>;
type ActivityLogEntry = Awaited<ReturnType<NonNullable<Window["karpik"]>["getActivityLog"]>>[number];

const emptySnapshot: TaskSnapshot = [];

function getDisplayName(profile: HomePageProps["ownerProfile"]): string {
  const fullName = profile?.fullName?.trim();

  if (!fullName) {
    return "оператор";
  }

  return fullName.split(/\s+/)[0] ?? fullName;
}

export function HomePage({ ownerProfile, onOpenSection }: HomePageProps) {
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus | null>(null);
  const [taskSnapshot, setTaskSnapshot] = useState<TaskSnapshot>(emptySnapshot);
  const [activity, setActivity] = useState<ActivityLogEntry[]>([]);
  const [requestText, setRequestText] = useState("");
  const [responseText, setResponseText] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeTasks = useMemo(
    () =>
      taskSnapshot.filter((task) =>
        ["queued", "running", "awaiting_auth", "awaiting_local_approval"].includes(task.status)
      ),
    [taskSnapshot]
  );
  const highlightedActivity = activity.slice(0, 3);
  const greetingName = getDisplayName(ownerProfile);

  useEffect(() => {
    let isSubscribed = true;

    async function loadHomeState() {
      try {
        const [nextRuntimeStatus, nextSnapshot, nextActivity] = await Promise.all([
          window.karpik?.getRuntimeStatus?.() ?? Promise.resolve(null),
          window.karpik?.getTaskSnapshot?.() ?? Promise.resolve(emptySnapshot),
          window.karpik?.getActivityLog?.() ?? Promise.resolve([])
        ]);

        if (!isSubscribed) {
          return;
        }

        setRuntimeStatus(nextRuntimeStatus);
        setTaskSnapshot(nextSnapshot);
        setActivity(nextActivity);
      } catch {
        if (isSubscribed) {
          setErrorText("Не удалось загрузить состояние главной страницы.");
        }
      }
    }

    void loadHomeState();

    return () => {
      isSubscribed = false;
    };
  }, []);

  async function handleSubmit() {
    if (!window.karpik?.submitQuickRequest) {
      setErrorText("Quick access API недоступен в этом окружении.");
      return;
    }

    const normalizedText = requestText.trim();

    if (!normalizedText) {
      return;
    }

    setIsSubmitting(true);
    setErrorText(null);

    try {
      const result = await window.karpik.submitQuickRequest({
        text: normalizedText
      });
      setResponseText(result.detail.messages.at(-1)?.text ?? null);
      setRequestText("");
      onOpenSection("chats");
    } catch {
      setErrorText("Не удалось отправить быстрый запрос.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCreateChat() {
    if (!window.karpik?.createDesktopChat) {
      setErrorText("Local chat API недоступен в этом окружении.");
      return;
    }

    setErrorText(null);

    try {
      await window.karpik.createDesktopChat({
        title: "Новый локальный чат"
      });
      onOpenSection("chats");
    } catch {
      setErrorText("Не удалось создать локальный чат.");
    }
  }

  return (
    <section className="home-shell">
      <header className="shell-topbar">
        <div className="shell-topbar__spacer" />
        <div className="shell-topbar__actions">
          <label className="shell-search" htmlFor="desktop-shell-search">
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path
                d="M11 18a7 7 0 1 1 0-14a7 7 0 0 1 0 14Zm8 2l-4.2-4.2"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="1.8"
              />
            </svg>
            <input id="desktop-shell-search" placeholder="Поиск" type="search" />
          </label>
          <button className="shell-pill-button" onClick={() => onOpenSection("blocked")} type="button">
            Задачи
          </button>
          <button className="shell-primary-button" onClick={() => void handleCreateChat()} type="button">
            Новый чат
          </button>
        </div>
      </header>

      <div className="home-hero">
        <div className="home-hero__glow" aria-hidden="true" />
        <img alt="" className="home-hero__orb" src={designLogo} />
        <h1 className="home-hero__title">
          Доброе утро, <span>{greetingName}</span>
          <br />
          Чем помочь сегодня?
        </h1>

        <div className="home-composer-card">
          <textarea
            aria-label="Быстрый запрос"
            className="home-composer-card__input"
            onChange={(event) => setRequestText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void handleSubmit();
              }
            }}
            placeholder="Спросите о чем нибудь или расскажите как прошел ваш день!"
            rows={3}
            value={requestText}
          />
          <div className="home-composer-card__actions">
            <button className="shell-secondary-button" onClick={() => onOpenSection("chats")} type="button">
              Прикрепить
            </button>
            <button
              aria-label="Отправить запрос"
              className="home-composer-card__submit"
              disabled={isSubmitting || requestText.trim().length === 0}
              onClick={() => void handleSubmit()}
              type="button"
            >
              ↑
            </button>
          </div>
        </div>

        {responseText ? <p className="home-hero__response">{responseText}</p> : null}
        {errorText ? <p className="task-error">{errorText}</p> : null}
      </div>

      <section className="home-summary-grid">
        <article className="home-summary-card">
          <p className="home-summary-card__label">Статус ПК</p>
          <strong>{runtimeStatus?.serverHeartbeatReachable ? "Онлайн" : "Оффлайн"}</strong>
          <span>{runtimeStatus?.deviceId ?? "desktop-local"}</span>
        </article>
        <article className="home-summary-card">
          <p className="home-summary-card__label">Активные задачи</p>
          <strong>{activeTasks.length}</strong>
          <span>{runtimeStatus?.blockedTaskCount ?? 0} требуют внимания</span>
        </article>
        <article className="home-summary-card">
          <p className="home-summary-card__label">Рабочее окружение</p>
          <strong>{runtimeStatus?.defaultWorkspaceName ?? "Не выбрано"}</strong>
          <span>{runtimeStatus?.workspaceCount ?? 0} workspace</span>
        </article>
      </section>

      <section className="home-panels">
        <article className="home-panel">
          <div className="home-panel__header">
            <h2>Последние действия</h2>
          </div>
          {highlightedActivity.length === 0 ? (
            <p className="muted-text">Пока нет последних действий.</p>
          ) : (
            <div className="home-activity-list">
              {highlightedActivity.map((entry) => (
                <article className={`home-activity-item status-${entry.status}`} key={entry.entryId}>
                  <strong>{entry.title}</strong>
                  {entry.detail ? <p>{entry.detail}</p> : null}
                </article>
              ))}
            </div>
          )}
        </article>

        <article className="home-panel">
          <div className="home-panel__header">
            <h2>Активные задачи</h2>
          </div>
          {activeTasks.length === 0 ? (
            <p className="muted-text">Сейчас нет активных задач.</p>
          ) : (
            <div className="home-task-list">
              {activeTasks.slice(0, 3).map((task) => (
                <article className="home-task-item" key={task.task_id}>
                  <strong>{formatTaskStatus(task.status)}</strong>
                  <p>{task.intent}</p>
                </article>
              ))}
            </div>
          )}
        </article>
      </section>
    </section>
  );
}
