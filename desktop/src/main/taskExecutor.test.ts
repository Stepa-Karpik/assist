// @vitest-environment node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createTaskExecutor } from "./taskExecutor";

const tempRoots: string[] = [];

function createUserRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "karpik-task-executor-"));
  const userRoot = path.join(root, "docs", "user");
  fs.mkdirSync(userRoot, { recursive: true });
  tempRoots.push(root);
  return userRoot;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("createTaskExecutor", () => {
  it("returns a device status reply for the status intent", async () => {
    const executor = createTaskExecutor({
      deviceId: "desktop-local",
      userRoot: createUserRoot()
    });

    const result = await executor.execute({
      task_id: "task-1",
      intent: "status"
    });

    expect(result).toEqual({
      ok: true,
      resultText: "desktop-local онлайн"
    });
  });

  it("reads a file from the runtime user root", async () => {
    const userRoot = createUserRoot();
    const targetFile = path.join(userRoot, "docs", "note.txt");
    fs.mkdirSync(path.dirname(targetFile), { recursive: true });
    fs.writeFileSync(targetFile, "latest note");
    const executor = createTaskExecutor({
      deviceId: "desktop-local",
      userRoot
    });

    const result = await executor.execute({
      task_id: "task-2",
      intent: "read docs/note.txt"
    });

    expect(result).toEqual({
      ok: true,
      resultText: "latest note"
    });
  });

  it("lists files from the runtime user root", async () => {
    const userRoot = createUserRoot();
    const docsRoot = path.join(userRoot, "docs");
    fs.mkdirSync(docsRoot, { recursive: true });
    fs.writeFileSync(path.join(docsRoot, "note-a.txt"), "a");
    fs.writeFileSync(path.join(docsRoot, "note-b.txt"), "b");
    const executor = createTaskExecutor({
      deviceId: "desktop-local",
      userRoot
    });

    const result = await executor.execute({
      task_id: "task-list",
      intent: "list docs"
    });

    expect(result).toEqual({
      ok: true,
      resultText: "note-a.txt\nnote-b.txt"
    });
  });

  it("writes a note inside the runtime notes folder", async () => {
    const userRoot = createUserRoot();
    const executor = createTaskExecutor({
      deviceId: "desktop-local",
      userRoot
    });

    const result = await executor.execute({
      task_id: "task-write",
      intent: "write-note daily.txt :: hello world"
    });

    expect(result).toEqual({
      ok: true,
      resultText: "docs/notes/daily.txt"
    });
    expect(
      fs.readFileSync(path.join(userRoot, "docs", "notes", "daily.txt"), "utf8")
    ).toBe("hello world");
  });

  it("rejects invalid note names for write-note", async () => {
    const executor = createTaskExecutor({
      deviceId: "desktop-local",
      userRoot: createUserRoot()
    });

    const result = await executor.execute({
      task_id: "task-invalid-note",
      intent: "write-note ..\\escape.txt :: hello"
    });

    expect(result).toEqual({
      ok: false,
      errorText: "Ошибка: некорректное имя заметки."
    });
  });

  it("rejects path traversal outside the runtime user root", async () => {
    const executor = createTaskExecutor({
      deviceId: "desktop-local",
      userRoot: createUserRoot()
    });

    const result = await executor.execute({
      task_id: "task-3",
      intent: "read ..\\..\\Windows\\win.ini"
    });

    expect(result).toEqual({
      ok: false,
      errorText: "Ошибка: путь вне разрешённой области."
    });
  });

  it("runs codex prompts in the configured workspace", async () => {
    const workspaceRoot = createUserRoot();
    const runCodex = vi.fn(async () => "Codex summary");
    const executor = createTaskExecutor({
      deviceId: "desktop-local",
      userRoot: createUserRoot(),
      getCodexWorkspaceRoot: () => workspaceRoot,
      runCodex
    });

    const result = await executor.execute({
      task_id: "task-codex",
      intent: "codex summarize the latest notes"
    });

    expect(result).toEqual({
      ok: true,
      resultText: "Codex summary"
    });
    expect(runCodex).toHaveBeenCalledWith({
      prompt: "summarize the latest notes",
      workspaceRoot
    });
  });

  it("routes Telegram codex tasks through the chat-bound workspace", async () => {
    const defaultWorkspaceRoot = createUserRoot();
    const boundWorkspaceRoot = createUserRoot();
    const runCodex = vi.fn(async () => "Codex summary");
    const executor = createTaskExecutor({
      deviceId: "desktop-local",
      userRoot: createUserRoot(),
      resolveCodexWorkspace: (task) =>
        task.chat_id === 5001 ? boundWorkspaceRoot : defaultWorkspaceRoot,
      runCodex
    });

    const result = await executor.execute({
      task_id: "task-codex-bound",
      intent: "codex summarize the latest notes",
      chat_id: 5001
    });

    expect(result).toEqual({
      ok: true,
      resultText: "Codex summary"
    });
    expect(runCodex).toHaveBeenCalledWith({
      prompt: "summarize the latest notes",
      workspaceRoot: boundWorkspaceRoot
    });
  });

  it("prefers explicit local workspace context for codex tasks", async () => {
    const workspaceRoot = createUserRoot();
    const runCodex = vi.fn(async () => "Codex local chat summary");
    const executor = createTaskExecutor({
      deviceId: "desktop-local",
      userRoot: createUserRoot(),
      resolveCodexWorkspace: () => "D:\\ignored",
      runCodex
    });

    const result = await executor.execute({
      task_id: "task-codex-local-chat",
      intent: "codex summarize current workspace",
      workspace_root: workspaceRoot
    });

    expect(result).toEqual({
      ok: true,
      resultText: "Codex local chat summary"
    });
    expect(runCodex).toHaveBeenCalledWith({
      prompt: "summarize current workspace",
      workspaceRoot
    });
  });

  it("rejects empty codex prompts", async () => {
    const runCodex = vi.fn(async () => "unused");
    const executor = createTaskExecutor({
      deviceId: "desktop-local",
      userRoot: createUserRoot(),
      runCodex
    });

    const result = await executor.execute({
      task_id: "task-codex-empty",
      intent: "codex    "
    });

    expect(result).toEqual({
      ok: false,
      errorText: "Ошибка: пустой запрос для Codex."
    });
    expect(runCodex).not.toHaveBeenCalled();
  });

  it("fails codex tasks when the configured workspace does not exist", async () => {
    const runCodex = vi.fn(async () => "unused");
    const executor = createTaskExecutor({
      deviceId: "desktop-local",
      userRoot: createUserRoot(),
      getCodexWorkspaceRoot: () => "D:\\Missing\\Workspace",
      runCodex
    });

    const result = await executor.execute({
      task_id: "task-codex-missing",
      intent: "codex inspect the workspace"
    });

    expect(result).toEqual({
      ok: false,
      errorText: "Ошибка: рабочая папка Codex не найдена."
    });
    expect(runCodex).not.toHaveBeenCalled();
  });

  it("surfaces codex runner failures explicitly", async () => {
    const workspaceRoot = createUserRoot();
    const executor = createTaskExecutor({
      deviceId: "desktop-local",
      userRoot: createUserRoot(),
      getCodexWorkspaceRoot: () => workspaceRoot,
      runCodex: async () => {
        throw new Error("Codex CLI is unavailable.");
      }
    });

    const result = await executor.execute({
      task_id: "task-codex-error",
      intent: "codex inspect the workspace"
    });

    expect(result).toEqual({
      ok: false,
      errorText: "Ошибка: Codex сейчас недоступен."
    });
  });

  it("starts codex tasks as deferred executions with a cancel handle", async () => {
    const workspaceRoot = createUserRoot();
    const cancel = vi.fn();
    const startCodexRun = vi.fn(() => ({
      result: Promise.resolve("Codex summary"),
      cancel
    }));
    const executor = createTaskExecutor({
      deviceId: "desktop-local",
      userRoot: createUserRoot(),
      getCodexWorkspaceRoot: () => workspaceRoot,
      startCodexRun
    });

    const execution = executor.start({
      task_id: "task-codex-deferred",
      intent: "codex summarize current status"
    });

    expect(execution.kind).toBe("deferred");
    expect(await execution.result).toEqual({
      ok: true,
      resultText: "Codex summary"
    });
    await execution.cancel?.();
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(startCodexRun).toHaveBeenCalledWith({
      prompt: "summarize current status",
      workspaceRoot
    });
  });

  it("routes codex-write tasks into local approval when preview changes exist", async () => {
    const workspaceRoot = createUserRoot();
    const generateCodexWritePreview = vi.fn(async () => ({
      kind: "awaiting_local_approval" as const,
      draft: {
        taskId: "task-codex-write",
        workspaceRoot,
        previewRoot: path.join(workspaceRoot, ".preview"),
        summaryText: "Updated README",
        previewText: "diff preview",
        changedFiles: ["README.md"],
        changes: [
          {
            kind: "write" as const,
            relativePath: "README.md",
            originalHash: "hash-before"
          }
        ]
      }
    }));
    const executor = createTaskExecutor({
      deviceId: "desktop-local",
      userRoot: createUserRoot(),
      getCodexWorkspaceRoot: () => workspaceRoot,
      generateCodexWritePreview
    });

    const result = await executor.execute({
      task_id: "task-codex-write",
      intent: "codex-write update the readme"
    });

    expect(generateCodexWritePreview).toHaveBeenCalledWith({
      taskId: "task-codex-write",
      prompt: "update the readme",
      workspaceRoot
    });
    expect(result).toEqual({
      ok: true,
      requiresLocalApproval: true,
      waitingText: "Ожидает локального подтверждения. Файлы: README.md",
      draft: {
        taskId: "task-codex-write",
        workspaceRoot,
        previewRoot: path.join(workspaceRoot, ".preview"),
        summaryText: "Updated README",
        previewText: "diff preview",
        changedFiles: ["README.md"],
        changes: [
          {
            kind: "write",
            relativePath: "README.md",
            originalHash: "hash-before"
          }
        ]
      }
    });
  });

  it("completes codex-write tasks immediately when preview contains no file changes", async () => {
    const workspaceRoot = createUserRoot();
    const generateCodexWritePreview = vi.fn(async () => ({
      kind: "no_changes" as const,
      summaryText: "No changes needed"
    }));
    const executor = createTaskExecutor({
      deviceId: "desktop-local",
      userRoot: createUserRoot(),
      getCodexWorkspaceRoot: () => workspaceRoot,
      generateCodexWritePreview
    });

    const result = await executor.execute({
      task_id: "task-codex-write-noop",
      intent: "codex-write inspect the workspace"
    });

    expect(result).toEqual({
      ok: true,
      resultText: "No changes needed"
    });
  });

  it("captures a screenshot artifact for the screenshot intent", async () => {
    const captureScreenshot = vi.fn(async () => ({
      mimeType: "image/png",
      fileName: "desktop-local-2026-03-24T13-00-00Z.png",
      contentBase64: "c2NyZWVuc2hvdA=="
    }));
    const executor = createTaskExecutor({
      deviceId: "desktop-local",
      userRoot: createUserRoot(),
      captureScreenshot
    });

    const result = await executor.execute({
      task_id: "task-4",
      intent: "screenshot"
    });

    expect(result).toEqual({
      ok: true,
      resultText: "Скриншот готов.",
      artifact: {
        kind: "image_base64",
        mimeType: "image/png",
        fileName: "desktop-local-2026-03-24T13-00-00Z.png",
        contentBase64: "c2NyZWVuc2hvdA=="
      }
    });
    expect(captureScreenshot).toHaveBeenCalledWith("screen-1");
  });

  it("captures the requested secondary screen", async () => {
    const captureScreenshot = vi.fn(async () => ({
      mimeType: "image/png",
      fileName: "desktop-local-screen-2.png",
      contentBase64: "c2NyZWVuc2hvdDI="
    }));
    const executor = createTaskExecutor({
      deviceId: "desktop-local",
      userRoot: createUserRoot(),
      captureScreenshot
    });

    const result = await executor.execute({
      task_id: "task-4b",
      intent: "screenshot screen-2"
    });

    expect(result).toEqual({
      ok: true,
      resultText: "Скриншот готов.",
      artifact: {
        kind: "image_base64",
        mimeType: "image/png",
        fileName: "desktop-local-screen-2.png",
        contentBase64: "c2NyZWVuc2hvdDI="
      }
    });
    expect(captureScreenshot).toHaveBeenCalledWith("screen-2");
  });

  it("fails unsupported task intents explicitly", async () => {
    const executor = createTaskExecutor({
      deviceId: "desktop-local",
      userRoot: createUserRoot()
    });

    const result = await executor.execute({
      task_id: "task-unsupported",
      intent: "run powershell Get-ChildItem"
    });

    expect(result).toEqual({
      ok: false,
      errorText: "Ошибка: такая команда пока не поддерживается."
    });
  });

  it("opens a site through the injected site launcher", async () => {
    const openSite = vi.fn(async () => undefined);
    const executor = createTaskExecutor({
      deviceId: "desktop-local",
      userRoot: createUserRoot(),
      openSite
    });

    const result = await executor.execute({
      task_id: "task-site",
      intent: "open-site https://youtube.com"
    });

    expect(result).toEqual({
      ok: true,
      resultText: "Сайт открыт."
    });
    expect(openSite).toHaveBeenCalledWith("https://youtube.com");
  });

  it("launches a registered app as a deferred execution", async () => {
    const kill = vi.fn(async () => undefined);
    const launchApp = vi.fn(async () => ({
      pid: 4242,
      waitForExit: async () => undefined,
      kill
    }));
    const registerAssistantProcess = vi.fn();
    const markAssistantProcessExited = vi.fn();
    const executor = createTaskExecutor({
      deviceId: "desktop-local",
      userRoot: createUserRoot(),
      getRegisteredApp: (appId) =>
        appId === "app-osu"
          ? {
              appId: "app-osu",
              displayName: "osu! lazer",
              launchPath: "C:\\Games\\osu!\\osu!.exe",
              aliases: ["osu", "осу"],
              linked: true,
              source: "manual"
            }
          : null,
      launchApp,
      registerAssistantProcess,
      markAssistantProcessExited
    });

    const execution = executor.start({
      task_id: "task-app",
      intent: "launch-app app-osu"
    });

    expect(execution.kind).toBe("deferred");
    expect(await execution.result).toEqual({
      ok: true,
      resultText: "Приложение osu! lazer завершилось."
    });
    expect(registerAssistantProcess).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: "task-app",
        appId: "app-osu",
        displayName: "osu! lazer",
        pid: 4242
      })
    );
    expect(markAssistantProcessExited).toHaveBeenCalledWith("task-app");
  });

  it("kills an assistant-started app by query", async () => {
    const kill = vi.fn(async () => undefined);
    const markAssistantProcessCancelled = vi.fn();
    const executor = createTaskExecutor({
      deviceId: "desktop-local",
      userRoot: createUserRoot(),
      findAssistantProcessByQuery: (query) =>
        query === "осу"
          ? {
              taskId: "task-app",
              appId: "app-osu",
              displayName: "osu! lazer",
              aliases: ["osu", "осу"],
              pid: 4242,
              kill
            }
          : null,
      markAssistantProcessCancelled
    });

    const result = await executor.execute({
      task_id: "task-kill-app",
      intent: "kill-app осу"
    });

    expect(result).toEqual({
      ok: true,
      resultText: "Останавливаю osu! lazer."
    });
    expect(kill).toHaveBeenCalledTimes(1);
    expect(markAssistantProcessCancelled).toHaveBeenCalledWith("task-app");
  });

  it("normalizes raw codex CLI argument errors to Russian", async () => {
    const workspaceRoot = createUserRoot();
    const executor = createTaskExecutor({
      deviceId: "desktop-local",
      userRoot: createUserRoot(),
      getCodexWorkspaceRoot: () => workspaceRoot,
      runCodex: async () => {
        throw new Error("error: unexpected argument 'osu' found");
      }
    });

    const result = await executor.execute({
      task_id: "task-codex-russian",
      intent: "codex osu"
    });

    expect(result).toEqual({
      ok: false,
      errorText: "Ошибка: аргумент 'osu' не найден."
    });
  });
});
