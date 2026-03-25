import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";

describe("desktop renderer feedback", () => {
  const getTaskSnapshot = vi.fn();
  const saveAuthConfig = vi.fn();
  const saveCodexConfig = vi.fn();
  const saveChatWorkspaceBinding = vi.fn();

  beforeEach(() => {
    getTaskSnapshot.mockReset();
    saveAuthConfig.mockReset();
    saveCodexConfig.mockReset();
    saveChatWorkspaceBinding.mockReset();

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
    saveAuthConfig.mockResolvedValue({
      passwordConfigured: true,
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

    window.karpik = {
      view: "main",
      getActivityLog: vi.fn(async () => []),
      getAppPreferences: vi.fn(async () => ({
        launchAtLogin: false,
        notificationsEnabled: true,
        startHiddenOnLaunch: true,
        closeToTrayOnClose: true
      })),
      getAuthConfigState: vi.fn(async () => ({
        passwordConfigured: false,
        totpConfigured: false
      })),
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
        currentVersion: "0.1.1",
        feedUrl: null,
        isSupported: false,
        phase: "disabled" as const,
        lastCheckedAt: null,
        availableReleaseName: null,
        message: null
      })),
      approveLocalApproval: vi.fn(async () => undefined),
      checkForUpdates: vi.fn(async () => ({
        currentVersion: "0.1.1",
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
      saveAppPreferences: vi.fn(async (payload) => ({
        launchAtLogin: Boolean(payload.launchAtLogin),
        notificationsEnabled: Boolean(payload.notificationsEnabled),
        startHiddenOnLaunch: Boolean(payload.startHiddenOnLaunch),
        closeToTrayOnClose: Boolean(payload.closeToTrayOnClose)
      })),
      saveChatWorkspaceBinding,
      saveCodexConfig
    };
  });

  afterEach(() => {
    cleanup();
  });

  it("shows a visible success message after saving auth settings", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Настройки" }));
    fireEvent.change(await screen.findByLabelText("Пароль для remote auth"), {
      target: { value: "secret-password" }
    });
    fireEvent.change(await screen.findByLabelText("TOTP secret"), {
      target: { value: "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ" }
    });
    fireEvent.click(await screen.findByRole("button", { name: "Сохранить auth-настройки" }));

    expect(await screen.findByText("Auth settings saved locally.")).toBeInTheDocument();
  });

  it("shows a visible success message after saving workspaces", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Настройки" }));
    fireEvent.click(await screen.findByRole("button", { name: "Save workspaces" }));

    expect(await screen.findByText("Workspace settings saved.")).toBeInTheDocument();
  });

  it("shows a visible success message after binding a telegram chat to a workspace", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Чаты Telegram" }));
    fireEvent.click(await screen.findByRole("button", { name: "Save chat workspace" }));

    expect(await screen.findByText("Workspace binding saved for chat 5001.")).toBeInTheDocument();
  });
});
