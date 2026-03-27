import { useEffect, useMemo, useState } from "react";

import { Sidebar, type NavigationItem } from "./layout/Sidebar";
import { ApplicationsPage } from "./pages/ApplicationsPage";
import { BlockedTasksPage } from "./pages/BlockedTasksPage";
import { ChatsPage } from "./pages/ChatsPage";
import { HomePage } from "./pages/HomePage";
import { KnowledgePage } from "./pages/KnowledgePage";
import { LogsPage } from "./pages/LogsPage";
import { ProfilePage } from "./pages/ProfilePage";
import { ServicesPage } from "./pages/ServicesPage";
import { SettingsPage } from "./pages/SettingsPage";
import { TelegramChatsPage } from "./pages/TelegramChatsPage";
import { formatTaskStatus, type TaskSnapshot } from "./pages/taskSnapshot";

type QuickAccessState = Awaited<
  ReturnType<NonNullable<Window["karpik"]>["getQuickAccessState"]>
>;
type OwnerProfileState = Awaited<
  ReturnType<NonNullable<Window["karpik"]>["getOwnerProfileState"]>
>;

const emptyQuickAccessState: NonNullable<QuickAccessState> = {
  targetChat: null,
  localChatCount: 0,
  recentActivity: [],
  recentChats: []
};

const emptyTaskSnapshot: TaskSnapshot = [];

const navigationItems: NavigationItem[] = [
  { id: "home", label: "Главная" },
  { id: "chats", label: "Чаты" },
  { id: "telegram", label: "Чаты Telegram" },
  { id: "blocked", label: "Задачи" },
  { id: "applications", label: "Приложения" },
  { id: "knowledge", label: "Knowledge / Review" },
  { id: "logs", label: "Логи" },
  { id: "services", label: "Сервисы" },
  { id: "profile", label: "Профиль" },
  { id: "settings", label: "Настройки" }
];

function estimateActiveTaskProgress(snapshot: TaskSnapshot): number | null {
  const progressByStatus: Record<string, number> = {
    queued: 0.1,
    awaiting_auth: 0.45,
    running: 0.65,
    awaiting_local_approval: 0.95,
    cancel_requested: 0.9
  };
  const activeTasks = snapshot.filter((task) => task.status in progressByStatus);

  if (activeTasks.length === 0) {
    return null;
  }

  const averageProgress =
    activeTasks.reduce((sum, task) => sum + progressByStatus[task.status], 0) / activeTasks.length;
  return Math.round(averageProgress * 100);
}

