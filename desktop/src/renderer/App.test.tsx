import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import type { TaskSnapshot } from "./pages/taskSnapshot";

type LocalChatItem = {
  chatId: string;
  source: "desktop_chat" | "local_continuation_chat";
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  referenceLabel: string | null;
  telegramChatId: number | null;
  workspaceId: string | null;
};

type LocalChatMessageItem = {
  messageId: string;
  role: "user" | "assistant" | "system";
  text: string;
  createdAt: string;
  artifactKind?: "image_base64";
  artifactMimeType?: string | null;
  artifactFileName?: string | null;
  artifactBase64?: string | null;
};

type LocalChatDetail = LocalChatItem & {
  messages: LocalChatMessageItem[];
};

type ActivityLogEntry = {
  entryId: string;
  kind: "local_request" | "local_result" | "remote_task";
  status: "info" | "success" | "warning" | "error";
  title: string;
  detail: string | null;
  chatId: string | null;
  taskId: string | null;
  createdAt: string;
};

type RuntimeStatus = {
  deviceId: string;
  serverUrl: string;
  serverHeartbeatState: "online" | "offline";
  serverHeartbeatReachable: boolean;
  serverHeartbeatAt: string | null;
  pairingActive: boolean;
  trustedTelegramUserCount: number;
  passwordConfigured: boolean;
  totpConfigured: boolean;
  workspaceCount: number;
  defaultWorkspaceName: string;
  defaultWorkspaceRoot: string;
  localChatCount: number;
  lastActiveChatTitle: string | null;
  activityLogCount: number;
  pendingTaskCount: number;
  blockedTaskCount: number;
};

type UpdateState = {
  currentVersion: string;
  feedUrl: string | null;
  isSupported: boolean;
  phase: "disabled" | "idle" | "checking" | "downloading" | "downloaded" | "error";
  lastCheckedAt: string | null;
  availableReleaseName: string | null;
  message: string | null;
};

type KnowledgeTreeNode = {
  id: string;
  title: string;
  relativePath: string;
  kind: "directory" | "note";
  children: KnowledgeTreeNode[];
};

type AppPreferences = {
  launchAtLogin: boolean;
  notificationsEnabled: boolean;
  startHiddenOnLaunch: boolean;
  closeToTrayOnClose: boolean;
};

type VaultSettingsState = {
  vaultRoot: string | null;
  isConfigured: boolean;
};

const getAuthConfigState = vi.fn(async () => ({
  passwordConfigured: false,
  totpConfigured: false
}));
const getAppPreferences = vi.fn<() => Promise<AppPreferences>>(async () => ({
  launchAtLogin: false,
  notificationsEnabled: true,
  startHiddenOnLaunch: true,
  closeToTrayOnClose: true
}));
const getOnboardingState = vi.fn(async () => ({
  installationFingerprint: "install-a",
  completedInstallationFingerprint: "install-a",
  requiresOnboarding: false
}));
const completeOnboarding = vi.fn(async () => ({
  installationFingerprint: "install-a",
  completedInstallationFingerprint: "install-a",
  requiresOnboarding: false
}));
const saveAppPreferences = vi.fn(async () => ({
  launchAtLogin: true,
  notificationsEnabled: false,
  startHiddenOnLaunch: false,
  closeToTrayOnClose: false
}));
const getVaultSettings = vi.fn<() => Promise<VaultSettingsState>>(async () => ({
  vaultRoot: "D:\\KarpikVault",
  isConfigured: true
}));
const saveVaultRoot = vi.fn(async (vaultRoot: string) => ({
  vaultRoot,
  isConfigured: true
}));
const getOwnerProfileState = vi.fn(async () => ({
  fullName: "Степан Карпов",
  gender: "мужской",
  age: 26,
  city: "Москва",
  timezone: "Europe/Moscow",
  language: "ru",
  contacts: "@stepa",
  occupation: "software engineer",
  bio: null,
  notes: null
}));
const saveOwnerProfile = vi.fn(async (payload: Record<string, unknown>) => ({
  fullName: "Степан Карпов",
  gender: "мужской",
  age: 26,
  city: "Москва",
  timezone: "Europe/Moscow",
  language: "ru",
  contacts: "@stepa",
  occupation: "software engineer",
  bio: null,
  notes: null,
  ...payload
}));

const saveAuthConfig = vi.fn(async () => ({
  passwordConfigured: true,
  totpConfigured: true
}));

const createTotpEnrollment = vi.fn(async () => ({
  secret: "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ",
  otpAuthUri:
    "otpauth://totp/Karpik:desktop-local?secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ&issuer=Karpik&algorithm=SHA1&digits=6&period=30",
  qrDataUrl: "data:image/png;base64,ZmFrZS1xci1kYXRh",
  issuer: "Karpik",
  accountName: "desktop-local"
}));

const confirmTotpEnrollment = vi.fn(async () => ({
  passwordConfigured: false,
  totpConfigured: true
}));

const getCodexConfigState = vi.fn(async () => ({
  workspaces: [
    {
      id: "default-workspace",
      name: "Default",
      rootPath: "C:\\Users\\TBG\\AppData\\Roaming\\Karpik\\docs\\user"
    },
    {
      id: "assist-repo",
      name: "Assist",
      rootPath: "D:\\Projects\\assist"
    }
  ],
  defaultWorkspaceId: "default-workspace",
  chatBindings: {
    "5001": "assist-repo"
  }
}));

const saveCodexConfig = vi.fn(async () => ({
  workspaces: [
    {
      id: "default-workspace",
      name: "Default",
      rootPath: "C:\\Users\\TBG\\AppData\\Roaming\\Karpik\\docs\\user"
    },
    {
      id: "assist-repo",
      name: "Assist",
      rootPath: "D:\\Projects\\assist"
    }
  ],
  defaultWorkspaceId: "assist-repo",
  chatBindings: {}
}));

