import { useEffect, useState } from "react";

import { Sidebar, type NavigationItem } from "./layout/Sidebar";
import { BlockedTasksPage } from "./pages/BlockedTasksPage";
import { ChatsPage } from "./pages/ChatsPage";
import { KnowledgePage } from "./pages/KnowledgePage";
import { LogsPage } from "./pages/LogsPage";
import { ServicesPage } from "./pages/ServicesPage";
import { SettingsPage } from "./pages/SettingsPage";
import { TelegramChatsPage } from "./pages/TelegramChatsPage";

function ProgressBar() {
  return (
    <div className="progress-shell" aria-label="Global progress">
      <div className="progress-fill" style={{ width: "28%" }} />
    </div>
  );
}

type QuickAccessState = Awaited<
  ReturnType<NonNullable<Window["karpik"]>["getQuickAccessState"]>
>;

const emptyQuickAccessState: NonNullable<QuickAccessState> = {
  targetChat: null,
  localChatCount: 0,
  recentActivity: []
};

function QuickPopupView() {
  const [quickState, setQuickState] = useState<NonNullable<QuickAccessState>>(emptyQuickAccessState);
  const [requestText, setRequestText] = useState("");
  const [responseText, setResponseText] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isSubscribed = true;

    async function loadQuickState() {
      try {
        const nextState = await (window.karpik?.getQuickAccessState?.() ?? Promise.resolve(emptyQuickAccessState));

        if (isSubscribed && nextState !== null) {
          setQuickState(nextState);
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
        text: normalizedRequest
      });
      const nextState = await (window.karpik.getQuickAccessState?.() ?? Promise.resolve(emptyQuickAccessState));

      setQuickState(nextState ?? emptyQuickAccessState);
      setResponseText(result.detail.messages.at(-1)?.text ?? null);
      setRequestText("");
    } catch {
      setError("Не удалось выполнить quick request.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="quick-popup">
      <div className="quick-header">
        <div>
          <p className="eyebrow">Karpik</p>
          <h1>Quick Access</h1>
        </div>
        <button className="ghost-button" type="button">
          +
        </button>
      </div>

      <section className="quick-card">
        <p className="section-label">Current progress</p>
        <ProgressBar />
        <p className="muted-text">Approximate completion across running tasks: 28%</p>
      </section>

      <section className="quick-card">
        <p className="section-label">Target chat</p>
        <p className="muted-text">
          {quickState.targetChat?.title ?? "Новый локальный чат будет создан автоматически"}
        </p>
        <p className="muted-text">Local chats: {quickState.localChatCount}</p>
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
          placeholder="Send to the last active local chat"
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
