import { type ReactElement, useEffect, useMemo, useState } from "react";

import { CorePagesShell } from "./layout/CorePagesShell";
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
import {
  buildPairingFallbackCommand,
  buildPairingStartLink,
  telegramBotHandle
} from "./pairingInstructions";
import { formatTaskStatus, type TaskSnapshot } from "./pages/taskSnapshot";

type QuickAccessState = Awaited<
  ReturnType<NonNullable<Window["karpik"]>["getQuickAccessState"]>
>;
type OwnerProfileState = Awaited<
  ReturnType<NonNullable<Window["karpik"]>["getOwnerProfileState"]>
>;
type OnboardingState = Awaited<
  ReturnType<NonNullable<Window["karpik"]>["getOnboardingState"]>
>;

const emptyQuickAccessState: NonNullable<QuickAccessState> = {
  targetChat: null,
  localChatCount: 0,
  recentActivity: [],
  recentChats: []
};

const emptyTaskSnapshot: TaskSnapshot = [];
const emptyOwnerProfile: NonNullable<OwnerProfileState> = {
  fullName: null,
  gender: null,
  age: null,
  city: null,
  timezone: null,
  language: null,
  contacts: null,
  occupation: null,
  bio: null,
  notes: null
};

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

  async function handleCreateDesktopChat() {
    if (!window.karpik?.createDesktopChat) {
      return;
    }

    try {
      const nextChat = await window.karpik.createDesktopChat({
        title: "Новый локальный чат"
      });
      setSelectedLocalChatId(nextChat.chatId);
      setActiveSection("chats");
    } catch {
      setActiveSection("chats");
    }
  }

  const isCoreSection =
    activeSection === "home" ||
    activeSection === "chats" ||
    activeSection === "telegram" ||
    activeSection === "blocked";

  let sectionView: ReactElement | null = null;

  if (activeSection === "home") {
    sectionView = <HomePage ownerProfile={ownerProfile} onOpenSection={setActiveSection} />;
  } else if (activeSection === "chats") {
    sectionView = <ChatsPage onSelectChat={setSelectedLocalChatId} selectedChatId={selectedLocalChatId} />;
  } else if (activeSection === "telegram") {
    sectionView = (
      <TelegramChatsPage
        onContinueToLocalChats={(chatId) => {
          setSelectedLocalChatId(chatId);
          setActiveSection("chats");
        }}
      />
    );
  } else if (activeSection === "blocked") {
    sectionView = <BlockedTasksPage />;
  } else if (activeSection === "applications") {
    sectionView = <ApplicationsPage />;
  } else if (activeSection === "knowledge") {
    sectionView = <KnowledgePage />;
  } else if (activeSection === "logs") {
    sectionView = <LogsPage />;
  } else if (activeSection === "services") {
    sectionView = <ServicesPage />;
  } else if (activeSection === "profile") {
    sectionView = <ProfilePage onSave={handleSaveOwnerProfile} profile={ownerProfile} />;
  } else if (activeSection === "settings") {
    sectionView = <SettingsPage />;
  }

  return (
    <main className="desktop-layout">
      <Sidebar activeSection={activeSection} items={navigationItems} onSelect={setActiveSection} />
      <section className="content-panel">
        {isCoreSection ? (
          <CorePagesShell
            activeSection={activeSection}
            onCreateChat={() => {
              void handleCreateDesktopChat();
            }}
            onOpenTasks={() => setActiveSection("blocked")}
          >
            {sectionView}
          </CorePagesShell>
        ) : (
          sectionView
        )}
      </section>
    </main>
  );
}

