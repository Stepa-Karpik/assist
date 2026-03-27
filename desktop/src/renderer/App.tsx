import { useEffect, useMemo, useState } from "react";

import { Sidebar, type NavigationItem } from "./layout/Sidebar";
import { BlockedTasksPage } from "./pages/BlockedTasksPage";
import { ChatsPage } from "./pages/ChatsPage";
import { KnowledgePage } from "./pages/KnowledgePage";
import { LogsPage } from "./pages/LogsPage";
import { formatTaskStatus, type TaskSnapshot } from "./pages/taskSnapshot";
import { ServicesPage } from "./pages/ServicesPage";
import { SettingsPage } from "./pages/SettingsPage";
import { TelegramChatsPage } from "./pages/TelegramChatsPage";

type QuickProgressState = {
  activeTaskCount: number;
  awaitingApprovalCount: number;
  blockedTaskCount: number;
  percentage: number;
  summaryText: string;
};

type QuickAccessState = Awaited<
  ReturnType<NonNullable<Window["karpik"]>["getQuickAccessState"]>
>;

const emptyQuickAccessState: NonNullable<QuickAccessState> = {
  targetChat: null,
  localChatCount: 0,
  recentActivity: [],
  recentChats: []
};

const emptyTaskSnapshot: TaskSnapshot = [];

function buildQuickProgressState(taskSnapshot: TaskSnapshot): QuickProgressState {
  const activeTasks = taskSnapshot.filter((task) =>
    ["queued", "awaiting_auth", "running", "awaiting_local_approval", "stalled", "cancel_requested"].includes(
      task.status
    )
  );
  const awaitingApprovalCount = taskSnapshot.filter(
    (task) => task.status === "awaiting_local_approval"
  ).length;
  const blockedTaskCount = taskSnapshot.filter(
    (task) => task.status === "blocked" || task.status === "failed"
  ).length;

  if (activeTasks.length === 0) {
    return {
      activeTaskCount: 0,
      awaitingApprovalCount,
      blockedTaskCount,
      percentage: 100,
      summaryText: "Сейчас активных задач нет."
    };
  }

  const progressWeights: Record<TaskSnapshot[number]["status"], number> = {
    queued: 10,
    awaiting_auth: 25,
    awaiting_local_approval: 90,
    cancel_requested: 95,
    cancelled: 100,
    blocked: 100,
    running: 70,
    done: 100,
    failed: 100,
    stalled: 60
  };
  const averageProgress = Math.round(
    activeTasks.reduce((total, task) => total + progressWeights[task.status], 0) / activeTasks.length
  );

  return {
    activeTaskCount: activeTasks.length,
    awaitingApprovalCount,
    blockedTaskCount,
    percentage: averageProgress,
    summaryText: `Approximate completion across active tasks: ${averageProgress}%`
  };
}

function ProgressBar({ percentage }: { percentage: number }) {
  return (
    <div className="progress-shell" aria-label="Global progress">
      <div className="progress-fill" style={{ width: `${percentage}%` }} />
    </div>
  );
}

