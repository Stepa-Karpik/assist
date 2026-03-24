// @vitest-environment node

import os from "node:os";
import path from "node:path";
import fs from "node:fs";

import { afterEach, describe, expect, it, vi } from "vitest";

import { LocalChatStore } from "./localChatStore";
import { createLocalChatRuntime } from "./localChatRuntime";

const tempRoots: string[] = [];

function createStateRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "karpik-local-chat-runtime-"));
  tempRoots.push(root);
  return root;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("createLocalChatRuntime", () => {
  it("appends user and assistant messages for successful local execution", async () => {
    const chatStore = new LocalChatStore({
      stateRoot: createStateRoot(),
      now: () => new Date("2026-03-24T13:00:00.000Z"),
      generateChatId: () => "local-chat-1"
    });
    chatStore.createDesktopChat({
      title: "Local execution"
    });
    const executeTask = vi.fn(async () => ({
      ok: true as const,
      resultText: "desktop-local is online"
    }));
    const runtime = createLocalChatRuntime({
      chatStore,
      executeTask,
      generateTaskId: () => "local-task-1",
      getWorkspaceRootForChat: () => "D:\\Projects\\assist"
    });

    const detail = await runtime.sendMessage({
      chatId: "local-chat-1",
      text: "status"
    });

    expect(executeTask).toHaveBeenCalledWith({
      task_id: "local-task-1",
      intent: "status",
      workspace_root: "D:\\Projects\\assist"
    });
    expect(detail.messages.map((message) => message.text)).toEqual([
      "status",
      "desktop-local is online"
    ]);
  });

  it("appends a system message for failed local execution", async () => {
    const chatStore = new LocalChatStore({
      stateRoot: createStateRoot(),
      now: () => new Date("2026-03-24T13:05:00.000Z"),
      generateChatId: () => "local-chat-2"
    });
    chatStore.createDesktopChat({
      title: "Local failure"
    });
    const runtime = createLocalChatRuntime({
      chatStore,
      executeTask: async () => ({
        ok: false as const,
        errorText: "Unsupported task intent."
      }),
      generateTaskId: () => "local-task-2"
    });

    const detail = await runtime.sendMessage({
      chatId: "local-chat-2",
      text: "screenshot primary"
    });

    expect(detail.messages.map((message) => `${message.role}:${message.text}`)).toEqual([
      "user:screenshot primary",
      "system:Unsupported task intent."
    ]);
  });

  it("stores local approval drafts and appends a waiting system message", async () => {
    const chatStore = new LocalChatStore({
      stateRoot: createStateRoot(),
      now: () => new Date("2026-03-24T13:10:00.000Z"),
      generateChatId: () => "local-chat-3"
    });
    chatStore.createDesktopChat({
      title: "Local approval"
    });
    const persistLocalApproval = vi.fn(async () => undefined);
    const runtime = createLocalChatRuntime({
      chatStore,
      executeTask: async () => ({
        ok: true as const,
        requiresLocalApproval: true,
        waitingText: "Waiting for local review. Files: README.md",
        draft: {
          taskId: "local-task-3",
          workspaceRoot: "D:\\Projects\\assist",
          previewRoot: "D:\\Projects\\assist\\.preview",
          summaryText: "Updated README",
          previewText: "diff preview",
          changedFiles: ["README.md"],
          changes: []
        }
      }),
      generateTaskId: () => "local-task-3",
      persistLocalApproval
    });

    const detail = await runtime.sendMessage({
      chatId: "local-chat-3",
      text: "codex-write update readme"
    });

    expect(persistLocalApproval).toHaveBeenCalledWith(
      "codex-write update readme",
      expect.objectContaining({
        taskId: "local-task-3"
      })
    );
    expect(detail.messages.map((message) => `${message.role}:${message.text}`)).toEqual([
      "user:codex-write update readme",
      "system:Waiting for local review. Files: README.md"
    ]);
  });
});
