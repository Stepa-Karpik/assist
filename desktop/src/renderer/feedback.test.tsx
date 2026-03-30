import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";

describe("desktop renderer feedback", () => {
  const getTaskSnapshot = vi.fn();
  const getOwnerProfileState = vi.fn();
  const saveAuthConfig = vi.fn();
  const saveOwnerProfile = vi.fn();
  const createTotpEnrollment = vi.fn();
  const confirmTotpEnrollment = vi.fn();
  const saveCodexConfig = vi.fn();
  const saveChatWorkspaceBinding = vi.fn();
  const getAppsState = vi.fn();
  const getAssistantProcesses = vi.fn();
  const refreshDiscoveredApps = vi.fn();
  const saveAppRegistryEntry = vi.fn();
  const removeAppRegistryEntry = vi.fn();

  beforeEach(async () => {
    getTaskSnapshot.mockReset();
    getOwnerProfileState.mockReset();
    saveAuthConfig.mockReset();
    saveOwnerProfile.mockReset();
    createTotpEnrollment.mockReset();
    confirmTotpEnrollment.mockReset();
    saveCodexConfig.mockReset();
    saveChatWorkspaceBinding.mockReset();
    getAppsState.mockReset();
    getAssistantProcesses.mockReset();
    refreshDiscoveredApps.mockReset();
    saveAppRegistryEntry.mockReset();
    removeAppRegistryEntry.mockReset();

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
    getOwnerProfileState.mockResolvedValue({
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
    });
    saveAuthConfig.mockResolvedValue({
      passwordConfigured: true,
      totpConfigured: true
    });
    createTotpEnrollment.mockResolvedValue({
      secret: "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ",
      otpAuthUri:
        "otpauth://totp/Karpik:stepa-desktop?secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ&issuer=Karpik&algorithm=SHA1&digits=6&period=30",
      qrDataUrl: "data:image/png;base64,ZmFrZS1xci1kYXRh",
      issuer: "Karpik",
      accountName: "stepa-desktop"
    });
    confirmTotpEnrollment.mockResolvedValue({
      passwordConfigured: false,
      totpConfigured: true
    });
    saveCodexConfig.mockResolvedValue({
      workspaces: [
        {
          id: "default-workspace",
          name: "Default",
          rootPath: "C:\\Users\\TBG\\Desktop\\assist"
        }
      ],
      defaultWorkspaceId: "default-workspace",
      chatBindings: {}
    });
    saveChatWorkspaceBinding.mockResolvedValue({
      workspaces: [
        {
          id: "default-workspace",
          name: "Default",
          rootPath: "C:\\Users\\TBG\\Desktop\\assist"
        }
      ],
      defaultWorkspaceId: "default-workspace",
      chatBindings: {
        "5001": "default-workspace"
      }
    });
    getAppsState.mockResolvedValue({
      items: [
        {
          appId: "osu",
          displayName: "osu! lazer",
          launchPath: "C:\\Games\\osu!\\osu!.exe",
          aliases: ["osu", "осу"],
          linked: true,
          source: "manual"
        }
      ]
    });
    getAssistantProcesses.mockResolvedValue([]);
    refreshDiscoveredApps.mockResolvedValue(await getAppsState());
    saveAppRegistryEntry.mockResolvedValue(await getAppsState());
    removeAppRegistryEntry.mockResolvedValue(await getAppsState());

    window.karpik = {
      view: "main",
      getActivityLog: vi.fn(async () => []),
      getAppsState,
      getAssistantProcesses,
      getAppPreferences: vi.fn(async () => ({
        launchAtLogin: false,
        notificationsEnabled: true,
        startHiddenOnLaunch: true,
        closeToTrayOnClose: true
      })),
      getOwnerProfileState,
      getOnboardingState: vi.fn(async () => ({
        installationFingerprint: "install-a",
        completedInstallationFingerprint: "install-a",
        requiresOnboarding: false
      })),
      getAuthConfigState: vi.fn(async () => ({
        passwordConfigured: false,
        totpConfigured: false
      })),
      completeOnboarding: vi.fn(async () => ({
        installationFingerprint: "install-a",
        completedInstallationFingerprint: "install-a",
        requiresOnboarding: false
      })),
      createTotpEnrollment,
      confirmTotpEnrollment,
      getCodexConfigState: vi.fn(async () => ({
        workspaces: [
          {
            id: "default-workspace",
            name: "Default",
            rootPath: "C:\\Users\\TBG\\Desktop\\assist"
          }
        ],
        defaultWorkspaceId: "default-workspace",
        chatBindings: {}
      })),
      getKnowledgeState: vi.fn(async () => []),
      getLocalApprovals: vi.fn(async () => []),
      getLocalChats: vi.fn(async () => []),
      getLocalChatDetail: vi.fn(async () => null),
      getPairingState: vi.fn(async () => ({
        code: null,
        expiresAt: null,
        isActive: false,
        trustedTelegramUserIds: []
      })),
      getQuickAccessState: vi.fn(async () => ({
        targetChat: null,
        localChatCount: 0,
        recentActivity: [],
        recentChats: []
      })),
      getRuntimeStatus: vi.fn(async () => ({
        deviceId: "desktop-local",
        serverUrl: "http://127.0.0.1:8000",
        serverHeartbeatState: "online" as const,
        serverHeartbeatReachable: true,
        serverHeartbeatAt: null,
        pairingActive: false,
        trustedTelegramUserCount: 0,
        passwordConfigured: false,
        totpConfigured: false,
        workspaceCount: 1,
        defaultWorkspaceName: "Default",
        defaultWorkspaceRoot: "C:\\Users\\TBG\\Desktop\\assist",
        localChatCount: 0,
        lastActiveChatTitle: null,
        activityLogCount: 0,
        pendingTaskCount: 0,
        blockedTaskCount: 0
      })),
      getTaskSnapshot,
      getUpdateState: vi.fn(async () => ({
        currentVersion: "0.1.2",
        feedUrl: null,
        isSupported: false,
        phase: "disabled" as const,
        lastCheckedAt: null,
        availableReleaseName: null,
        message: null
      })),
      approveLocalApproval: vi.fn(async () => undefined),
      cancelTask: vi.fn(async () => undefined),
      checkForUpdates: vi.fn(async () => ({
        currentVersion: "0.1.2",
        feedUrl: null,
        isSupported: false,
        phase: "disabled" as const,
        lastCheckedAt: null,
        availableReleaseName: null,
        message: null
      })),
      createDesktopChat: vi.fn(async () => ({
        chatId: "chat-1",
        source: "desktop_chat" as const,
        title: "Новый локальный чат",
        createdAt: "2026-03-25T00:00:00.000Z",
        updatedAt: "2026-03-25T00:00:00.000Z",
        messageCount: 0,
        referenceLabel: null,
        telegramChatId: null,
        workspaceId: null
      })),
      createLocalContinuationChat: vi.fn(async () => ({
        chatId: "chat-2",
        source: "local_continuation_chat" as const,
        title: "Telegram 5001",
        createdAt: "2026-03-25T00:00:00.000Z",
        updatedAt: "2026-03-25T00:00:00.000Z",
        messageCount: 0,
        referenceLabel: "Ссылается на Telegram chat 5001",
        telegramChatId: 5001,
        workspaceId: "default-workspace"
      })),
      openPairingSession: vi.fn(async () => ({
        code: "PAIR42",
        expiresAt: "2026-03-25T00:05:00.000Z",
        isActive: true,
        trustedTelegramUserIds: []
      })),
      installUpdate: vi.fn(async () => undefined),
      refreshDiscoveredApps,
      readKnowledgeEntry: vi.fn(async () => null),
      rejectLocalApproval: vi.fn(async () => undefined),
      retryTask: vi.fn(async () => undefined),
      sendLocalChatMessage: vi.fn(async () => null),
      submitQuickRequest: vi.fn(async () => ({
        chat: {
          chatId: "chat-1",
          source: "desktop_chat" as const,
          title: "Новый локальный чат",
          createdAt: "2026-03-25T00:00:00.000Z",
          updatedAt: "2026-03-25T00:00:00.000Z",
          messageCount: 1,
          referenceLabel: null,
          telegramChatId: null,
          workspaceId: null
        },
        detail: {
          chatId: "chat-1",
          source: "desktop_chat" as const,
          title: "Новый локальный чат",
          createdAt: "2026-03-25T00:00:00.000Z",
          updatedAt: "2026-03-25T00:00:00.000Z",
          messageCount: 1,
          referenceLabel: null,
          telegramChatId: null,
          workspaceId: null,
          messages: []
        }
      })),
      saveAuthConfig,
      saveOwnerProfile,
      saveAppPreferences: vi.fn(async (payload) => ({
        launchAtLogin: Boolean(payload.launchAtLogin),
        notificationsEnabled: Boolean(payload.notificationsEnabled),
        startHiddenOnLaunch: Boolean(payload.startHiddenOnLaunch),
        closeToTrayOnClose: Boolean(payload.closeToTrayOnClose)
      })),
      saveAppRegistryEntry,
      saveChatWorkspaceBinding,
      saveCodexConfig,
      removeAppRegistryEntry
    };
  });

  afterEach(() => {
    cleanup();
  });

  async function renderMainView() {
    render(<App />);
    await screen.findByRole("button", { name: "Настройки" });
  }

  it("shows a visible success message after saving auth settings", async () => {
    await renderMainView();

    fireEvent.click(screen.getByRole("button", { name: "Настройки" }));
    fireEvent.change(await screen.findByLabelText("Пароль для remote auth"), {
      target: { value: "secret-password" }
    });
    fireEvent.change(await screen.findByLabelText("TOTP secret вручную (fallback)"), {
      target: { value: "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ" }
    });
    fireEvent.click(await screen.findByRole("button", { name: "Сохранить auth-настройки" }));

    expect(await screen.findByText("Auth settings saved locally.")).toBeInTheDocument();
  });

  it("supports qr-based totp enrollment before saving the secret", async () => {
    await renderMainView();

    fireEvent.click(screen.getByRole("button", { name: "Настройки" }));
    fireEvent.click(await screen.findByRole("button", { name: "Создать QR для TOTP" }));

    expect(await screen.findByAltText("TOTP QR code")).toHaveAttribute(
      "src",
      "data:image/png;base64,ZmFrZS1xci1kYXRh"
    );
    expect(await screen.findByDisplayValue("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ")).toBeInTheDocument();

    fireEvent.change(await screen.findByLabelText("Код из аутентификатора"), {
      target: { value: "287082" }
    });
    fireEvent.click(await screen.findByRole("button", { name: "Подтвердить TOTP" }));

    expect(confirmTotpEnrollment).toHaveBeenCalledWith({ code: "287082" });
    expect(await screen.findByText("TOTP confirmed and saved locally.")).toBeInTheDocument();
  });

  it("shows a visible success message after saving workspaces", async () => {
    await renderMainView();

    fireEvent.click(screen.getByRole("button", { name: "Настройки" }));
    fireEvent.click(await screen.findByRole("button", { name: "Save workspaces" }));

    expect(await screen.findByText("Workspace settings saved.")).toBeInTheDocument();
  });

  it("shows a visible success message after binding a telegram chat to a workspace", async () => {
    await renderMainView();

    fireEvent.click(screen.getByRole("button", { name: "Чаты Telegram" }));
    fireEvent.click(await screen.findByRole("button", { name: "Сохранить workspace" }));

    expect(await screen.findByText("Workspace для чата 5001 сохранён.")).toBeInTheDocument();
  });
});
