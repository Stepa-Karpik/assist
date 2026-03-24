// @vitest-environment node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { ActivityLogStore } from "./activityLogStore";
import { LocalChatStore } from "./localChatStore";
import { createQuickAccessRuntime } from "./quickAccessRuntime";

const tempRoots: string[] = [];

function createStateRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "karpik-quick-access-runtime-"));
  tempRoots.push(root);
  return root;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("createQuickAccessRuntime", () => {
  it("targets the most recent local chat when one already exists", async () => {
    const stateRoot = createStateRoot();
    const chatStore = new LocalChatStore({
      stateRoot,
      now: () => new Date("2026-03-24T16:10:00.000Z"),
      generateChatId: () => "local-chat-1"
    });
    chatStore.createDesktopChat({
      title: "Execution chat"
    });
    const sendMessage = vi.fn(async () =>
      chatStore.appendMessage("local-chat-1", {
        role: "assistant",
        text: "desktop-local is online"
      })
    );
    const runtime = createQuickAccessRuntime({
      chatStore,
      activityLogStore: new ActivityLogStore({
        stateRoot
      }),
      sendMessage
    });

    const result = await runtime.submitRequest({
      text: "status"
    });

    expect(sendMessage).toHaveBeenCalledWith({
      chatId: "local-chat-1",
      text: "status"
    });
    expect(result.chat.chatId).toBe("local-chat-1");
    expect(result.detail.messages.at(-1)?.text).toBe("desktop-local is online");
  });

  it("creates a desktop chat automatically when none exist", async () => {
    const stateRoot = createStateRoot();
    let chatCounter = 0;
    const chatStore = new LocalChatStore({
      stateRoot,
      now: () => new Date("2026-03-24T16:15:00.000Z"),
      generateChatId: () => {
        chatCounter += 1;
        return `local-chat-${chatCounter}`;
      }
    });
    const sendMessage = vi.fn(async ({ chatId }: { chatId: string; text: string }) =>
      chatStore.appendMessage(chatId, {
        role: "assistant",
        text: "done"
      })
    );
    const runtime = createQuickAccessRuntime({
      chatStore,
      activityLogStore: new ActivityLogStore({
        stateRoot
      }),
      sendMessage
    });

    const result = await runtime.submitRequest({
      text: "codex summarize repo"
    });

    expect(result.chat.title).toBe("Новый локальный чат");
    expect(result.chat.chatId).toBe("local-chat-1");
    expect(sendMessage).toHaveBeenCalledWith({
      chatId: "local-chat-1",
      text: "codex summarize repo"
    });
  });
});
