// @vitest-environment node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { LocalChatStore } from "./localChatStore";

const tempRoots: string[] = [];

function createStateRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "karpik-local-chat-store-"));
  tempRoots.push(root);
  return root;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("LocalChatStore", () => {
  it("creates and reloads a desktop chat", () => {
    const stateRoot = createStateRoot();
    const firstStore = new LocalChatStore({
      stateRoot,
      now: () => new Date("2026-03-24T12:00:00.000Z"),
      generateChatId: () => "local-chat-1"
    });

    expect(
      firstStore.createDesktopChat({
        title: "Новый локальный чат"
      })
    ).toEqual({
      chatId: "local-chat-1",
      source: "desktop_chat",
      title: "Новый локальный чат",
      createdAt: "2026-03-24T12:00:00.000Z",
      updatedAt: "2026-03-24T12:00:00.000Z",
      messageCount: 0,
      referenceLabel: null,
      telegramChatId: null,
      workspaceId: null
    });

    const secondStore = new LocalChatStore({
      stateRoot,
      generateChatId: () => "unused"
    });

    expect(secondStore.list()).toEqual([
      {
        chatId: "local-chat-1",
        source: "desktop_chat",
        title: "Новый локальный чат",
        createdAt: "2026-03-24T12:00:00.000Z",
        updatedAt: "2026-03-24T12:00:00.000Z",
        messageCount: 0,
        referenceLabel: null,
        telegramChatId: null,
        workspaceId: null
      }
    ]);
  });

  it("creates a Telegram continuation chat with a reference marker", () => {
    const store = new LocalChatStore({
      stateRoot: createStateRoot(),
      now: () => new Date("2026-03-24T12:05:00.000Z"),
      generateChatId: () => "local-chat-2"
    });

    expect(
      store.createContinuationChat({
        telegramChatId: 5001,
        title: "Telegram 5001",
        workspaceId: "assist-repo"
      })
    ).toEqual({
      chatId: "local-chat-2",
      source: "local_continuation_chat",
      title: "Telegram 5001",
      createdAt: "2026-03-24T12:05:00.000Z",
      updatedAt: "2026-03-24T12:05:00.000Z",
      messageCount: 0,
      referenceLabel: "Ссылается на Telegram chat 5001",
      telegramChatId: 5001,
      workspaceId: "assist-repo"
    });
  });

  it("reuses an existing continuation chat for the same Telegram chat", () => {
    const stateRoot = createStateRoot();
    const timestamps = [
      new Date("2026-03-24T12:05:00.000Z"),
      new Date("2026-03-24T12:10:00.000Z")
    ];
    const generatedIds = ["local-chat-2", "local-chat-3"];
    const store = new LocalChatStore({
      stateRoot,
      now: () => timestamps.shift() ?? new Date("2026-03-24T12:10:00.000Z"),
      generateChatId: () => generatedIds.shift() ?? "local-chat-4"
    });

    const firstChat = store.createContinuationChat({
      telegramChatId: 5001,
      title: "Telegram 5001",
      workspaceId: "assist-repo"
    });
    store.appendMessage(firstChat.chatId, {
      role: "assistant",
      text: "Ready."
    });

    const reusedChat = store.createContinuationChat({
      telegramChatId: 5001,
      title: "Telegram 5001 / updated",
      workspaceId: "default-workspace"
    });

    expect(reusedChat).toEqual({
      chatId: "local-chat-2",
      source: "local_continuation_chat",
      title: "Telegram 5001 / updated",
      createdAt: "2026-03-24T12:05:00.000Z",
      updatedAt: "2026-03-24T12:10:00.000Z",
      messageCount: 1,
      referenceLabel: "Ссылается на Telegram chat 5001",
      telegramChatId: 5001,
      workspaceId: "default-workspace"
    });
    expect(store.list()).toHaveLength(1);
    expect(store.getChat("local-chat-2")?.messages).toEqual([
      {
        messageId: expect.any(String),
        role: "assistant",
        text: "Ready.",
        createdAt: "2026-03-24T12:10:00.000Z"
      }
    ]);
  });

  it("lists chats newest first by updatedAt", () => {
    const stateRoot = createStateRoot();
    const firstStore = new LocalChatStore({
      stateRoot,
      now: () => new Date("2026-03-24T12:00:00.000Z"),
      generateChatId: () => "local-chat-1"
    });
    firstStore.createDesktopChat({
      title: "First"
    });

    const secondStore = new LocalChatStore({
      stateRoot,
      now: () => new Date("2026-03-24T12:10:00.000Z"),
      generateChatId: () => "local-chat-2"
    });
    secondStore.createContinuationChat({
      telegramChatId: 5002,
      title: "Second",
      workspaceId: "default-workspace"
    });

    expect(secondStore.list().map((chat) => chat.chatId)).toEqual([
      "local-chat-2",
      "local-chat-1"
    ]);
  });

  it("appends messages and exposes chat detail", () => {
    const stateRoot = createStateRoot();
    const store = new LocalChatStore({
      stateRoot,
      now: () => new Date("2026-03-24T12:20:00.000Z"),
      generateChatId: () => "local-chat-3"
    });
    const chat = store.createDesktopChat({
      title: "Execution chat"
    });

    store.appendMessage(chat.chatId, {
      role: "user",
      text: "status"
    });
    const detail = store.appendMessage(chat.chatId, {
      role: "assistant",
      text: "desktop-local is online"
    });

    expect(detail).toEqual({
      chatId: "local-chat-3",
      source: "desktop_chat",
      title: "Execution chat",
      createdAt: "2026-03-24T12:20:00.000Z",
      updatedAt: "2026-03-24T12:20:00.000Z",
      messageCount: 2,
      referenceLabel: null,
      telegramChatId: null,
      workspaceId: null,
      messages: [
        {
          messageId: expect.any(String),
          role: "user",
          text: "status",
          createdAt: "2026-03-24T12:20:00.000Z"
        },
        {
          messageId: expect.any(String),
          role: "assistant",
          text: "desktop-local is online",
          createdAt: "2026-03-24T12:20:00.000Z"
        }
      ]
    });

    expect(store.list()[0].messageCount).toBe(2);
    expect(store.getChat(chat.chatId)?.messages).toHaveLength(2);
  });

  it("reloads persisted message history from disk", () => {
    const stateRoot = createStateRoot();
    const firstStore = new LocalChatStore({
      stateRoot,
      now: () => new Date("2026-03-24T12:25:00.000Z"),
      generateChatId: () => "local-chat-4"
    });
    const chat = firstStore.createDesktopChat({
      title: "Reload chat"
    });
    firstStore.appendMessage(chat.chatId, {
      role: "user",
      text: "read docs/note.txt"
    });

    const secondStore = new LocalChatStore({
      stateRoot
    });

    expect(secondStore.getChat("local-chat-4")).toEqual({
      chatId: "local-chat-4",
      source: "desktop_chat",
      title: "Reload chat",
      createdAt: "2026-03-24T12:25:00.000Z",
      updatedAt: "2026-03-24T12:25:00.000Z",
      messageCount: 1,
      referenceLabel: null,
      telegramChatId: null,
      workspaceId: null,
      messages: [
        {
          messageId: expect.any(String),
          role: "user",
          text: "read docs/note.txt",
          createdAt: "2026-03-24T12:25:00.000Z"
        }
      ]
    });
  });

  it("persists screenshot message artifacts", () => {
    const stateRoot = createStateRoot();
    const firstStore = new LocalChatStore({
      stateRoot,
      now: () => new Date("2026-03-24T12:30:00.000Z"),
      generateChatId: () => "local-chat-5"
    });
    const chat = firstStore.createDesktopChat({
      title: "Artifact chat"
    });
    firstStore.appendMessage(chat.chatId, {
      role: "assistant",
      text: "Screenshot captured.",
      artifact: {
        kind: "image_base64",
        mimeType: "image/png",
        fileName: "desktop-local.png",
        contentBase64: "aGVsbG8="
      }
    });

    const secondStore = new LocalChatStore({
      stateRoot
    });

    expect(secondStore.getChat("local-chat-5")?.messages[0]).toEqual({
      messageId: expect.any(String),
      role: "assistant",
      text: "Screenshot captured.",
      createdAt: "2026-03-24T12:30:00.000Z",
      artifactKind: "image_base64",
      artifactMimeType: "image/png",
      artifactFileName: "desktop-local.png",
      artifactBase64: "aGVsbG8="
    });
  });

  it("mirrors a remote task update into a linked continuation chat only once per signature", () => {
    const stateRoot = createStateRoot();
    const timestamps = [
      new Date("2026-03-24T12:05:00.000Z"),
      new Date("2026-03-24T12:10:00.000Z"),
      new Date("2026-03-24T12:15:00.000Z")
    ];
    const store = new LocalChatStore({
      stateRoot,
      now: () => timestamps.shift() ?? new Date("2026-03-24T12:15:00.000Z"),
      generateChatId: () => "local-chat-6"
    });
    store.createContinuationChat({
      telegramChatId: 5001,
      title: "Telegram 5001",
      workspaceId: "assist-repo"
    });

    const firstMirror = store.mirrorRemoteTaskUpdate({
      telegramChatId: 5001,
      taskId: "task-shot",
      intent: "screenshot",
      status: "done",
      resultText: "Screenshot captured.",
      artifact: {
        kind: "image_base64",
        mimeType: "image/png",
        fileName: "desktop-remote.png",
        contentBase64: "aGVsbG8="
      }
    });
    const secondMirror = store.mirrorRemoteTaskUpdate({
      telegramChatId: 5001,
      taskId: "task-shot",
      intent: "screenshot",
      status: "done",
      resultText: "Screenshot captured.",
      artifact: {
        kind: "image_base64",
        mimeType: "image/png",
        fileName: "desktop-remote.png",
        contentBase64: "aGVsbG8="
      }
    });

    expect(firstMirror?.messages).toHaveLength(1);
    expect(firstMirror?.messages[0]).toEqual({
      messageId: expect.any(String),
      role: "system",
      text: "Telegram task task-shot completed.\nscreenshot\nScreenshot captured.",
      createdAt: "2026-03-24T12:10:00.000Z",
      artifactKind: "image_base64",
      artifactMimeType: "image/png",
      artifactFileName: "desktop-remote.png",
      artifactBase64: "aGVsbG8=",
      remoteTaskId: "task-shot",
      remoteTaskSignature: expect.any(String)
    });
    expect(secondMirror?.messages).toHaveLength(1);
    expect(secondMirror?.updatedAt).toBe("2026-03-24T12:10:00.000Z");
  });
});