function QuickPopupView() {
  const [quickState, setQuickState] = useState<NonNullable<QuickAccessState>>(emptyQuickAccessState);
  const [taskSnapshot, setTaskSnapshot] = useState<TaskSnapshot>(emptyTaskSnapshot);
  const [selectedTargetChatId, setSelectedTargetChatId] = useState<string | null>(null);
  const [requestText, setRequestText] = useState("");
  const [responseText, setResponseText] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const quickProgress = buildQuickProgressState(taskSnapshot);
  const selectedTargetChat =
    quickState.recentChats.find((chat) => chat.chatId === selectedTargetChatId) ?? quickState.targetChat;

  const activeTasks = useMemo(
    () =>
      taskSnapshot
        .filter((task) =>
          ["queued", "awaiting_auth", "awaiting_local_approval", "running", "cancel_requested"].includes(
            task.status
          )
        )
        .slice(0, 2),
    [taskSnapshot]
  );

  const recentActivity = useMemo(() => quickState.recentActivity.slice(0, 2), [quickState.recentActivity]);

  useEffect(() => {
    setSelectedTargetChatId((currentChatId) => {
      if (currentChatId && quickState.recentChats.some((chat) => chat.chatId === currentChatId)) {
        return currentChatId;
      }

      return quickState.targetChat?.chatId ?? quickState.recentChats[0]?.chatId ?? null;
    });
  }, [quickState]);

  useEffect(() => {
    let isSubscribed = true;

    async function loadQuickState() {
      try {
        const [nextState, nextTaskSnapshot] = await Promise.all([
          window.karpik?.getQuickAccessState?.() ?? Promise.resolve(emptyQuickAccessState),
          window.karpik?.getTaskSnapshot?.() ?? Promise.resolve(emptyTaskSnapshot)
        ]);

        if (!isSubscribed || nextState === null) {
          return;
        }

        setQuickState(nextState);
        setTaskSnapshot(nextTaskSnapshot);
      } catch {
        if (isSubscribed) {
          setError("Не удалось загрузить quick access.");
        }
      }
    }

    void loadQuickState();

    return () => {
      isSubscribed = false;
    };
  }, []);

  async function handleSubmit() {
    if (!window.karpik?.submitQuickRequest) {
      setError("Quick access API недоступен в этом окружении.");
      return;
    }

    const normalizedRequest = requestText.trim();

    if (!normalizedRequest) {
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const result = await window.karpik.submitQuickRequest({
        chatId: selectedTargetChatId ?? undefined,
        text: normalizedRequest
      });
      const [nextState, nextTaskSnapshot] = await Promise.all([
        window.karpik.getQuickAccessState?.() ?? Promise.resolve(emptyQuickAccessState),
        window.karpik.getTaskSnapshot?.() ?? Promise.resolve(emptyTaskSnapshot)
      ]);

      setQuickState(nextState ?? emptyQuickAccessState);
      setTaskSnapshot(nextTaskSnapshot);
      setResponseText(result.detail.messages.at(-1)?.text ?? null);
      setRequestText("");
    } catch {
      setError("Не удалось выполнить быстрый запрос.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCreateDesktopChat() {
    if (!window.karpik?.createDesktopChat) {
      setError("API локальных чатов недоступен в этом окружении.");
      return;
    }

    setError(null);

    try {
      const createdChat = await window.karpik.createDesktopChat({
        title: "Новый локальный чат"
      });
      const nextState = await (window.karpik.getQuickAccessState?.() ?? Promise.resolve(emptyQuickAccessState));
      setQuickState(nextState ?? emptyQuickAccessState);
      setSelectedTargetChatId(createdChat.chatId);
      setResponseText(null);
      setRequestText("");
    } catch {
      setError("Не удалось создать локальный чат.");
    }
  }

  return (
    <main className="quick-popup">
      <header className="quick-popup__header">
        <div>
          <p className="eyebrow">Karpik</p>
          <h1>Quick Access</h1>
          <p className="muted-text">Локальный чат, очередь и свежая активность без лишнего шума.</p>
        </div>
        <button
          aria-label="New local chat"
          className="ghost-button ghost-button--primary"
          onClick={() => {
            void handleCreateDesktopChat();
          }}
          type="button"
        >
          +
        </button>
      </header>

      <section className="quick-panel quick-panel--stats">
        <div className="quick-stat">
          <span>Активно</span>
          <strong>{quickProgress.activeTaskCount}</strong>
        </div>
        <div className="quick-stat">
          <span>На ревью</span>
          <strong>{quickProgress.awaitingApprovalCount}</strong>
        </div>
        <div className="quick-stat">
          <span>Сбои</span>
          <strong>{quickProgress.blockedTaskCount}</strong>
        </div>
      </section>

      <section className="quick-panel">
        <div className="quick-panel__header">
          <strong>Прогресс</strong>
          <span>{quickProgress.percentage}%</span>
        </div>
        <ProgressBar percentage={quickProgress.percentage} />
        <p className="muted-text">{quickProgress.summaryText}</p>
      </section>

      <section className="quick-panel">
        <div className="quick-panel__header">
          <strong>Целевой чат</strong>
          <span>Local chats: {quickState.localChatCount}</span>
        </div>
        <label className="section-label" htmlFor="quick-target-chat">
          Выбор локального чата
        </label>
        <p className="muted-text">
          {selectedTargetChat?.title ?? "При первом сообщении будет создан новый локальный чат."}
        </p>
        {quickState.recentChats.length > 0 ? (
          <select
            aria-label="Target local chat"
            className="quick-input"
            id="quick-target-chat"
            onChange={(event) => setSelectedTargetChatId(event.target.value || null)}
            value={selectedTargetChatId ?? ""}
          >
            {quickState.recentChats.map((chat) => (
              <option key={chat.chatId} value={chat.chatId}>
                {chat.title}
              </option>
            ))}
          </select>
        ) : null}
      </section>

      <section className="quick-panel quick-panel--split">
        <div>
          <div className="quick-panel__header">
            <strong>Очередь</strong>
            <span>{activeTasks.length}</span>
          </div>
          {activeTasks.length === 0 ? (
            <p className="muted-text">Пусто</p>
          ) : (
            <div className="quick-mini-list">
              {activeTasks.map((task) => (
                <article className="quick-mini-card" key={task.task_id}>
                  <strong>{formatTaskStatus(task.status)}</strong>
                  <p>{task.intent}</p>
                </article>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="quick-panel__header">
            <strong>Активность</strong>
            <span>{recentActivity.length}</span>
          </div>
          {recentActivity.length === 0 ? (
            <p className="muted-text">Пока пусто</p>
          ) : (
            <div className="quick-mini-list">
              {recentActivity.map((entry) => (
                <article className={`quick-mini-card status-${entry.status}`} key={entry.entryId}>
                  <strong>{entry.title}</strong>
                  {entry.detail ? <p>{entry.detail}</p> : null}
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="quick-panel quick-panel--composer">
        <label className="section-label" htmlFor="quick-task">
          Быстрый запрос
        </label>
        <div className="quick-composer-row">
          <input
            aria-label="Quick request"
            className="quick-input"
            id="quick-task"
            onChange={(event) => setRequestText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void handleSubmit();
              }
            }}
            placeholder="Напиши задачу обычным языком"
            type="text"
            value={requestText}
          />
          <button
            className="ghost-button ghost-button--primary"
            disabled={isSubmitting || requestText.trim().length === 0}
            onClick={() => {
              void handleSubmit();
            }}
            type="button"
          >
            {isSubmitting ? "..." : "Send"}
          </button>
        </div>
        {responseText ? <p className="task-result">{responseText}</p> : null}
        {error ? <p className="task-error">{error}</p> : null}
      </section>
    </main>
  );
}

const navigationItems: NavigationItem[] = [
  { id: "chats", label: "Чаты" },
  { id: "telegram", label: "Чаты Telegram" },
  { id: "blocked", label: "Невыполненное" },
  { id: "knowledge", label: "Knowledge / Review" },
  { id: "logs", label: "Логи" },
  { id: "services", label: "Сервисы" },
  { id: "settings", label: "Настройки" }
];

function MainWindowView() {
  const [activeSection, setActiveSection] = useState<NavigationItem["id"]>("chats");
  const [selectedLocalChatId, setSelectedLocalChatId] = useState<string | null>(null);

  return (
    <main className="desktop-layout">
      <Sidebar activeSection={activeSection} items={navigationItems} onSelect={setActiveSection} />
      <section className="content-panel">
        {activeSection === "chats" && (
          <ChatsPage onSelectChat={setSelectedLocalChatId} selectedChatId={selectedLocalChatId} />
        )}
        {activeSection === "telegram" && (
          <TelegramChatsPage
            onContinueToLocalChats={(chatId) => {
              setSelectedLocalChatId(chatId);
              setActiveSection("chats");
            }}
          />
        )}
        {activeSection === "blocked" && <BlockedTasksPage />}
        {activeSection === "knowledge" && <KnowledgePage />}
        {activeSection === "logs" && <LogsPage />}
        {activeSection === "services" && <ServicesPage />}
        {activeSection === "settings" && <SettingsPage />}
      </section>
    </main>
  );
}

export default function App() {
  const view = window.karpik?.view ?? "main";

  if (view === "quick-popup") {
    return <QuickPopupView />;
  }

  return <MainWindowView />;
}