const saveChatWorkspaceBinding = vi.fn(async () => ({
  workspaces: [
    {
      id: "default-workspace",
      name: "Default",
      rootPath: "C:\\Users\\TBG\\AppData\\Roaming\\Karpik\\docs\\user"
    },
    {
      id: "assist-repo",
      name: "Assist",
      rootPath: "D:\\Projects\\assist"
    }
  ],
  defaultWorkspaceId: "default-workspace",
  chatBindings: {
    "5001": "default-workspace"
  }
}));
const getAppsState = vi.fn(async () => ({
  items: [
    {
      appId: "app-osu",
      displayName: "osu! lazer",
      launchPath: "C:\\Games\\osu!\\osu!.exe",
      aliases: ["osu", "осу", "osu lazer"],
      linked: true,
      source: "manual" as const
    },
    {
      appId: "app-discovered",
      displayName: "Discord",
      launchPath: "C:\\Users\\TBG\\Desktop\\Discord.lnk",
      aliases: ["discord"],
      linked: false,
      source: "shortcut" as const
    }
  ]
}));
const getAssistantProcesses = vi.fn(async () => [
  {
    taskId: "task-launch-1",
    appId: "app-osu",
    displayName: "osu! lazer",
    aliases: ["osu", "осу"],
    pid: 4242
  }
]);
const refreshDiscoveredApps = vi.fn(async () => getAppsState());
const saveAppRegistryEntry = vi.fn(async () => getAppsState());
const removeAppRegistryEntry = vi.fn(async () => getAppsState());

const getPairingState = vi.fn<
  () => Promise<{
    code: string | null;
    expiresAt: string | null;
    isActive: boolean;
    trustedTelegramUserIds: number[];
  }>
>(async () => ({
  code: null,
  expiresAt: null,
  isActive: false,
  trustedTelegramUserIds: []
}));

const getTaskSnapshot = vi.fn<() => Promise<TaskSnapshot>>(async () => []);
const getLocalApprovals = vi.fn<
  () => Promise<
    Array<{
      taskId: string;
      intent: string;
      summaryText: string;
      previewText: string;
      changedFiles: string[];
      createdAt: string;
    }>
  >
>(async () => []);
const approveLocalApproval = vi.fn(async () => undefined);
const rejectLocalApproval = vi.fn(async () => undefined);
const cancelTask = vi.fn(async () => undefined);
const retryTask = vi.fn(async () => undefined);
const getActivityLog = vi.fn<() => Promise<ActivityLogEntry[]>>(async () => []);
const getQuickAccessState = vi.fn<
  () => Promise<{
    targetChat: LocalChatItem | null;
    localChatCount: number;
    recentActivity: ActivityLogEntry[];
    recentChats: LocalChatItem[];
  }>
