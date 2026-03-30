import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";

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

const saveOwnerProfile = vi.fn(async (payload: object) => ({
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

beforeEach(() => {
  window.karpik = {
    view: "main",
    getOwnerProfileState,
    getOnboardingState: vi.fn(async () => ({
      installationFingerprint: "install-a",
      completedInstallationFingerprint: "install-a",
      requiresOnboarding: false
    })),
    saveOwnerProfile,
    completeOnboarding: vi.fn(async () => ({
      installationFingerprint: "install-a",
      completedInstallationFingerprint: "install-a",
      requiresOnboarding: false
    })),
    getRuntimeStatus: vi.fn(async () => ({
      deviceId: "stepa-desktop",
      serverUrl: "http://127.0.0.1:8080",
      serverHeartbeatState: "online" as const,
      serverHeartbeatReachable: true,
      serverHeartbeatAt: "2026-03-28T00:00:00.000Z",
      pairingActive: false,
      trustedTelegramUserCount: 1,
      passwordConfigured: true,
      totpConfigured: true,
      workspaceCount: 1,
      defaultWorkspaceName: "assist",
      defaultWorkspaceRoot: "C:\\Users\\TBG\\Desktop\\assist",
      localChatCount: 3,
      lastActiveChatTitle: "Рабочий чат",
      activityLogCount: 12,
      pendingTaskCount: 2,
      blockedTaskCount: 0
    })),
    getQuickAccessState: vi.fn(async () => ({
      targetChat: null,
      localChatCount: 3,
      recentActivity: [],
      recentChats: []
    })),
    getTaskSnapshot: vi.fn(async () => []),
    submitQuickRequest: vi.fn(async () => ({
      chat: {
        chatId: "local-chat-1",
        source: "desktop_chat" as const,
        title: "Новый чат",
        createdAt: "2026-03-28T00:00:00.000Z",
        updatedAt: "2026-03-28T00:00:00.000Z",
        messageCount: 2,
        referenceLabel: null,
        telegramChatId: null,
        workspaceId: null
      },
      detail: {
        chatId: "local-chat-1",
        source: "desktop_chat" as const,
        title: "Новый чат",
        createdAt: "2026-03-28T00:00:00.000Z",
        updatedAt: "2026-03-28T00:00:00.000Z",
        messageCount: 2,
        referenceLabel: null,
        telegramChatId: null,
        workspaceId: null,
        messages: []
      }
    })),
    createDesktopChat: vi.fn(async () => ({
      chatId: "local-chat-1",
      source: "desktop_chat" as const,
      title: "Новый чат",
      createdAt: "2026-03-28T00:00:00.000Z",
      updatedAt: "2026-03-28T00:00:00.000Z",
      messageCount: 0,
      referenceLabel: null,
      telegramChatId: null,
      workspaceId: null
    })),
    getLocalChats: vi.fn(async () => []),
    getLocalChatDetail: vi.fn(async () => null),
    getLocalChatRunState: vi.fn(async () => null),
    subscribeLocalChatEvents: vi.fn(() => () => undefined),
    subscribeLocalChatRunEvents: vi.fn(() => () => undefined),
    getActivityLog: vi.fn(async () => []),
    getAppsState: vi.fn(async () => ({ items: [] })),
    getAssistantProcesses: vi.fn(async () => []),
    getAppPreferences: vi.fn(async () => ({
      launchAtLogin: false,
      notificationsEnabled: true,
      startHiddenOnLaunch: false,
      closeToTrayOnClose: true
    })),
    getVaultSettings: vi.fn(async () => ({
      vaultRoot: "D:\\KarpikVault",
      isConfigured: true
    })),
    getAuthConfigState: vi.fn(async () => ({
      passwordConfigured: true,
      totpConfigured: true
    })),
    createTotpEnrollment: vi.fn(),
    confirmTotpEnrollment: vi.fn(),
    getCodexConfigState: vi.fn(async () => ({
      workspaces: [],
      defaultWorkspaceId: "",
      chatBindings: {}
    })),
    getKnowledgeState: vi.fn(async () => []),
    getLocalApprovals: vi.fn(async () => []),
    getPairingState: vi.fn(async () => ({
      code: null,
      expiresAt: null,
      isActive: false,
      trustedTelegramUserIds: []
    })),
    getUpdateState: vi.fn(async () => ({
      currentVersion: "0.1.8",
      feedUrl: null,
      isSupported: true,
      phase: "idle" as const,
      lastCheckedAt: null,
      availableReleaseName: null,
      message: null
    })),
    approveLocalApproval: vi.fn(),
    checkForUpdates: vi.fn(),
    createLocalContinuationChat: vi.fn(),
    openPairingSession: vi.fn(),
    installUpdate: vi.fn(),
    refreshDiscoveredApps: vi.fn(async () => ({ items: [] })),
    readKnowledgeEntry: vi.fn(async () => null),
    rejectLocalApproval: vi.fn(),
    cancelTask: vi.fn(),
    cancelLocalChatRun: vi.fn(async () => true),
    retryTask: vi.fn(),
    sendLocalChatMessage: vi.fn(async () => null),
    saveAuthConfig: vi.fn(),
    saveVaultRoot: vi.fn(async (vaultRoot: string) => ({
      vaultRoot,
      isConfigured: true
    })),
    saveAppPreferences: vi.fn(),
    saveAppRegistryEntry: vi.fn(async () => ({ items: [] })),
    saveChatWorkspaceBinding: vi.fn(),
    saveCodexConfig: vi.fn(),
    removeAppRegistryEntry: vi.fn(async () => ({ items: [] }))
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("App shell redesign", () => {
  it("opens on the new home page and shows the reference hero copy", async () => {
    render(<App />);

    expect(await screen.findByRole("heading", { name: /доброе утро, степан/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/спросите о чем нибудь/i)).toBeInTheDocument();
    expect(screen.getByText(/новый чат/i)).toBeInTheDocument();
  });

  it("shows a separate profile page and hides empty fields in view mode", async () => {
    render(<App />);

    const [profileButton] = await screen.findAllByRole("button", { name: /^профиль$/i });
    fireEvent.click(profileButton);

    expect(await screen.findByText("Степан Карпов")).toBeInTheDocument();
    expect(screen.getByText("Москва")).toBeInTheDocument();
    expect(screen.queryByText(/биография/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /редактировать/i }));
    const bioInput = screen.getByLabelText(/биография/i);
    fireEvent.change(bioInput, { target: { value: "Любит автоматизацию" } });
    fireEvent.click(screen.getByRole("button", { name: /сохранить/i }));

    await waitFor(() => {
      expect(saveOwnerProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          bio: "Любит автоматизацию"
        })
      );
    });
  });
});
