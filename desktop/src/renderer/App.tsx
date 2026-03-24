import { useEffect, useState } from "react";

import { Sidebar, type NavigationItem } from "./layout/Sidebar";
import { BlockedTasksPage } from "./pages/BlockedTasksPage";
import { ChatsPage } from "./pages/ChatsPage";
import { KnowledgePage } from "./pages/KnowledgePage";
import { LogsPage } from "./pages/LogsPage";
import type { TaskSnapshot } from "./pages/taskSnapshot";
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

function ProgressBar({ percentage }: { percentage: number }) {
  return (
    <div className="progress-shell" aria-label="Global progress">
      <div className="progress-fill" style={{ width: `${percentage}%` }} />
    </div>
  );
}

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
    ["queued", "awaiting_auth", "running", "awaiting_local_approval", "stalled"].includes(task.status)
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
      summaryText: "No active tasks right now."
    };
  }

  const progressWeights: Record<TaskSnapshot[number]["status"], number> = {
    queued: 10,
    awaiting_auth: 25,
    awaiting_local_approval: 90,
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

        if (isSubscribed && nextState !== null) {
          setQuickState(nextState);
          setTaskSnapshot(nextTaskSnapshot);
        }
      } catch {
        if (isSubscribed) {
          setError("Не удалось загрузить quick access state.");
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
      setError("Не удалось выполнить quick request.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCreateDesktopChat() {
    if (!window.karpik?.createDesktopChat) {
      setError("Local chat API РЅРµРґРѕСЃС‚СѓРїРµРЅ РІ СЌС‚РѕРј РѕРєСЂСѓР¶РµРЅРёРё.");
      return;
    }

    setError(null);

    try {
      const createdChat = await window.karpik.createDesktopChat();
      const nextState = await (window.karpik.getQuickAccessState?.() ?? Promise.resolve(emptyQuickAccessState));
      setQuickState(nextState ?? emptyQuickAccessState);
      setSelectedTargetChatId(createdChat.chatId);
      setResponseText(null);
      setRequestText("");
    } catch {
      setError("РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕР·РґР°С‚СЊ Р»РѕРєР°Р»СЊРЅС‹Р№ С‡Р°С‚.");
    }
  }

  return (
    <main className="quick-popup">
      <div className="quick-header">
        <div>
          <p className="eyebrow">Karpik</p>
          <h1>Quick Access</h1>
        </div>
        <button
          aria-label="New local chat"
          className="ghost-button"
          onClick={() => {
            void handleCreateDesktopChat();
          }}
          type="button"
        >
          +
        </button>
      </div>

      <section className="quick-card">
        <p className="section-label">Current progress</p>
        <ProgressBar percentage={quickProgress.percentage} />
        <p className="muted-text">{quickProgress.summaryText}</p>
        <p className="muted-text">Active tasks: {quickProgress.activeTaskCount}</p>
        <p className="muted-text">Needs review: {quickProgress.awaitingApprovalCount}</p>
        <p className="muted-text">Blocked or failed: {quickProgress.blockedTaskCount}</p>
      </section>

      <section className="quick-card">
        <p className="section-label">Target chat</p>
        <p className="muted-text">
          {selectedTargetChat?.title ?? "Новый локальный чат будет создан автоматически"}
        </p>
        {quickState.targetChat && selectedTargetChat?.chatId !== quickState.targetChat.chatId ? (
          <p className="muted-text">Last active chat: {quickState.targetChat.title}</p>
        ) : null}
        <p className="muted-text">Local chats: {quickState.localChatCount}</p>
        {quickState.recentChats.length > 0 ? (
          <>
            <label className="section-label" htmlFor="quick-target-chat">
              Target local chat
            </label>
            <select
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
          </>
        ) : null}
      </section>

      <section className="quick-card">
        <p className="section-label">Recent activity</p>
        {quickState.recentActivity.length === 0 ? (
          <p className="muted-text">No recent runtime activity yet.</p>
        ) : (
          quickState.recentActivity.map((entry) => (
            <article className="task-card" key={entry.entryId}>
              <div className="task-card-header">
                <strong>{entry.title}</strong>
                <span>{entry.status}</span>
              </div>
              {entry.detail ? <p className="muted-text">{entry.detail}</p> : null}
            </article>
          ))
        )}
      </section>

      <section className="quick-card">
        <label className="section-label" htmlFor="quick-task">
          Quick request
        </label>
        <input
          className="quick-input"
          id="quick-task"
          onChange={(event) => setRequestText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void handleSubmit();
            }
          }}
          placeholder="Send to the selected local chat"
          type="text"
          value={requestText}
        />
        <div className="local-chat-actions">
          <button
            className="ghost-button"
            disabled={isSubmitting || requestText.trim().length === 0}
            onClick={() => {
              void handleSubmit();
            }}
            type="button"
          >
            {isSubmitting ? "Sending..." : "Send"}
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
      <Sidebar
        activeSection={activeSection}
        items={navigationItems}
        onSelect={setActiveSection}
      />
      <section className="content-panel">
        {activeSection === "chats" && (
          <ChatsPage
            onSelectChat={setSelectedLocalChatId}
            selectedChatId={selectedLocalChatId}
          />
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
