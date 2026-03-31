import crypto from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import { ChatSessionStore } from "./chatSessionStore";
import { createConversationEventRuntime } from "./conversationEventRuntime";

function createJsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });

  return { promise, resolve };
}

describe("createConversationEventRuntime", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("runs pending telegram conversation events and persists codex session mapping", async () => {
    const stateRoot = `.tmp-conversation-event-runtime-${crypto.randomUUID()}`;
    const fetchConversationEvents = vi.fn(async () =>
      createJsonResponse({
        items: [
          {
            event_id: "conv-1",
            device_id: "desktop-local",
            chat_id: 5001,
            telegram_user_id: 101,
            prompt: "Сколько стран в мире?",
            status: "pending",
            revision: 0
          }
        ]
      })
    );
    const updateConversationEvent = vi.fn(async () => new Response(null, { status: 200 }));
    const recordKnowledgeInteraction = vi.fn(async () => {});
    const chatSessionStore = new ChatSessionStore({ stateRoot });
    const conversationRunner = {
      start: vi.fn(() => ({
        cancel: vi.fn(),
        result: Promise.resolve({
          sessionId: "session-1",
          text: "Обычно считают 195 государств.",
          partialText: "Обычно считают 195 государств.",
          cancelled: false
        })
      }))
    };
    const runtime = createConversationEventRuntime({
      client: {
        fetchConversationEvents,
        updateConversationEvent
      },
      conversationRunner,
      chatSessionStore,
      deviceId: "desktop-local",
      resolveWorkspaceRoot: () => "C:/workspace",
      recordKnowledgeInteraction
    });

    await runtime.syncPendingEvents();
    await Promise.resolve();
    await Promise.resolve();

    expect(conversationRunner.start).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: "telegram:5001",
        prompt: "Сколько стран в мире?",
        workspaceRoot: "C:/workspace",
        sessionId: undefined,
        onDelta: expect.any(Function)
      })
    );
    expect(updateConversationEvent).toHaveBeenCalledWith("conv-1", {
      status: "completed",
      response_text: "Обычно считают 195 государств."
    });
    expect(recordKnowledgeInteraction).toHaveBeenCalledWith({
      origin: "telegram-chat",
      prompt: "Сколько стран в мире?",
      answer: "Обычно считают 195 государств."
    });
    expect(chatSessionStore.getByTelegramChatId(5001)).toMatchObject({
      chatId: "telegram:5001",
      deviceId: "desktop-local",
      codexSessionId: "session-1",
      telegramChatId: 5001,
      interrupted: false
    });
  });

  it("pushes running progress on delta before final completion", async () => {
    vi.useFakeTimers();

    let onDelta: ((chunk: string) => void) | undefined;
    const updateConversationEvent = vi.fn(async () => new Response(null, { status: 200 }));
    const chatSessionStore = new ChatSessionStore({
      stateRoot: `.tmp-conversation-event-runtime-${crypto.randomUUID()}`
    });
    const deferred = createDeferred<{
      sessionId: string;
      text: string;
      partialText: string;
      cancelled: boolean;
    }>();
    const conversationRunner = {
      start: vi.fn((input: { onDelta?: (chunk: string) => void }) => {
        onDelta = input.onDelta;
        return {
          cancel: vi.fn(),
          result: deferred.promise
        };
      })
    };
    const runtime = createConversationEventRuntime({
      client: {
        fetchConversationEvents: async () =>
          createJsonResponse({
            items: [
              {
                event_id: "conv-2",
                device_id: "desktop-local",
                chat_id: 6001,
                telegram_user_id: 102,
                prompt: "Расскажи про FastAPI",
                status: "pending",
                revision: 0
              }
            ]
          }),
        updateConversationEvent
      },
      conversationRunner,
      chatSessionStore,
      deviceId: "desktop-local",
      resolveWorkspaceRoot: () => "C:/workspace"
    });

    const syncPromise = runtime.syncPendingEvents();
    await syncPromise;
    onDelta?.("Черновик ");
    vi.advanceTimersByTime(300);
    await Promise.resolve();
    deferred.resolve({
      sessionId: "session-2",
      text: "Итоговый ответ.",
      partialText: "Итоговый ответ.",
      cancelled: false
    });
    await Promise.resolve();

    expect(updateConversationEvent).toHaveBeenCalledWith("conv-2", {
      status: "running",
      response_text: "Черновик"
    });
    expect(updateConversationEvent).toHaveBeenLastCalledWith("conv-2", {
      status: "completed",
      response_text: "Итоговый ответ."
    });
  });
});