function QuickPopupView() {
  const [quickState, setQuickState] = useState<NonNullable<QuickAccessState>>(emptyQuickAccessState);
  const [taskSnapshot, setTaskSnapshot] = useState<TaskSnapshot>(emptyTaskSnapshot);
  const [selectedTargetChatId, setSelectedTargetChatId] = useState<string | null>(null);
  const [requestText, setRequestText] = useState("");
  const [responseText, setResponseText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreatingChat, setIsCreatingChat] = useState(false);

  const activeTask = useMemo(
    () =>
      taskSnapshot.find((task) =>
        ["queued", "running", "awaiting_auth", "awaiting_local_approval", "cancel_requested"].includes(task.status)
      ) ?? null,
    [taskSnapshot]
  );
  const recentActivity = quickState.recentActivity[0] ?? null;
  const selectedTargetChat =
    quickState.recentChats.find((chat) => chat.chatId === selectedTargetChatId) ?? quickState.targetChat;
  const activeTaskProgress = estimateActiveTaskProgress(taskSnapshot);

  async function loadQuickState() {
    const [nextState, nextTaskSnapshot] = await Promise.all([
      window.karpik?.getQuickAccessState?.() ?? Promise.resolve(emptyQuickAccessState),
      window.karpik?.getTaskSnapshot?.() ?? Promise.resolve(emptyTaskSnapshot)
    ]);

    setQuickState(nextState ?? emptyQuickAccessState);
    setTaskSnapshot(nextTaskSnapshot);
    setSelectedTargetChatId((currentChatId) => {
      if (currentChatId && nextState?.recentChats.some((chat) => chat.chatId === currentChatId)) {
        return currentChatId;
      }

      return nextState?.targetChat?.chatId ?? nextState?.recentChats[0]?.chatId ?? null;
    });
  }

  useEffect(() => {
    let isSubscribed = true;

    void loadQuickState().catch(() => {
      if (isSubscribed) {
        setError("Не удалось загрузить быстрый доступ.");
      }
    });

    return () => {
      isSubscribed = false;
    };
  }, []);

  async function handleCreateChat() {
    if (!window.karpik?.createDesktopChat) {
      setError("Local chat API недоступен в этом окружении.");
      return;
    }

    setIsCreatingChat(true);
    setError(null);

    try {
      const nextChat = await window.karpik.createDesktopChat({
        title: "Новый локальный чат"
      });
      await loadQuickState();
      setSelectedTargetChatId(nextChat.chatId);
    } catch {
      setError("Не удалось создать локальный чат.");
    } finally {
      setIsCreatingChat(false);
    }
  }

  async function handleSubmit() {
    if (!window.karpik?.submitQuickRequest) {
      setError("Quick access API недоступен в этом окружении.");
      return;
    }

    const normalizedRequest = requestText.trim();

    if (!normalizedRequest) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await window.karpik.submitQuickRequest({
        chatId: selectedTargetChatId ?? undefined,
        text: normalizedRequest
      });

      setResponseText(result.detail.messages.at(-1)?.text ?? null);
      setRequestText("");
      await loadQuickState();
    } catch {
      setError("Не удалось отправить быстрый запрос.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="quick-popup">
      <section className="quick-popup__card">
        <header className="quick-popup__header">
          <div>
            <p className="eyebrow">Karpik</p>
            <h1>Быстрый доступ</h1>
          </div>
          <button
            aria-label="New local chat"
            className="quick-popup__header-action"
            disabled={isCreatingChat}
            onClick={() => {
              void handleCreateChat();
            }}
            type="button"
          >
            +
          </button>
        </header>

        <div className="quick-popup__body">
          <article className="quick-popup__surface">
            <span className="section-label">Чат</span>
            {quickState.recentChats.length > 0 ? (
              <>
                <label className="sr-only" htmlFor="quick-popup-target-chat">
                  Target local chat
                </label>
                <select
                  aria-label="Target local chat"
                  className="quick-popup__select"
                  id="quick-popup-target-chat"
                  onChange={(event) => setSelectedTargetChatId(event.target.value || null)}
                  value={selectedTargetChatId ?? ""}
                >
                  {quickState.recentChats.map((chat) => (
                    <option key={chat.chatId} value={chat.chatId}>
                      {chat.title}
                    </option>
                  ))}
                </select>
                <p className="muted-text">{selectedTargetChat?.referenceLabel ?? "Быстрый запрос уйдёт в выбранный локальный чат."}</p>
              </>
            ) : (
              <>
                <strong>Новый локальный чат</strong>
                <p className="muted-text">Создай первый локальный чат и отправь запрос отсюда.</p>
              </>
            )}
          </article>

          <article className="quick-popup__surface quick-popup__surface--metrics">
            <div>
              <span className="section-label">Активность</span>
              <strong>{activeTask ? formatTaskStatus(activeTask.status) : "Готов"}</strong>
            </div>
            <div className="quick-popup__metric-stack">
              <p>{activeTask ? activeTask.intent : "Нет активных задач"}</p>
              <p>{`Всего: ${quickState.localChatCount}`}</p>
            </div>
          </article>

          {activeTaskProgress !== null ? (
            <article className="quick-popup__surface">
              <span className="section-label">Прогресс</span>
              <strong>{`Грубая оценка прогресса по активным задачам: ${activeTaskProgress}%`}</strong>
            </article>
          ) : null}

          {recentActivity ? (
            <article className="quick-popup__surface">
              <span className="section-label">Последнее событие</span>
              <strong>{recentActivity.title}</strong>
              <p className="muted-text">{recentActivity.detail ?? "Без деталей"}</p>
            </article>
          ) : null}

          <article className="quick-popup__composer">
            <label className="sr-only" htmlFor="quick-popup-request">
              Quick request
            </label>
            <textarea
              aria-label="Quick request"
              className="quick-popup__input"
              id="quick-popup-request"
              onChange={(event) => setRequestText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void handleSubmit();
                }
              }}
              placeholder="Что сделать?"
              rows={2}
              value={requestText}
            />
            <button
              aria-label="Send"
              className="quick-popup__submit"
              disabled={isSubmitting || requestText.trim().length === 0}
              onClick={() => {
                void handleSubmit();
              }}
              type="button"
            >
              ↑
            </button>
          </article>
        </div>

        {responseText ? <p className="task-result">{responseText}</p> : null}
        {error ? <p className="task-error">{error}</p> : null}
      </section>
    </main>
  );
}

function MainWindowView() {
  const [activeSection, setActiveSection] = useState<NavigationItem["id"]>("home");
  const [selectedLocalChatId, setSelectedLocalChatId] = useState<string | null>(null);
  const [ownerProfile, setOwnerProfile] = useState<OwnerProfileState | null>(null);

  useEffect(() => {
    let isSubscribed = true;

    async function loadOwnerProfile() {
      try {
        const nextProfile = await (window.karpik?.getOwnerProfileState?.() ?? Promise.resolve(null));

        if (isSubscribed) {
          setOwnerProfile(nextProfile);
        }
      } catch {
        if (isSubscribed) {
          setOwnerProfile(null);
        }
      }
    }

    void loadOwnerProfile();

    return () => {
      isSubscribed = false;
    };
  }, []);

  async function handleSaveOwnerProfile(payload: Partial<NonNullable<OwnerProfileState>>) {
    if (!window.karpik?.saveOwnerProfile) {
      throw new Error("Owner profile API недоступен в этом окружении.");
    }

    const nextState = await window.karpik.saveOwnerProfile(payload);
    setOwnerProfile(nextState);
    return nextState;
  }

  return (
    <main className="desktop-layout">
      <Sidebar activeSection={activeSection} items={navigationItems} onSelect={setActiveSection} />
      <section className="content-panel">
        {activeSection === "home" && <HomePage ownerProfile={ownerProfile} onOpenSection={setActiveSection} />}
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
        {activeSection === "applications" && <ApplicationsPage />}
        {activeSection === "knowledge" && <KnowledgePage />}
        {activeSection === "logs" && <LogsPage />}
        {activeSection === "services" && <ServicesPage />}
        {activeSection === "profile" && <ProfilePage onSave={handleSaveOwnerProfile} profile={ownerProfile} />}
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
