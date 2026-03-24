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

type KnowledgeSection = {
  id: "master_info" | "knowledge" | "notes" | "websites";
  label: string;
  entries: Array<{
    relativePath: string;
    displayName: string;
  }>;
};

type AppPreferences = {
  launchAtLogin: boolean;
  notificationsEnabled: boolean;
  startHiddenOnLaunch: boolean;
  closeToTrayOnClose: boolean;
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
const saveAppPreferences = vi.fn(async () => ({
  launchAtLogin: true,
  notificationsEnabled: false,
  startHiddenOnLaunch: false,
  closeToTrayOnClose: false
}));

const saveAuthConfig = vi.fn(async () => ({
  passwordConfigured: true,
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

const getPairingState = vi.fn(async () => ({
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
const getKnowledgeState = vi.fn<() => Promise<KnowledgeSection[]>>(async () => [
  {
    id: "knowledge",
    label: "Knowledge",
    entries: [
      {
        relativePath: "review.md",
        displayName: "review.md"
      },
      {
        relativePath: "weekly.md",
        displayName: "weekly.md"
      }
    ]
  },
  {
    id: "notes",
    label: "Notes",
    entries: [
      {
        relativePath: "daily.txt",
        displayName: "daily.txt"
      }
    ]
  }
]);
const readKnowledgeEntry = vi.fn(
  async (payload: { sectionId: KnowledgeSection["id"]; relativePath: string }) => ({
    sectionId: payload.sectionId,
    relativePath: payload.relativePath,
    content:
      payload.relativePath === "weekly.md"
        ? "weekly review"
        : payload.relativePath === "daily.txt"
          ? "daily note"
          : "review body"
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
      getAppPreferences,
      getAuthConfigState,
      getCodexConfigState,
      getKnowledgeState,
      getLocalApprovals,
      getLocalChats,
      getLocalChatDetail,
      getPairingState,
      getQuickAccessState,
      getRuntimeStatus,
      getTaskSnapshot,
      openPairingSession,
      approveLocalApproval,
      rejectLocalApproval,
      retryTask,
      readKnowledgeEntry,
      createDesktopChat,
      createLocalContinuationChat,
      submitQuickRequest,
      sendLocalChatMessage,
      saveAuthConfig,
      saveAppPreferences,
      saveChatWorkspaceBinding,
      saveCodexConfig
    };
  });

  afterEach(() => {
    cleanup();
    getActivityLog.mockClear();
    getAppPreferences.mockClear();
    getAuthConfigState.mockClear();
    getCodexConfigState.mockClear();
    getKnowledgeState.mockClear();
    getLocalApprovals.mockClear();
    getLocalChats.mockClear();
    getLocalChatDetail.mockClear();
    getPairingState.mockClear();
    getQuickAccessState.mockClear();
    getRuntimeStatus.mockClear();
    getTaskSnapshot.mockClear();
    openPairingSession.mockClear();
    approveLocalApproval.mockClear();
    rejectLocalApproval.mockClear();
    retryTask.mockClear();
    readKnowledgeEntry.mockClear();
    createDesktopChat.mockClear();
    createLocalContinuationChat.mockClear();
    submitQuickRequest.mockClear();
    sendLocalChatMessage.mockClear();
    saveAuthConfig.mockClear();
    saveAppPreferences.mockClear();
    saveChatWorkspaceBinding.mockClear();
    saveCodexConfig.mockClear();
  });

  it("renders all primary sections", () => {
    render(<App />);

    expect(screen.getByRole("button", { name: "Чаты" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Чаты Telegram" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Невыполненное" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Knowledge / Review" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Логи" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Сервисы" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Настройки" })).toBeInTheDocument();
  });

  it("shows local chat empty state and lets the user create a desktop chat", async () => {
    render(<App />);

    expect(await screen.findByText("Локальных чатов пока нет.")).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "Новый локальный чат" }));

    expect(createDesktopChat).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Новый локальный чат")).toBeInTheDocument();
    expect(await screen.findByText("desktop_chat")).toBeInTheDocument();
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

    render(<App />);

    expect(await screen.findByText("Ready.")).toBeInTheDocument();
    fireEvent.change(await screen.findByLabelText("Local request"), {
      target: { value: "status" }
    });
    fireEvent.click(await screen.findByRole("button", { name: "Send" }));

    expect(sendLocalChatMessage).toHaveBeenCalledWith({
      chatId: "local-chat-10",
      text: "status"
    });
    expect(await screen.findByText("desktop-local is online")).toBeInTheDocument();
  });

  it("shows pairing controls and workspace registry settings", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Настройки" }));

    expect(await screen.findByRole("button", { name: "Открыть pairing" })).toBeInTheDocument();
    expect(await screen.findByLabelText("Пароль для remote auth")).toBeInTheDocument();
    expect(await screen.findByLabelText("TOTP secret")).toBeInTheDocument();
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
    expect(getAuthConfigState).toHaveBeenCalledTimes(1);
    expect(getAppPreferences).toHaveBeenCalledTimes(1);
    expect(getCodexConfigState).toHaveBeenCalledTimes(1);
    expect(getPairingState).toHaveBeenCalledTimes(1);
  });

  it("saves desktop operator preferences from the settings page", async () => {
    render(<App />);

    fireEvent.click(
      screen.getByRole("navigation", { name: "Primary navigation" }).querySelectorAll("button")[6]!
    );
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
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Настройки" }));
    fireEvent.click(await screen.findByRole("button", { name: "Открыть pairing" }));

    expect(openPairingSession).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Код: PAIR42")).toBeInTheDocument();
  });

  it("saves auth settings from the settings page", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Настройки" }));
    fireEvent.change(await screen.findByLabelText("Пароль для remote auth"), {
      target: { value: "secret-password" }
    });
    fireEvent.change(await screen.findByLabelText("TOTP secret"), {
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
    render(<App />);

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
    getTaskSnapshot.mockResolvedValueOnce([
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

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Чаты Telegram" }));

    expect(await screen.findByText("task-1")).toBeInTheDocument();
    expect(await screen.findByText("status")).toBeInTheDocument();
    expect(await screen.findByText("desktop-local is online")).toBeInTheDocument();
    expect(await screen.findByLabelText("Workspace for chat 5001")).toBeInTheDocument();
  });

  it("saves a Telegram chat workspace binding", async () => {
    getTaskSnapshot.mockResolvedValueOnce([
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

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Чаты Telegram" }));
    fireEvent.change(await screen.findByLabelText("Workspace for chat 5001"), {
      target: { value: "default-workspace" }
    });
    fireEvent.click(await screen.findByRole("button", { name: "Save chat workspace" }));

    expect(saveChatWorkspaceBinding).toHaveBeenCalledWith({
      chatId: 5001,
      workspaceId: "default-workspace"
    });
  });

  it("continues a Telegram chat into local chats", async () => {
    getTaskSnapshot.mockResolvedValueOnce([
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

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Чаты Telegram" }));
    fireEvent.click(await screen.findByRole("button", { name: "Продолжить чат" }));

    expect(createLocalContinuationChat).toHaveBeenCalledWith({
      telegramChatId: 5001,
      title: "Telegram 5001",
      workspaceId: "assist-repo"
    });
    expect(await screen.findByText("Telegram 5001")).toBeInTheDocument();
    expect(await screen.findByText("Ссылается на Telegram chat 5001")).toBeInTheDocument();
  });

  it("shows blocked and failed tasks in the blocked page", async () => {
    getTaskSnapshot.mockResolvedValueOnce([
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

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Невыполненное" }));

    expect(await screen.findByText("task-2")).toBeInTheDocument();
    expect(await screen.findByText("read docs/missing.txt")).toBeInTheDocument();
    expect(await screen.findByText("File not found.")).toBeInTheDocument();
  });

  it("retries a failed task from the blocked page", async () => {
    getTaskSnapshot
      .mockResolvedValueOnce([
        {
          task_id: "task-2",
          intent: "read docs/missing.txt",
          status: "failed",
          result_text: null,
          error_text: "File not found.",
          chat_id: 5001,
          telegram_user_id: 101
        }
      ])
      .mockResolvedValueOnce([
        {
          task_id: "task-2",
          intent: "read docs/missing.txt",
          status: "queued",
          result_text: null,
          error_text: null,
          chat_id: 5001,
          telegram_user_id: 101
        }
      ]);

    render(<App />);

    fireEvent.click(
      screen
        .getByRole("navigation", { name: "Primary navigation" })
        .querySelectorAll("button")[2]!
    );
    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));

    expect(retryTask).toHaveBeenCalledWith("task-2");
    await waitFor(() => {
      expect(screen.queryByText("task-2")).not.toBeInTheDocument();
    });
  });

  it("shows local approval previews and allows approving them", async () => {
    getTaskSnapshot.mockResolvedValueOnce([
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
    getLocalApprovals.mockResolvedValueOnce([
      {
        taskId: "task-approval",
        intent: "codex-write update README",
        summaryText: "Updated README",
        previewText: "diff preview",
        changedFiles: ["README.md"],
        createdAt: "2026-03-24T12:00:00Z"
      }
    ]);

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Невыполненное" }));

    expect(await screen.findByText("Updated README")).toBeInTheDocument();
    expect(await screen.findByText("diff preview")).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "Approve" }));

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
    expect(await screen.findByText("Approximate completion across active tasks: 80%")).toBeInTheDocument();
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
          title: "РќРѕРІС‹Р№ Р»РѕРєР°Р»СЊРЅС‹Р№ С‡Р°С‚",
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
            title: "Р СњР С•Р Р†РЎвЂ№Р в„– Р В»Р С•Р С”Р В°Р В»РЎРЉР Р…РЎвЂ№Р в„– РЎвЂЎР В°РЎвЂљ",
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
    expect(await screen.findByText("Local chats: 2")).toBeInTheDocument();
  });

  it("shows runtime activity entries in the logs page", async () => {
    getActivityLog.mockResolvedValueOnce([
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

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Логи" }));

    expect(await screen.findByText("Quick request completed")).toBeInTheDocument();
    expect(await screen.findByText("desktop-local is online")).toBeInTheDocument();
  });

  it("shows runtime service status in the services page", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Сервисы" }));

    expect(await screen.findByText("Device ID: desktop-local")).toBeInTheDocument();
    expect(await screen.findByText("Server URL: http://127.0.0.1:8000")).toBeInTheDocument();
    expect(await screen.findByText("Server heartbeat: online")).toBeInTheDocument();
    expect(await screen.findByText("Server reachable: yes")).toBeInTheDocument();
    expect(await screen.findByText("Last active chat: Execution chat")).toBeInTheDocument();
    expect(await screen.findByText("Default workspace: Assist")).toBeInTheDocument();
  });

  it("shows knowledge files and switches preview", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Knowledge / Review" }));

    expect(await screen.findByText("review.md")).toBeInTheDocument();
    expect(await screen.findByText("review body")).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "weekly.md" }));

    expect(readKnowledgeEntry).toHaveBeenCalledWith({
      sectionId: "knowledge",
      relativePath: "weekly.md"
    });
    expect(await screen.findByText("weekly review")).toBeInTheDocument();
  });
});