function OnboardingView({
  initialProfile,
  onComplete
}: {
  initialProfile: NonNullable<OwnerProfileState> | null;
  onComplete: () => Promise<void>;
}) {
  const [draft, setDraft] = useState<NonNullable<OwnerProfileState>>(initialProfile ?? emptyOwnerProfile);
  const [pairingState, setPairingState] = useState({
    code: null as string | null,
    expiresAt: null as string | null,
    isActive: false,
    trustedTelegramUserIds: [] as number[]
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isOpeningPairing, setIsOpeningPairing] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    let isSubscribed = true;

    async function loadState() {
      try {
        const [nextProfile, nextPairing] = await Promise.all([
          window.karpik?.getOwnerProfileState?.() ?? Promise.resolve(null),
          window.karpik?.getPairingState?.() ??
            Promise.resolve({
              code: null,
              expiresAt: null,
              isActive: false,
              trustedTelegramUserIds: []
            })
        ]);

        if (!isSubscribed) {
          return;
        }

        setDraft((current) => ({
          ...current,
          ...(nextProfile ?? {})
        }));
        setPairingState(nextPairing);
      } catch {
        if (isSubscribed) {
          setError("Не удалось загрузить стартовое состояние устройства.");
        }
      } finally {
        if (isSubscribed) {
          setIsLoading(false);
        }
      }
    }

    void loadState();

    return () => {
      isSubscribed = false;
    };
  }, []);

  useEffect(() => {
    let isSubscribed = true;

    async function refreshPairingState() {
      try {
        const nextPairingState =
          (await window.karpik?.getPairingState?.()) ??
          ({
            code: null,
            expiresAt: null,
            isActive: false,
            trustedTelegramUserIds: []
          } as const);

        if (isSubscribed) {
          setPairingState(nextPairingState);
        }
      } catch {
        // Keep the last known state if the background refresh fails.
      }
    }

    const intervalId = window.setInterval(() => {
      void refreshPairingState();
    }, 2000);

    return () => {
      isSubscribed = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const canContinue =
    draft.fullName !== null &&
    draft.fullName.trim().length > 0 &&
    pairingState.trustedTelegramUserIds.length > 0;
  const pairingStartLink =
    pairingState.isActive && pairingState.code ? buildPairingStartLink(pairingState.code) : null;
  const pairingFallbackCommand =
    pairingState.isActive && pairingState.code
      ? buildPairingFallbackCommand(pairingState.code)
      : null;

  async function handleSaveProfile() {
    if (!window.karpik?.saveOwnerProfile) {
      setError("Owner profile API недоступен в этом окружении.");
      return;
    }

    setIsSavingProfile(true);
    setError(null);
    setFeedback(null);

    try {
      const nextProfile = await window.karpik.saveOwnerProfile(draft);
      setDraft(nextProfile);
      setFeedback("Профиль устройства сохранён.");
    } catch {
      setError("Не удалось сохранить профиль устройства.");
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleOpenPairing() {
    if (!window.karpik?.openPairingSession) {
      setError("Pairing API недоступен в этом окружении.");
      return;
    }

    setIsOpeningPairing(true);
    setError(null);
    setFeedback(null);

    try {
      const nextState = await window.karpik.openPairingSession();
      setPairingState(nextState);
      setFeedback("Pairing-код обновлён. Используй /start-ссылку или fallback-команду /pair.");
    } catch {
      setError("Не удалось открыть pairing-сессию.");
    } finally {
      setIsOpeningPairing(false);
    }
  }

  async function handleContinue() {
    if (!window.karpik?.completeOnboarding) {
      setError("Onboarding API недоступен в этом окружении.");
      return;
    }

    setIsCompleting(true);
    setError(null);

    try {
      await window.karpik.completeOnboarding();
      await onComplete();
    } catch {
      setError("Не удалось завершить первичную настройку.");
    } finally {
      setIsCompleting(false);
    }
  }

  if (isLoading) {
    return (
      <main className="desktop-layout desktop-layout--standalone">
        <section className="page-shell">
          <p className="muted-text">Загрузка первичной настройки...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="desktop-layout desktop-layout--standalone">
      <section className="page-shell profile-shell">
        <div className="page-header profile-shell__header">
          <div>
            <p className="eyebrow">Первый запуск</p>
            <h2>Первичная настройка устройства</h2>
            <p className="muted-text">
              Этот экран показывается после новой установки. Устройство остаётся тем же, поэтому
              существующая привязка Telegram к этому ПК не теряется.
            </p>
          </div>
        </div>

        <div className="profile-layout">
          <article className="profile-card profile-form">
            <label>
              <span>ФИО</span>
              <input value={draft.fullName ?? ""} onChange={(event) => setDraft((current) => ({ ...current, fullName: event.target.value || null }))} />
            </label>
            <label>
              <span>Пол</span>
              <input value={draft.gender ?? ""} onChange={(event) => setDraft((current) => ({ ...current, gender: event.target.value || null }))} />
            </label>
            <label>
              <span>Возраст</span>
              <input
                type="number"
                value={draft.age ?? ""}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    age: event.target.value.trim().length === 0 ? null : Number(event.target.value)
                  }))
                }
              />
            </label>
            <label>
              <span>Город</span>
              <input value={draft.city ?? ""} onChange={(event) => setDraft((current) => ({ ...current, city: event.target.value || null }))} />
            </label>
            <div className="profile-shell__actions">
              <button className="shell-primary-button" disabled={isSavingProfile} onClick={() => void handleSaveProfile()} type="button">
                {isSavingProfile ? "Сохраняем..." : "Сохранить профиль"}
              </button>
            </div>
          </article>

          <article className="profile-card">
            <p className="section-label">Telegram pairing</p>
            {pairingState.trustedTelegramUserIds.length > 0 ? (
              <p className="task-success">Этот ПК уже привязан к Telegram. При желании можно открыть новый pairing-код.</p>
            ) : (
              <p className="muted-text">
                Свяжи этот ПК с Telegram через {telegramBotHandle}. Можно использовать ссылку вида{" "}
                <code>/start pair_код</code>, а если deep-link недоступен, выполнить <code>/pair код</code>.
              </p>
            )}
            <p>{pairingState.isActive && pairingState.code ? `Код: ${pairingState.code}` : "Pairing не активен"}</p>
            {pairingState.expiresAt ? <p className="muted-text">Действует до: {new Date(pairingState.expiresAt).toLocaleString("ru-RU")}</p> : null}
            <p className="muted-text">Доверенные Telegram ID: {pairingState.trustedTelegramUserIds.length}</p>
            {pairingStartLink !== null ? <p className="muted-text">Быстрый старт: {pairingStartLink}</p> : null}
            {pairingFallbackCommand !== null ? <p className="muted-text">Резервная команда: {pairingFallbackCommand}</p> : null}
            <div className="profile-shell__actions">
              <button className="shell-secondary-button" disabled={isOpeningPairing} onClick={() => void handleOpenPairing()} type="button">
                {isOpeningPairing ? "Открываем..." : "Открыть pairing"}
              </button>
              <button className="shell-primary-button" disabled={!canContinue || isCompleting} onClick={() => void handleContinue()} type="button">
                {isCompleting ? "Продолжаем..." : "Продолжить в приложение"}
              </button>
            </div>
            {!canContinue ? (
              <p className="muted-text">
                Для входа в приложение сохрани профиль и убедись, что Telegram уже привязан к этому ПК.
              </p>
            ) : null}
          </article>
        </div>

        {feedback ? <p className="task-success">{feedback}</p> : null}
        {error ? <p className="task-error">{error}</p> : null}
      </section>
    </main>
  );
}

export default function App() {
  const view = window.karpik?.view ?? "main";
  const [onboardingState, setOnboardingState] = useState<OnboardingState | null>(null);
  const [isOnboardingLoading, setIsOnboardingLoading] = useState(view === "main");
  const [cachedProfile, setCachedProfile] = useState<NonNullable<OwnerProfileState> | null>(null);

  useEffect(() => {
    document.body.dataset.karpikView = view;

    return () => {
      delete document.body.dataset.karpikView;
    };
  }, [view]);

  useEffect(() => {
    if (view !== "main") {
      setIsOnboardingLoading(false);
      return;
    }

    let isSubscribed = true;

    async function loadOnboardingState() {
      try {
        const [nextOnboardingState, nextProfile] = await Promise.all([
          window.karpik?.getOnboardingState?.() ?? Promise.resolve(null),
          window.karpik?.getOwnerProfileState?.() ?? Promise.resolve(null)
        ]);

        if (!isSubscribed) {
          return;
        }

        setOnboardingState(nextOnboardingState);
        setCachedProfile(nextProfile ?? null);
      } finally {
        if (isSubscribed) {
          setIsOnboardingLoading(false);
        }
      }
    }

    void loadOnboardingState();

    return () => {
      isSubscribed = false;
    };
  }, [view]);

  if (view === "quick-popup") {
    return <QuickPopupView />;
  }

  if (isOnboardingLoading) {
    return (
      <main className="desktop-layout desktop-layout--standalone">
        <section className="page-shell">
          <p className="muted-text">Загрузка приложения...</p>
        </section>
      </main>
    );
  }

  if (onboardingState?.requiresOnboarding) {
    return (
      <OnboardingView
        initialProfile={cachedProfile}
        onComplete={async () => {
          const nextOnboardingState = await (window.karpik?.getOnboardingState?.() ?? Promise.resolve(null));
          setOnboardingState(nextOnboardingState);
        }}
      />
    );
  }

  return <MainWindowView />;
}
