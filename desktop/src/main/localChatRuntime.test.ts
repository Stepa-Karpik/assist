import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { ChatSessionStore } from "./chatSessionStore";
import { createChatRunStore } from "./chatRunStore";
import { LocalChatStore } from "./localChatStore";
import { createLocalConversationRouter } from "./localConversationRouter";
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

  it("reuses the same codex session for follow-up messages in one local chat", async () => {
    const stateRoot = createStateRoot();
    const chatStore = new LocalChatStore({
      stateRoot,
      now: () => new Date("2026-03-31T01:00:00.000Z"),
      generateChatId: () => "local-chat-codex"
    });
    chatStore.createDesktopChat({
      title: "Codex session chat"
    });
    const chatSessionStore = new ChatSessionStore({
      stateRoot
    });
    const startConversation = vi
      .fn()
      .mockImplementationOnce(() => ({
        result: Promise.resolve({
          sessionId: "session-local-1",
          text: "First answer",
          partialText: "First answer",
          cancelled: false
        }),
        cancel: vi.fn()
      }))
      .mockImplementationOnce(() => ({
        result: Promise.resolve({
          sessionId: "session-local-1",
          text: "Second answer",
          partialText: "Second answer",
          cancelled: false
        }),
        cancel: vi.fn()
      }));

    const runtime = createLocalChatRuntime({
      chatStore,
      chatRunStore: createChatRunStore(),
      chatSessionStore,
      conversationRunner: {
        start: startConversation
      },
      executeTask: vi.fn(async () => ({
        ok: true as const,
        resultText: "unused"
      })),
      deviceId: "stepa-desktop",
      getWorkspaceRootForChat: () => "D:\\Projects\\assist"
    });

    await runtime.sendMessage({
      chatId: "local-chat-codex",
      text: "Привет"
    });
    await Promise.resolve();
    await Promise.resolve();

    await runtime.sendMessage({
      chatId: "local-chat-codex",
      text: "А теперь продолжи"
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(startConversation).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        chatId: "local-chat-codex",
        prompt: "Привет",
        workspaceRoot: "D:\\Projects\\assist",
        sessionId: undefined
      })
    );
    expect(startConversation).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        chatId: "local-chat-codex",
        prompt: "А теперь продолжи",
        workspaceRoot: "D:\\Projects\\assist",
        sessionId: "session-local-1"
      })
    );
    expect(chatSessionStore.getByLocalChatId("local-chat-codex")).toEqual({
      chatId: "local-chat-codex",
      telegramChatId: null,
      deviceId: "stepa-desktop",
      codexSessionId: "session-local-1",
      interrupted: false
    });
  });

  it("cancels only the active run of the selected chat", async () => {
    const stateRoot = createStateRoot();
    const chatIds = ["chat-a", "chat-b"];
    const chatStore = new LocalChatStore({
      stateRoot,
      now: () => new Date("2026-03-31T01:05:00.000Z"),
      generateChatId: () => chatIds.shift() ?? crypto.randomUUID()
    });
    const firstChat = chatStore.createDesktopChat({
      title: "Chat A"
    });
    const secondChat = chatStore.createDesktopChat({
      title: "Chat B"
    });
    const chatSessionStore = new ChatSessionStore({
      stateRoot
    });

    let resolveFirst!: (value: { sessionId: string; text: string; partialText: string; cancelled: boolean }) => void;
    let resolveSecond!: (value: { sessionId: string; text: string; partialText: string; cancelled: boolean }) => void;
    const cancelFirst = vi.fn();
    const cancelSecond = vi.fn();

    const startConversation = vi
      .fn()
      .mockImplementationOnce(() => ({
        result: new Promise((resolve) => {
          resolveFirst = resolve;
        }),
        cancel: cancelFirst
      }))
      .mockImplementationOnce(() => ({
        result: new Promise((resolve) => {
          resolveSecond = resolve;
        }),
        cancel: cancelSecond
      }));

    const runtime = createLocalChatRuntime({
      chatStore,
      chatRunStore: createChatRunStore(),
      chatSessionStore,
      conversationRunner: {
        start: startConversation
      },
      executeTask: vi.fn(async () => ({
        ok: true as const,
        resultText: "unused"
      })),
      deviceId: "stepa-desktop",
      getWorkspaceRootForChat: () => "D:\\Projects\\assist"
    });

    await runtime.sendMessage({
      chatId: firstChat.chatId,
      text: "Первый чат"
    });
    await runtime.sendMessage({
      chatId: secondChat.chatId,
      text: "Второй чат"
    });

    expect(runtime.cancelRun(firstChat.chatId)).toBe(true);
    expect(cancelFirst).toHaveBeenCalledTimes(1);
    expect(cancelSecond).not.toHaveBeenCalled();

    resolveFirst({
      sessionId: "session-a",
      text: "Partial A",
      partialText: "Partial A",
      cancelled: true
    });
    resolveSecond({
      sessionId: "session-b",
      text: "Reply B",
      partialText: "Reply B",
      cancelled: false
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(runtime.getRun(firstChat.chatId)).toBeNull();
    expect(runtime.getRun(secondChat.chatId)).toBeNull();
    expect(chatSessionStore.getByLocalChatId(firstChat.chatId)?.interrupted).toBe(true);
    expect(chatSessionStore.getByLocalChatId(secondChat.chatId)?.interrupted).toBe(false);
  });

describe("createLocalChatRuntime", () => {
  it("returns immediately with ack and a pending assistant placeholder for conversational replies", async () => {
    const chatStore = new LocalChatStore({
      stateRoot: createStateRoot(),
      now: () => new Date("2026-03-30T14:00:00.000Z"),
      generateChatId: () => "local-chat-stream"
    });
    chatStore.createDesktopChat({
      title: "Streaming chat"
    });

    let resolveReply!: (value: string) => void;
    const streamReply = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveReply = resolve;
        })
    );
    const onChatUpdated = vi.fn();

    const runtime = createLocalChatRuntime({
      chatStore,
      chatRunStore: createChatRunStore(),
      executeTask: vi.fn(async () => ({
        ok: true as const,
        resultText: "unused"
      })),
      streamReply,
      onChatUpdated,
      streamDelayMs: 0
    });

    const detail = await runtime.sendMessage({
      chatId: "local-chat-stream",
      text: "что нового в FastAPI?"
    });

    expect(detail.messages.map((message) => `${message.role}:${message.text}`)).toEqual([
      "user:что нового в FastAPI?",
      "assistant:Сейчас посмотрю и отвечу по сути.",
      "assistant:Ассистент отвечает..."
    ]);
    expect(streamReply).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: "local-chat-stream",
        prompt: "что нового в FastAPI?"
      })
    );

    resolveReply("FastAPI недавно обновился.");
    await Promise.resolve();
    await Promise.resolve();

    expect(onChatUpdated.mock.lastCall?.[0]).toEqual(
      expect.objectContaining({
        chatId: "local-chat-stream",
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: "user",
            text: "что нового в FastAPI?"
          }),
          expect.objectContaining({
            role: "assistant",
            text: "FastAPI недавно обновился."
          })
        ])
      })
    );
  });

  it("keeps the final streamed reply visible when knowledge recording fails", async () => {
    const chatStore = new LocalChatStore({
      stateRoot: createStateRoot(),
      now: () => new Date("2026-03-30T14:02:00.000Z"),
      generateChatId: () => "local-chat-memory-failure"
    });
    chatStore.createDesktopChat({
      title: "Memory failure chat"
    });

    const onChatUpdated = vi.fn();
    const runtime = createLocalChatRuntime({
      chatStore,
      chatRunStore: createChatRunStore(),
      executeTask: vi.fn(async () => ({
        ok: true as const,
        resultText: "unused"
      })),
      streamReply: vi.fn(async () => "В мире обычно считают 195 государств."),
      recordKnowledgeInteraction: vi.fn(async () => {
        throw new Error("knowledge write failed");
      }),
      onChatUpdated,
      streamDelayMs: 0
    });

    await runtime.sendMessage({
      chatId: "local-chat-memory-failure",
      text: "сколько стран в мире?"
    });

    await Promise.resolve();
    await Promise.resolve();

    const finalDetail = chatStore.getChat("local-chat-memory-failure");
    expect(finalDetail?.messages.at(-1)?.text).toBe("В мире обычно считают 195 государств.");
    expect(onChatUpdated.mock.lastCall?.[0]?.messages.at(-1)?.text).toBe(
      "В мире обычно считают 195 государств."
    );
  });

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
    const recordKnowledgeInteraction = vi.fn(async () => undefined);
    const runtime = createLocalChatRuntime({
      chatStore,
      chatRunStore: createChatRunStore(),
      executeTask,
      recordKnowledgeInteraction,
      generateTaskId: () => "local-task-1",
      getWorkspaceRootForChat: () => "D:\\Projects\\assist",
      streamDelayMs: 0
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
    expect(recordKnowledgeInteraction).toHaveBeenCalledWith({
      origin: "local-chat",
      prompt: "status",
      answer: "desktop-local is online"
    });
    expect(detail.messages.map((message) => message.text)).toEqual(["status", "desktop-local is online"]);
  });

  it("normalizes free-form screenshot requests before execution", async () => {
    const chatStore = new LocalChatStore({
      stateRoot: createStateRoot(),
      now: () => new Date("2026-03-24T13:05:00.000Z"),
      generateChatId: () => "local-chat-2"
    });
    chatStore.createDesktopChat({
      title: "Local failure"
    });
    const executeTask = vi.fn(async () => ({
      ok: false as const,
      errorText: "Unable to capture screenshot."
    }));
    const runtime = createLocalChatRuntime({
      chatStore,
      chatRunStore: createChatRunStore(),
      executeTask,
      generateTaskId: () => "local-task-2",
      streamDelayMs: 0
    });

    const detail = await runtime.sendMessage({
      chatId: "local-chat-2",
      text: "screenshot primary"
    });

    expect(executeTask).toHaveBeenCalledWith({
      task_id: "local-task-2",
      intent: "screenshot screen-1",
      workspace_root: undefined
    });
    expect(detail.messages.map((message) => `${message.role}:${message.text}`)).toEqual([
      "user:screenshot primary",
      "system:Unable to capture screenshot."
    ]);
  });

  it("returns a lightweight assistant reply for a generic greeting", async () => {
    const chatStore = new LocalChatStore({
      stateRoot: createStateRoot(),
      now: () => new Date("2026-03-24T13:06:00.000Z"),
      generateChatId: () => "local-chat-2b"
    });
    chatStore.createDesktopChat({
      title: "Local assistant"
    });
    const executeTask = vi.fn(async () => ({
      ok: true as const,
      resultText: "unused"
    }));
    const runtime = createLocalChatRuntime({
      chatStore,
      chatRunStore: createChatRunStore(),
      executeTask,
      generateTaskId: () => "local-task-2b",
      streamDelayMs: 0
    });

    const detail = await runtime.sendMessage({
      chatId: "local-chat-2b",
      text: "привет"
    });

    expect(executeTask).not.toHaveBeenCalled();
    expect(detail.messages.map((message) => `${message.role}:${message.text}`)).toEqual([
      "user:привет",
      "assistant:Привет. Чем помочь?"
    ]);
  });

  it("passes owner profile context only into the local chat responder", async () => {
    const chatStore = new LocalChatStore({
      stateRoot: createStateRoot(),
      now: () => new Date("2026-03-24T13:07:00.000Z"),
      generateChatId: () => "local-chat-context"
    });
    chatStore.createDesktopChat({
      title: "Local assistant context"
    });
    const executeTask = vi.fn(async () => ({
      ok: true as const,
      resultText: "unused"
    }));
    const chatResponder = {
      reply: vi.fn(async () => "Привет. Чем помочь?")
    };
    const runtime = createLocalChatRuntime({
      chatStore,
      chatRunStore: createChatRunStore(),
      executeTask,
      generateTaskId: () => "local-task-context",
      resolveInput: createLocalConversationRouter({
        chatResponder,
        getOwnerProfileContext: () => "Владелец: Степан Карпов\nГород: Москва"
      }).resolve,
      streamDelayMs: 0
    });

    const detail = await runtime.sendMessage({
      chatId: "local-chat-context",
      text: "привет"
    });

    expect(executeTask).not.toHaveBeenCalled();
    expect(chatResponder.reply).toHaveBeenCalledWith("привет", {
      ownerProfileContext: "Владелец: Степан Карпов\nГород: Москва"
    });
    expect(detail.messages.map((message) => `${message.role}:${message.text}`)).toEqual([
      "user:привет",
      "assistant:Привет. Чем помочь?"
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
      chatRunStore: createChatRunStore(),
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
      persistLocalApproval,
      streamDelayMs: 0
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

  it("stores screenshot artifacts in the assistant message", async () => {
    const chatStore = new LocalChatStore({
      stateRoot: createStateRoot(),
      now: () => new Date("2026-03-24T13:20:00.000Z"),
      generateChatId: () => "local-chat-4"
    });
    chatStore.createDesktopChat({
      title: "Artifacts"
    });
    const runtime = createLocalChatRuntime({
      chatStore,
      chatRunStore: createChatRunStore(),
      executeTask: async () => ({
        ok: true as const,
        resultText: "Screenshot captured.",
        artifact: {
          kind: "image_base64",
          mimeType: "image/png",
          fileName: "desktop-local.png",
          contentBase64: "aGVsbG8="
        }
      }),
      generateTaskId: () => "local-task-4",
      streamDelayMs: 0
    });

    const detail = await runtime.sendMessage({
      chatId: "local-chat-4",
      text: "screenshot"
    });

    expect(detail.messages.at(-1)).toEqual(
      expect.objectContaining({
        role: "assistant",
        text: "Screenshot captured.",
        artifactKind: "image_base64",
        artifactMimeType: "image/png",
        artifactFileName: "desktop-local.png",
        artifactBase64: "aGVsbG8="
      })
    );
  });

  it("passes recent chat history into the conversational responder", async () => {
    const chatStore = new LocalChatStore({
      stateRoot: createStateRoot(),
      now: () => new Date("2026-03-31T00:01:00.000Z"),
      generateChatId: () => "local-chat-history"
    });
    chatStore.createDesktopChat({
      title: "History chat"
    });
    chatStore.appendMessage("local-chat-history", {
      role: "user",
      text: "Меня зовут Степан"
    });
    chatStore.appendMessage("local-chat-history", {
      role: "assistant",
      text: "Принял, Степан."
    });

    const replyToConversation = vi.fn(async () => ({
      text: "Твоё предыдущее сообщение: Меня зовут Степан."
    }));

    const runtime = createLocalChatRuntime({
      chatStore,
      chatRunStore: createChatRunStore(),
      executeTask: vi.fn(async () => ({
        ok: true as const,
        resultText: "unused"
      })),
      replyToConversation,
      streamDelayMs: 0
    });

    await runtime.sendMessage({
      chatId: "local-chat-history",
      text: "Какое было моё предыдущее сообщение?"
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(replyToConversation).toHaveBeenCalledWith(
      expect.objectContaining({
        historyContext: expect.stringContaining("Пользователь: Меня зовут Степан")
      })
    );
    expect(replyToConversation).toHaveBeenCalledWith(
      expect.objectContaining({
        historyContext: expect.stringContaining("Ассистент: Принял, Степан.")
      })
    );
  });
});
