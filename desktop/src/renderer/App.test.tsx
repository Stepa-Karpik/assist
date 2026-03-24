import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import type { TaskSnapshot } from "./pages/taskSnapshot";

const getAuthConfigState = vi.fn(async () => ({
  passwordConfigured: false,
  totpConfigured: false
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

const openPairingSession = vi.fn(async () => ({
  code: "PAIR42",
  expiresAt: "2026-03-24T00:05:00.000Z",
  isActive: true,
  trustedTelegramUserIds: []
}));

describe("App navigation", () => {
  beforeEach(() => {
    window.karpik = {
      view: "main",
      getAuthConfigState,
      getCodexConfigState,
      getLocalApprovals,
      getPairingState,
      getTaskSnapshot,
      openPairingSession,
      approveLocalApproval,
      rejectLocalApproval,
      saveAuthConfig,
      saveChatWorkspaceBinding,
      saveCodexConfig
    };
  });

  afterEach(() => {
    cleanup();
    getAuthConfigState.mockClear();
    getCodexConfigState.mockClear();
    getLocalApprovals.mockClear();
    getPairingState.mockClear();
    getTaskSnapshot.mockClear();
    openPairingSession.mockClear();
    approveLocalApproval.mockClear();
    rejectLocalApproval.mockClear();
    saveAuthConfig.mockClear();
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

  it("shows pairing controls and workspace registry settings", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Настройки" }));

    expect(await screen.findByRole("button", { name: "Открыть pairing" })).toBeInTheDocument();
    expect(await screen.findByLabelText("Пароль для remote auth")).toBeInTheDocument();
    expect(await screen.findByLabelText("TOTP secret")).toBeInTheDocument();
    expect(await screen.findByLabelText("Workspace name 1")).toBeInTheDocument();
    expect(await screen.findByLabelText("Workspace path 2")).toBeInTheDocument();
    expect(await screen.findByLabelText("Default workspace")).toBeInTheDocument();
    expect(await screen.findByText("Pairing не активен")).toBeInTheDocument();
    expect(await screen.findByText("Password: не настроен")).toBeInTheDocument();
    expect(await screen.findByText("TOTP: не настроен")).toBeInTheDocument();
    expect(getAuthConfigState).toHaveBeenCalledTimes(1);
    expect(getCodexConfigState).toHaveBeenCalledTimes(1);
    expect(getPairingState).toHaveBeenCalledTimes(1);
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
});