>(async () => ({
  targetChat: null,
  localChatCount: 0,
  recentActivity: [],
  recentChats: []
}));
const submitQuickRequest = vi.fn(async (payload: { chatId?: string; text: string }) => ({
  chat: {
    chatId: "local-chat-10",
    source: "desktop_chat" as const,
    title: "Execution chat",
    createdAt: "2026-03-24T12:00:00.000Z",
    updatedAt: "2026-03-24T12:11:00.000Z",
    messageCount: 2,
    referenceLabel: null,
    telegramChatId: null,
    workspaceId: "assist-repo"
  },
  detail: {
    chatId: "local-chat-10",
    source: "desktop_chat" as const,
    title: "Execution chat",
    createdAt: "2026-03-24T12:00:00.000Z",
    updatedAt: "2026-03-24T12:11:00.000Z",
    messageCount: 2,
    referenceLabel: null,
    telegramChatId: null,
    workspaceId: "assist-repo",
    messages: [
      {
        messageId: "quick-user-1",
        role: "user" as const,
        text: payload.text,
        createdAt: "2026-03-24T12:10:00.000Z"
      },
      {
        messageId: "quick-assistant-1",
        role: "assistant" as const,
        text: "desktop-local is online",
        createdAt: "2026-03-24T12:11:00.000Z"
      }
    ]
  }
}));
const getRuntimeStatus = vi.fn<() => Promise<RuntimeStatus>>(async () => ({
  deviceId: "desktop-local",
  serverUrl: "http://127.0.0.1:8000",
  serverHeartbeatState: "online",
  serverHeartbeatReachable: true,
  serverHeartbeatAt: "2026-03-24T12:25:00.000Z",
  pairingActive: false,
  trustedTelegramUserCount: 1,
  passwordConfigured: true,
  totpConfigured: true,
  workspaceCount: 2,
  defaultWorkspaceName: "Assist",
  defaultWorkspaceRoot: "D:\\Projects\\assist",
  localChatCount: 3,
  lastActiveChatTitle: "Execution chat",
  activityLogCount: 4,
  pendingTaskCount: 1,
  blockedTaskCount: 0
}));
const getUpdateState = vi.fn<() => Promise<UpdateState>>(async () => ({
  currentVersion: "0.1.0",
  feedUrl: "https://karpik.example.com/desktop-updates/win32/x64",
  isSupported: true,
  phase: "downloaded",
  lastCheckedAt: "2026-03-24T18:40:00.000Z",
  availableReleaseName: "0.2.0",
  message: "Update 0.2.0 is ready to install."
}));
const checkForUpdates = vi.fn(async () => ({
  currentVersion: "0.1.0",
  feedUrl: "https://karpik.example.com/desktop-updates/win32/x64",
  isSupported: true,
  phase: "checking" as const,
  lastCheckedAt: "2026-03-24T18:41:00.000Z",
  availableReleaseName: null,
  message: "Checking for updates..."
}));
const installUpdate = vi.fn(async () => undefined);
const getKnowledgeState = vi.fn<() => Promise<KnowledgeTreeNode[]>>(async () => [
  {
    id: "user",
    title: "user",
    relativePath: "user",
    kind: "directory",
    children: [
      {
        id: "user/AI",
        title: "AI",
        relativePath: "user/AI",
        kind: "directory",
        children: [
          {
            id: "user/AI/models",
            title: "models",
            relativePath: "user/AI/models",
            kind: "directory",
            children: [
              {
                id: "user/AI/models/MCP",
                title: "MCP",
                relativePath: "user/AI/models/MCP",
                kind: "directory",
                children: [
                  {
                    id: "user/AI/models/MCP/MCP.md",
                    title: "MCP",
                    relativePath: "user/AI/models/MCP/MCP.md",
                    kind: "note",
                    children: []
                  },
                  {
                    id: "user/AI/models/MCP/Источники.md",
                    title: "Источники",
                    relativePath: "user/AI/models/MCP/Источники.md",
                    kind: "note",
                    children: []
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  },
  {
    id: "assist",
    title: "assist",
    relativePath: "assist",
    kind: "directory",
    children: [
      {
        id: "assist/docs",
        title: "docs",
        relativePath: "assist/docs",
        kind: "directory",
        children: [
          {
            id: "assist/docs/registry",
            title: "registry",
            relativePath: "assist/docs/registry",
            kind: "directory",
            children: [
              {
                id: "assist/docs/registry/Документации.md",
                title: "Документации",
                relativePath: "assist/docs/registry/Документации.md",
                kind: "note",
                children: []
              }
            ]
          }
        ]
      }
    ]
  }
]);
const readKnowledgeEntry = vi.fn(
  async (payload: { relativePath: string }) => ({
    title:
      payload.relativePath === "assist/docs/registry/Документации.md"
        ? "Документации"
        : payload.relativePath === "user/AI/models/MCP/Источники.md"
          ? "Источники"
          : "MCP",
    relativePath: payload.relativePath,
    content:
      payload.relativePath === "assist/docs/registry/Документации.md"
        ? "known docs"
        : payload.relativePath === "user/AI/models/MCP/Источники.md"
          ? "sources"
          : "MCP note body"
  })
);

const openPairingSession = vi.fn(async () => ({
  code: "PAIR42",
  expiresAt: "2026-03-24T00:05:00.000Z",
  isActive: true,
  trustedTelegramUserIds: []
}));

let localChatsState: LocalChatDetail[] = [];

const getLocalChats = vi.fn(async () =>
  localChatsState.map(({ messages, ...chatSummary }) => chatSummary)
);
const getLocalChatDetail = vi.fn(async (chatId: string) => {
  const chat = localChatsState.find((candidate) => candidate.chatId === chatId);
  return chat ?? null;
});
const createDesktopChat = vi.fn(async () => {
  const nextChat: LocalChatDetail = {
    chatId: "local-chat-1",
    source: "desktop_chat",
    title: "Новый локальный чат",
    createdAt: "2026-03-24T12:00:00.000Z",
    updatedAt: "2026-03-24T12:00:00.000Z",
    messageCount: 0,
    referenceLabel: null,
    telegramChatId: null,
    workspaceId: null,
    messages: []
  };
  localChatsState = [nextChat];
  const { messages, ...chatSummary } = nextChat;
  return chatSummary;
});
const createLocalContinuationChat = vi.fn(
  async (payload: {
    telegramChatId: number;
    title?: string;
    workspaceId?: string | null;
  }) => {
    const nextChat: LocalChatDetail = {
      chatId: "local-chat-2",
      source: "local_continuation_chat",
      title: payload.title ?? `Telegram ${payload.telegramChatId}`,
      createdAt: "2026-03-24T12:05:00.000Z",
      updatedAt: "2026-03-24T12:05:00.000Z",
      messageCount: 0,
      referenceLabel: `Ссылается на Telegram chat ${payload.telegramChatId}`,
      telegramChatId: payload.telegramChatId,
      workspaceId: payload.workspaceId ?? null,
      messages: []
    };
    localChatsState = [nextChat, ...localChatsState];
    const { messages, ...chatSummary } = nextChat;
    return chatSummary;
  }
);
const sendLocalChatMessage = vi.fn(
  async (payload: { chatId: string; text: string }) => {
    const chat = localChatsState.find((candidate) => candidate.chatId === payload.chatId);

    if (!chat) {
      return null;
    }

    const updatedChat: LocalChatDetail = {
      ...chat,
      updatedAt: "2026-03-24T12:10:00.000Z",
      messageCount: chat.messages.length + 2,
      messages: [
        ...chat.messages,
        {
          messageId: `user-${payload.chatId}`,
          role: "user",
          text: payload.text,
          createdAt: "2026-03-24T12:10:00.000Z"
        },
        {
          messageId: `assistant-${payload.chatId}`,
          role: "assistant",
          text: payload.text === "status" ? "desktop-local is online" : "done",
          createdAt: "2026-03-24T12:10:01.000Z"
        }
      ]
    };

    localChatsState = [
      updatedChat,
      ...localChatsState.filter((candidate) => candidate.chatId !== payload.chatId)
    ];

    return updatedChat;
  }
);

describe("App navigation", () => {
  beforeEach(() => {
    localChatsState = [];
    window.karpik = {
      view: "main",
      getActivityLog,
      getAppsState,
      getAssistantProcesses,
      getAppPreferences,
      getVaultSettings,
      getOnboardingState,
      getOwnerProfileState,
      getAuthConfigState,
      createTotpEnrollment,
      confirmTotpEnrollment,
      getCodexConfigState,
      getKnowledgeState,
      getLocalApprovals,
      getLocalChats,
      getLocalChatDetail,
      getPairingState,
      getQuickAccessState,
      getRuntimeStatus,
      getUpdateState,
      getTaskSnapshot,
      openPairingSession,
      approveLocalApproval,
      rejectLocalApproval,
      cancelTask,
      retryTask,
      readKnowledgeEntry,
      createDesktopChat,
      createLocalContinuationChat,
      checkForUpdates,
      completeOnboarding,
      installUpdate,
      refreshDiscoveredApps,
      submitQuickRequest,
      sendLocalChatMessage,
      saveAuthConfig,
      saveAppRegistryEntry,
      saveAppPreferences,
      saveVaultRoot,
      saveOwnerProfile,
      saveChatWorkspaceBinding,
      saveCodexConfig,
      removeAppRegistryEntry
    };
  });

  afterEach(() => {
    cleanup();
    getActivityLog.mockClear();
    getAppsState.mockClear();
    getAssistantProcesses.mockClear();
    getAppPreferences.mockClear();
    getVaultSettings.mockClear();
    getOnboardingState.mockClear();
    completeOnboarding.mockClear();
    getOwnerProfileState.mockClear();
    getAuthConfigState.mockClear();
    createTotpEnrollment.mockClear();
    confirmTotpEnrollment.mockClear();
    getCodexConfigState.mockClear();
    getKnowledgeState.mockClear();
    getLocalApprovals.mockClear();
    getLocalChats.mockClear();
    getLocalChatDetail.mockClear();
    getPairingState.mockClear();
    getQuickAccessState.mockClear();
    getRuntimeStatus.mockClear();
    getUpdateState.mockClear();
    getTaskSnapshot.mockClear();
    openPairingSession.mockClear();
    approveLocalApproval.mockClear();
    rejectLocalApproval.mockClear();
    cancelTask.mockClear();
    retryTask.mockClear();
    readKnowledgeEntry.mockClear();
    createDesktopChat.mockClear();
    createLocalContinuationChat.mockClear();
    checkForUpdates.mockClear();
    installUpdate.mockClear();
    refreshDiscoveredApps.mockClear();
    submitQuickRequest.mockClear();
    sendLocalChatMessage.mockClear();
    saveAuthConfig.mockClear();
    saveAppRegistryEntry.mockClear();
    saveAppPreferences.mockClear();
    saveVaultRoot.mockClear();
    saveOwnerProfile.mockClear();
    saveChatWorkspaceBinding.mockClear();
    saveCodexConfig.mockClear();
    removeAppRegistryEntry.mockClear();
  });

  async function renderMainView() {
    render(<App />);
    await screen.findByRole("button", { name: "Чаты" });
  }

  it("renders all primary sections", async () => {
    await renderMainView();

    expect(screen.getByRole("button", { name: "Чаты" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Чаты Telegram" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Задачи" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Приложения" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Knowledge / Review" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Логи" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Сервисы" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Настройки" })).toBeInTheDocument();
  });

  it("shows onboarding for a new installation and allows an already-paired device to continue", async () => {
    getOnboardingState.mockResolvedValueOnce({
      installationFingerprint: "install-b",
      completedInstallationFingerprint: "install-a",
      requiresOnboarding: true
    });
    getVaultSettings.mockResolvedValueOnce({
      vaultRoot: null,
      isConfigured: false
    });
    getPairingState.mockResolvedValueOnce({
      code: null,
      expiresAt: null,
      isActive: false,
      trustedTelegramUserIds: [101]
    });

    render(<App />);

    expect(await screen.findByText("Первичная настройка устройства")).toBeInTheDocument();
    expect(await screen.findByLabelText("Путь к vault")).toBeInTheDocument();
    expect(
      await screen.findByText("Этот ПК уже привязан к Telegram. При желании можно открыть новый pairing-код.")
    ).toBeInTheDocument();
    expect(document.querySelector("main.desktop-layout")).toHaveClass("desktop-layout--standalone");

    fireEvent.change(await screen.findByLabelText("Путь к vault"), {
      target: {
        value: "D:\\KarpikVault"
      }
    });
    fireEvent.click(await screen.findByRole("button", { name: "Сохранить vault" }));

    await waitFor(() => {
      expect(saveVaultRoot).toHaveBeenCalledWith("D:\\KarpikVault");
    });

    fireEvent.click(await screen.findByRole("button", { name: "Продолжить в приложение" }));

    await waitFor(() => {
      expect(completeOnboarding).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByRole("button", { name: "Чаты" })).toBeInTheDocument();
  });

  it("shows pairing deep-link guidance during onboarding after opening a pairing session", async () => {
    getOnboardingState.mockResolvedValueOnce({
      installationFingerprint: "install-b",
      completedInstallationFingerprint: "install-a",
      requiresOnboarding: true
    });
    getVaultSettings.mockResolvedValueOnce({
      vaultRoot: null,
      isConfigured: false
    });
    getPairingState.mockResolvedValueOnce({
      code: null,
      expiresAt: null,
      isActive: false,
      trustedTelegramUserIds: []
    });

    render(<App />);

    expect(await screen.findByText("Первичная настройка устройства")).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "Открыть pairing" }));

    expect(openPairingSession).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByText("Pairing-код обновлён. Используй /start-ссылку или fallback-команду /pair.")
    ).toBeInTheDocument();
    expect(await screen.findByText("Код: PAIR42")).toBeInTheDocument();
    expect(
      await screen.findByText("Быстрый старт: https://t.me/Desktop_assist_bot?start=pair_PAIR42")
    ).toBeInTheDocument();
    expect(await screen.findByText("Резервная команда: /pair PAIR42")).toBeInTheDocument();
  });

  it("shows vault root in settings and saves the updated path", async () => {
    getVaultSettings.mockResolvedValueOnce({
      vaultRoot: "D:\\KarpikVault",
      isConfigured: true
    });

    await renderMainView();

    fireEvent.click(screen.getByRole("button", { name: "Настройки" }));
    expect(await screen.findByDisplayValue("D:\\KarpikVault")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Путь к knowledge vault"), {
      target: {
        value: "E:\\Vault"
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить vault" }));

    await waitFor(() => {
      expect(saveVaultRoot).toHaveBeenCalledWith("E:\\Vault");
    });
    expect(await screen.findByText("Vault path saved locally.")).toBeInTheDocument();
  });

  it("shows linked applications and assistant-started processes", async () => {
    await renderMainView();

    fireEvent.click(screen.getByRole("button", { name: "Приложения" }));

    expect(await screen.findByText("Реестр запуска и alias-связки")).toBeInTheDocument();
    expect((await screen.findAllByText("osu! lazer")).length).toBeGreaterThan(0);
    expect(await screen.findByText("Discord")).toBeInTheDocument();
    expect(await screen.findByText("PID: 4242")).toBeInTheDocument();
  });

  it("shows local chat empty state and lets the user create a desktop chat", async () => {
    await renderMainView();

    fireEvent.click(screen.getByRole("button", { name: "Чаты" }));
    expect(await screen.findByText("Локальных чатов пока нет.")).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "Новый локальный чат" }));

    expect(createDesktopChat).toHaveBeenCalledTimes(1);
    expect((await screen.findAllByText("Новый локальный чат")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("Локальный диалог")).length).toBeGreaterThan(0);
  });

  it("shows local chat detail and sends a local request", async () => {
    localChatsState = [
      {
        chatId: "local-chat-10",
        source: "desktop_chat",
        title: "Execution chat",
        createdAt: "2026-03-24T12:00:00.000Z",
        updatedAt: "2026-03-24T12:00:00.000Z",
        messageCount: 1,
        referenceLabel: null,
        telegramChatId: null,
        workspaceId: "assist-repo",
        messages: [
          {
            messageId: "message-1",
            role: "assistant",
            text: "Ready.",
            createdAt: "2026-03-24T12:00:00.000Z"
          }
        ]
      }
    ];

    await renderMainView();

    fireEvent.click(screen.getByRole("button", { name: "Чаты" }));
    expect(await screen.findByText("Ready.")).toBeInTheDocument();
    fireEvent.change(await screen.findByLabelText("Local request"), {
      target: { value: "status" }
    });
    fireEvent.click(await screen.findByRole("button", { name: "Отправить" }));

    expect(sendLocalChatMessage).toHaveBeenCalledWith({
      chatId: "local-chat-10",
      text: "status"
    });
    expect(await screen.findByText("desktop-local is online")).toBeInTheDocument();
  });

  it("shows pairing controls and workspace registry settings", async () => {
    await renderMainView();

    fireEvent.click(screen.getByRole("button", { name: "Настройки" }));

    expect(await screen.findByRole("button", { name: "Открыть pairing" })).toBeInTheDocument();
    expect(await screen.findByLabelText("Пароль для remote auth")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "\u0421\u043e\u0437\u0434\u0430\u0442\u044c QR \u0434\u043b\u044f TOTP" })).toBeInTheDocument();
    expect(await screen.findByLabelText("TOTP secret \u0432\u0440\u0443\u0447\u043d\u0443\u044e (fallback)")).toBeInTheDocument();
    expect(await screen.findByLabelText("Launch at login")).toBeInTheDocument();
    expect(await screen.findByLabelText("Workspace name 1")).toBeInTheDocument();
    expect(await screen.findByLabelText("Workspace path 2")).toBeInTheDocument();
    expect(await screen.findByLabelText("Default workspace")).toBeInTheDocument();
    expect(await screen.findByText("Supported remote tasks")).toBeInTheDocument();
    expect(await screen.findByText("/task low screenshot")).toBeInTheDocument();
    expect(await screen.findByText("/task high codex-write <prompt>")).toBeInTheDocument();
    expect(await screen.findByText("Pairing не активен")).toBeInTheDocument();
    expect(await screen.findByText("Password: не настроен")).toBeInTheDocument();
    expect(await screen.findByText("TOTP: не настроен")).toBeInTheDocument();
    expect(
      await screen.findByText("Пароль и TOTP не обязательны, но без них remote-доступ защищён слабее.")
    ).toBeInTheDocument();
    expect(await screen.findByText(/@Desktop_assist_bot/)).toBeInTheDocument();
    expect(getAuthConfigState).toHaveBeenCalledTimes(1);
    expect(getAppPreferences).toHaveBeenCalledTimes(1);
    expect(getCodexConfigState).toHaveBeenCalledTimes(1);
    expect(getPairingState).toHaveBeenCalledTimes(1);
  });

  it("marks the document body with the active app view", async () => {
    window.karpik!.view = "main";
    const { unmount } = render(<App />);

    await waitFor(() => {
      expect(document.body.dataset.karpikView).toBe("main");
    });

    unmount();

    window.karpik!.view = "quick-popup";
    render(<App />);

    await waitFor(() => {
      expect(document.body.dataset.karpikView).toBe("quick-popup");
    });
  });

  it("saves desktop operator preferences from the settings page", async () => {
    await renderMainView();

    fireEvent.click(screen.getByRole("button", { name: "Настройки" }));
    fireEvent.click(await screen.findByLabelText("Launch at login"));
    fireEvent.click(await screen.findByLabelText("Desktop notifications"));
    fireEvent.click(await screen.findByLabelText("Start hidden in tray"));
    fireEvent.click(await screen.findByLabelText("Close main window to tray"));
    fireEvent.click(await screen.findByRole("button", { name: "Save desktop behavior" }));

    expect(saveAppPreferences).toHaveBeenCalledWith({
      launchAtLogin: true,
      notificationsEnabled: false,
      startHiddenOnLaunch: false,
      closeToTrayOnClose: false
    });
    expect(await screen.findByLabelText("Launch at login")).toBeChecked();
    expect(await screen.findByLabelText("Desktop notifications")).not.toBeChecked();
    expect(await screen.findByLabelText("Start hidden in tray")).not.toBeChecked();
    expect(await screen.findByLabelText("Close main window to tray")).not.toBeChecked();
  });

  it("refreshes the visible pairing code after opening a session", async () => {
    await renderMainView();

    fireEvent.click(screen.getByRole("button", { name: "Настройки" }));
    fireEvent.click(await screen.findByRole("button", { name: "Открыть pairing" }));

    expect(openPairingSession).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Код: PAIR42")).toBeInTheDocument();
  });

  it("saves auth settings from the settings page", async () => {
    await renderMainView();

    fireEvent.click(screen.getByRole("button", { name: "Настройки" }));
    fireEvent.change(await screen.findByLabelText("Пароль для remote auth"), {
      target: { value: "secret-password" }
    });
    fireEvent.change(await screen.findByLabelText("TOTP secret \u0432\u0440\u0443\u0447\u043d\u0443\u044e (fallback)"), {
      target: { value: "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ" }
    });
    fireEvent.click(await screen.findByRole("button", { name: "Сохранить auth-настройки" }));

    expect(saveAuthConfig).toHaveBeenCalledWith({
      password: "secret-password",
      totpSecret: "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"
    });
    expect(await screen.findByText("Password: настроен")).toBeInTheDocument();
    expect(await screen.findByText("TOTP: настроен")).toBeInTheDocument();
  });

  it("saves multiple codex workspace settings from the settings page", async () => {
    await renderMainView();

    fireEvent.click(screen.getByRole("button", { name: "Настройки" }));
    fireEvent.click(await screen.findByRole("button", { name: "Add workspace" }));
    fireEvent.change(await screen.findByLabelText("Workspace name 2"), {
      target: { value: "Assist" }
    });
    fireEvent.change(await screen.findByLabelText("Workspace path 2"), {
      target: { value: "D:\\Projects\\assist" }
    });
    fireEvent.change(await screen.findByLabelText("Default workspace"), {
      target: { value: "assist-repo" }
    });
    fireEvent.click(await screen.findByRole("button", { name: "Save workspaces" }));

    expect(saveCodexConfig).toHaveBeenCalledWith({
      workspaces: [
        {
          id: "default-workspace",
          name: "Default",
          rootPath: "C:\\Users\\TBG\\AppData\\Roaming\\Karpik\\docs\\user"
        },
        {
          id: "assist-repo",
          name: "Assist",
          rootPath: "D:\\Projects\\assist"
        }
      ],
      defaultWorkspaceId: "assist-repo"
    });
    expect(await screen.findByDisplayValue("D:\\Projects\\assist")).toBeInTheDocument();
  });

  it("shows Telegram task snapshot items and workspace selector", async () => {
    getTaskSnapshot.mockResolvedValue([
      {
        task_id: "task-1",
        intent: "status",
        status: "done",
        result_text: "desktop-local is online",
        error_text: null,
        chat_id: 5001,
        telegram_user_id: 101
      }
    ]);

    await renderMainView();

    fireEvent.click(screen.getByRole("button", { name: "Чаты Telegram" }));

    expect(await screen.findByText("task-1")).toBeInTheDocument();
    expect(await screen.findByText("status")).toBeInTheDocument();
    expect(await screen.findByText("desktop-local is online")).toBeInTheDocument();
    expect(await screen.findByLabelText("Workspace for chat 5001")).toBeInTheDocument();
  });

  it("shows desktop update controls in services and allows installing a downloaded update", async () => {
    await renderMainView();

    fireEvent.click(screen.getByRole("button", { name: "Сервисы" }));

    expect(await screen.findByText("Desktop updates")).toBeInTheDocument();
    expect(await screen.findByText("Current version: 0.1.0")).toBeInTheDocument();
    expect(await screen.findByText("Available release: 0.2.0")).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "Проверить обновления" }));
    fireEvent.click(await screen.findByRole("button", { name: "Установить обновление" }));

    expect(checkForUpdates).toHaveBeenCalledTimes(1);
    expect(installUpdate).toHaveBeenCalledTimes(1);
  });

  it("renders screenshot artifacts in Telegram task cards", async () => {
    getTaskSnapshot.mockResolvedValue([
      {
        task_id: "task-shot",
        intent: "screenshot",
        status: "done",
        result_text: "Screenshot captured.",
        error_text: null,
        chat_id: 5001,
        telegram_user_id: 101,
        artifactKind: "image_base64",
        artifactMimeType: "image/png",
        artifactFileName: "desktop-remote.png",
        artifactBase64: "aGVsbG8="
      }
    ]);

    await renderMainView();

    fireEvent.click(screen.getByRole("button", { name: "Чаты Telegram" }));

    const image = await screen.findByRole("img", { name: "desktop-remote.png" });
    expect(image).toHaveAttribute("src", "data:image/png;base64,aGVsbG8=");
  });

  it("saves a Telegram chat workspace binding", async () => {
    getTaskSnapshot.mockResolvedValue([
      {
        task_id: "task-bound",
        intent: "codex summarize repo",
        status: "done",
        result_text: "done",
        error_text: null,
        chat_id: 5001,
        telegram_user_id: 101
      }
    ]);

    await renderMainView();

    fireEvent.click(screen.getByRole("button", { name: "Чаты Telegram" }));
    fireEvent.change(await screen.findByLabelText("Workspace for chat 5001"), {
      target: { value: "default-workspace" }
    });
    fireEvent.click(await screen.findByRole("button", { name: "Сохранить workspace" }));

    expect(saveChatWorkspaceBinding).toHaveBeenCalledWith({
      chatId: 5001,
      workspaceId: "default-workspace"
    });
  });

  it("continues a Telegram chat into local chats", async () => {
    getTaskSnapshot.mockResolvedValue([
      {
        task_id: "task-continue",
        intent: "codex summarize repo",
        status: "done",
        result_text: "done",
        error_text: null,
        chat_id: 5001,
        telegram_user_id: 101
      }
    ]);

    await renderMainView();

    fireEvent.click(screen.getByRole("button", { name: "Чаты Telegram" }));
    fireEvent.click(await screen.findByRole("button", { name: "Продолжить чат" }));

    expect(createLocalContinuationChat).toHaveBeenCalledWith({
      telegramChatId: 5001,
      title: "Telegram 5001",
      workspaceId: "assist-repo"
    });
    expect((await screen.findAllByText("Telegram 5001")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("Ссылается на Telegram chat 5001")).length).toBeGreaterThan(0);
  });

  it("shows blocked and failed tasks in the blocked page", async () => {
    getTaskSnapshot.mockResolvedValue([
      {
        task_id: "task-2",
        intent: "read docs/missing.txt",
        status: "failed",
        result_text: null,
        error_text: "File not found.",
        chat_id: 5001,
        telegram_user_id: 101
      }
    ]);

    await renderMainView();

    fireEvent.click(screen.getAllByRole("button", { name: "Задачи" })[0]!);

    expect(await screen.findByText("task-2")).toBeInTheDocument();
    expect(await screen.findByText("read docs/missing.txt")).toBeInTheDocument();
    expect(await screen.findByText("File not found.")).toBeInTheDocument();
  });

  it("retries a failed task from the blocked page", async () => {
    getTaskSnapshot
      .mockResolvedValue([
        {
          task_id: "task-2",
          intent: "read docs/missing.txt",
          status: "failed",
          result_text: null,
          error_text: "File not found.",
          chat_id: 5001,
          telegram_user_id: 101
        }
      ]);

    await renderMainView();

    fireEvent.click(screen.getAllByRole("button", { name: "Задачи" })[0]!);
    fireEvent.click(await screen.findByRole("button", { name: "Повторить" }));

    expect(retryTask).toHaveBeenCalledWith("task-2");
    expect(await screen.findByText("task-2")).toBeInTheDocument();
  });

  it("shows local approval previews and allows approving them", async () => {
    getTaskSnapshot.mockResolvedValue([
      {
        task_id: "task-approval",
        intent: "codex-write update README",
        status: "awaiting_local_approval",
        result_text: "Waiting for local review. Files: README.md",
        error_text: null,
        chat_id: 5001,
        telegram_user_id: 101
      }
    ]);
    getLocalApprovals.mockResolvedValue([
      {
        taskId: "task-approval",
        intent: "codex-write update README",
        summaryText: "Updated README",
        previewText: "diff preview",
        changedFiles: ["README.md"],
        createdAt: "2026-03-24T12:00:00Z"
      }
    ]);

    await renderMainView();

    fireEvent.click(screen.getAllByRole("button", { name: "Задачи" })[0]!);

    expect(await screen.findByText("Updated README")).toBeInTheDocument();
    expect(await screen.findByText("diff preview")).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "Подтвердить" }));

    expect(approveLocalApproval).toHaveBeenCalledWith("task-approval");
  });

  it("submits a quick popup request into the last active local chat", async () => {
    window.karpik = {
      ...window.karpik!,
      view: "quick-popup"
    };
    getTaskSnapshot.mockResolvedValueOnce([
      {
        task_id: "task-quick-1",
        intent: "codex summarize repo",
        status: "running",
        result_text: null,
        error_text: null,
        chat_id: 5001,
        telegram_user_id: 101
      },
      {
        task_id: "task-quick-2",
        intent: "codex-write update notes",
        status: "awaiting_local_approval",
        result_text: "Waiting for local review.",
        error_text: null,
        chat_id: 5001,
        telegram_user_id: 101
      }
    ]);
    getQuickAccessState.mockResolvedValueOnce({
      targetChat: {
        chatId: "local-chat-10",
        source: "desktop_chat",
        title: "Execution chat",
        createdAt: "2026-03-24T12:00:00.000Z",
        updatedAt: "2026-03-24T12:00:00.000Z",
        messageCount: 1,
        referenceLabel: null,
        telegramChatId: null,
        workspaceId: "assist-repo"
      },
      localChatCount: 1,
      recentActivity: [
        {
          entryId: "activity-1",
          kind: "remote_task",
          status: "warning",
          title: "Remote task task-quick-2",
          detail: "codex-write update notes -> awaiting_local_approval",
          chatId: null,
          taskId: "task-quick-2",
          createdAt: "2026-03-24T12:12:00.000Z"
        }
      ],
      recentChats: [
        {
          chatId: "local-chat-10",
          source: "desktop_chat" as const,
          title: "Execution chat",
          createdAt: "2026-03-24T12:00:00.000Z",
          updatedAt: "2026-03-24T12:00:00.000Z",
          messageCount: 1,
          referenceLabel: null,
          telegramChatId: null,
          workspaceId: "assist-repo"
        },
        {
          chatId: "local-chat-20",
          source: "desktop_chat" as const,
          title: "Scratchpad",
          createdAt: "2026-03-24T12:30:00.000Z",
          updatedAt: "2026-03-24T12:30:00.000Z",
          messageCount: 0,
          referenceLabel: null,
          telegramChatId: null,
          workspaceId: null
        }
      ]
    });

    render(<App />);

    expect(await screen.findByLabelText("Target local chat")).toHaveValue("local-chat-10");
    expect(await screen.findByText("Грубая оценка прогресса по активным задачам: 80%")).toBeInTheDocument();
    expect(await screen.findByText("Remote task task-quick-2")).toBeInTheDocument();
    expect(await screen.findByText("codex-write update notes -> awaiting_local_approval")).toBeInTheDocument();
    fireEvent.change(await screen.findByLabelText("Quick request"), {
      target: { value: "status" }
    });
    fireEvent.click(await screen.findByRole("button", { name: "Send" }));

    expect(submitQuickRequest).toHaveBeenCalledWith({
      chatId: "local-chat-10",
      text: "status"
    });
    expect(await screen.findByText("desktop-local is online")).toBeInTheDocument();
  });

  it("renders screenshot artifacts in local chat messages", async () => {
    localChatsState = [
      {
        chatId: "local-chat-11",
        source: "desktop_chat",
        title: "Artifacts chat",
        createdAt: "2026-03-24T12:00:00.000Z",
        updatedAt: "2026-03-24T12:00:00.000Z",
        messageCount: 1,
        referenceLabel: null,
        telegramChatId: null,
        workspaceId: null,
        messages: [
          {
            messageId: "message-artifact-1",
            role: "assistant",
            text: "Screenshot captured.",
            createdAt: "2026-03-24T12:00:00.000Z",
            artifactKind: "image_base64",
            artifactMimeType: "image/png",
            artifactFileName: "desktop-local.png",
            artifactBase64: "aGVsbG8="
          }
        ]
      }
    ];

    await renderMainView();

    fireEvent.click(screen.getByRole("button", { name: "Чаты" }));
    const image = await screen.findByRole("img", { name: "desktop-local.png" });
    expect(image).toHaveAttribute("src", "data:image/png;base64,aGVsbG8=");
  });

  it("routes a quick popup request into the selected local chat", async () => {
    window.karpik = {
      ...window.karpik!,
      view: "quick-popup"
    };
    getQuickAccessState.mockResolvedValueOnce({
      targetChat: {
        chatId: "local-chat-10",
        source: "desktop_chat",
        title: "Execution chat",
        createdAt: "2026-03-24T12:00:00.000Z",
        updatedAt: "2026-03-24T12:00:00.000Z",
        messageCount: 1,
        referenceLabel: null,
        telegramChatId: null,
        workspaceId: "assist-repo"
      },
      localChatCount: 2,
      recentActivity: [],
      recentChats: [
        {
          chatId: "local-chat-10",
          source: "desktop_chat",
          title: "Execution chat",
          createdAt: "2026-03-24T12:00:00.000Z",
          updatedAt: "2026-03-24T12:00:00.000Z",
          messageCount: 1,
          referenceLabel: null,
          telegramChatId: null,
          workspaceId: "assist-repo"
        },
        {
          chatId: "local-chat-20",
          source: "desktop_chat",
          title: "Scratchpad",
          createdAt: "2026-03-24T12:30:00.000Z",
          updatedAt: "2026-03-24T12:30:00.000Z",
          messageCount: 0,
          referenceLabel: null,
          telegramChatId: null,
          workspaceId: null
        }
      ]
    });

    render(<App />);

    fireEvent.change(await screen.findByLabelText("Target local chat"), {
      target: { value: "local-chat-20" }
    });
    fireEvent.change(await screen.findByLabelText("Quick request"), {
      target: { value: "status" }
    });
    fireEvent.click(await screen.findByRole("button", { name: "Send" }));

    expect(submitQuickRequest).toHaveBeenCalledWith({
      chatId: "local-chat-20",
      text: "status"
    });
  });

  it("creates a new local chat from the quick popup header", async () => {
    window.karpik = {
      ...window.karpik!,
      view: "quick-popup"
    };
    getQuickAccessState
      .mockResolvedValueOnce({
        targetChat: {
          chatId: "local-chat-10",
          source: "desktop_chat",
          title: "Execution chat",
          createdAt: "2026-03-24T12:00:00.000Z",
          updatedAt: "2026-03-24T12:00:00.000Z",
          messageCount: 1,
          referenceLabel: null,
          telegramChatId: null,
          workspaceId: "assist-repo"
        },
        localChatCount: 1,
        recentActivity: [],
        recentChats: [
          {
            chatId: "local-chat-10",
            source: "desktop_chat",
            title: "Execution chat",
            createdAt: "2026-03-24T12:00:00.000Z",
            updatedAt: "2026-03-24T12:00:00.000Z",
            messageCount: 1,
            referenceLabel: null,
            telegramChatId: null,
            workspaceId: "assist-repo"
          }
        ]
      })
      .mockResolvedValueOnce({
        targetChat: {
          chatId: "local-chat-1",
          source: "desktop_chat",
          title: "Новый локальный чат",
          createdAt: "2026-03-24T12:30:00.000Z",
          updatedAt: "2026-03-24T12:30:00.000Z",
          messageCount: 0,
          referenceLabel: null,
          telegramChatId: null,
          workspaceId: null
        },
        localChatCount: 2,
        recentActivity: [],
        recentChats: [
          {
            chatId: "local-chat-1",
            source: "desktop_chat",
            title: "Новый локальный чат",
            createdAt: "2026-03-24T12:30:00.000Z",
            updatedAt: "2026-03-24T12:30:00.000Z",
            messageCount: 0,
            referenceLabel: null,
            telegramChatId: null,
            workspaceId: null
          },
          {
            chatId: "local-chat-10",
            source: "desktop_chat",
            title: "Execution chat",
            createdAt: "2026-03-24T12:00:00.000Z",
            updatedAt: "2026-03-24T12:00:00.000Z",
            messageCount: 1,
            referenceLabel: null,
            telegramChatId: null,
            workspaceId: "assist-repo"
          }
        ]
      });

    render(<App />);

    expect(await screen.findByLabelText("Target local chat")).toHaveValue("local-chat-10");
    fireEvent.click(await screen.findByRole("button", { name: "New local chat" }));

    expect(createDesktopChat).toHaveBeenCalledTimes(1);
    expect(await screen.findByLabelText("Target local chat")).toHaveValue("local-chat-1");
    expect(await screen.findByText("Всего: 2")).toBeInTheDocument();
  });

  it("shows runtime activity entries in the logs page", async () => {
    getActivityLog.mockResolvedValue([
      {
        entryId: "log-1",
        kind: "local_result",
        status: "success",
        title: "Quick request completed",
        detail: "desktop-local is online",
        chatId: "local-chat-10",
        taskId: null,
        createdAt: "2026-03-24T12:20:00.000Z"
      }
    ]);

    await renderMainView();

    fireEvent.click(screen.getByRole("button", { name: "Логи" }));

    expect(await screen.findByText("Quick request completed")).toBeInTheDocument();
    expect(await screen.findByText("desktop-local is online")).toBeInTheDocument();
  });

  it("shows runtime service status in the services page", async () => {
    await renderMainView();

    fireEvent.click(screen.getByRole("button", { name: "Сервисы" }));

    expect(await screen.findByText("Device ID: desktop-local")).toBeInTheDocument();
    expect(await screen.findByText("Server URL: http://127.0.0.1:8000")).toBeInTheDocument();
    expect(await screen.findByText("Server heartbeat: online")).toBeInTheDocument();
    expect(await screen.findByText("Server reachable: yes")).toBeInTheDocument();
    expect(await screen.findByText("Last active chat: Execution chat")).toBeInTheDocument();
    expect(await screen.findByText("Default workspace: Assist")).toBeInTheDocument();
  });

  it("shows knowledge files and switches preview", async () => {
    await renderMainView();

    fireEvent.click(screen.getByRole("button", { name: "Knowledge / Review" }));

    expect(await screen.findByText("user")).toBeInTheDocument();
    expect(await screen.findByText("assist")).toBeInTheDocument();
    expect(await screen.findByText("MCP note body")).toBeInTheDocument();
    fireEvent.click((await screen.findByText("Документации")).closest("button")!);

    expect(readKnowledgeEntry).toHaveBeenCalledWith({
      relativePath: "assist/docs/registry/Документации.md"
    });
    expect(await screen.findByText("known docs")).toBeInTheDocument();
  });
});
