// @vitest-environment node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { ChatSessionStore } from "./chatSessionStore";

const tempRoots: string[] = [];

function createStateRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "karpik-chat-session-store-"));
  tempRoots.push(root);
  return root;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("ChatSessionStore", () => {
  it("persists local chat session mappings", () => {
    const stateRoot = createStateRoot();
    const store = new ChatSessionStore({
      stateRoot
    });

    store.saveLocalChatSession({
      chatId: "local-1",
      deviceId: "stepa-desktop",
      codexSessionId: "session-1"
    });

    const reloaded = new ChatSessionStore({
      stateRoot
    });

    expect(reloaded.getByLocalChatId("local-1")).toEqual({
      chatId: "local-1",
      telegramChatId: null,
      deviceId: "stepa-desktop",
      codexSessionId: "session-1",
      interrupted: false
    });
  });

  it("reuses an existing telegram session for a continuation local chat", () => {
    const store = new ChatSessionStore({
      stateRoot: createStateRoot()
    });

    store.saveTelegramChatSession({
      telegramChatId: 5001,
      deviceId: "stepa-desktop",
      codexSessionId: "session-telegram"
    });

    const linked = store.linkLocalChatToTelegramChat({
      chatId: "local-cont-1",
      telegramChatId: 5001
    });

    expect(linked).toEqual({
      chatId: "local-cont-1",
      telegramChatId: 5001,
      deviceId: "stepa-desktop",
      codexSessionId: "session-telegram",
      interrupted: false
    });
    expect(store.getByLocalChatId("local-cont-1")?.codexSessionId).toBe("session-telegram");
    expect(store.getByTelegramChatId(5001)?.chatId).toBe("local-cont-1");
  });

  it("persists interrupted state per local chat mapping", () => {
    const stateRoot = createStateRoot();
    const store = new ChatSessionStore({
      stateRoot
    });

    store.saveLocalChatSession({
      chatId: "local-2",
      deviceId: "stepa-desktop",
      codexSessionId: "session-2"
    });
    store.markInterrupted("local-2", true);

    const reloaded = new ChatSessionStore({
      stateRoot
    });

    expect(reloaded.getByLocalChatId("local-2")?.interrupted).toBe(true);
  });
});
