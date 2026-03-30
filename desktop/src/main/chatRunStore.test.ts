import { describe, expect, it } from "vitest";

import { createChatRunStore } from "./chatRunStore";

describe("createChatRunStore", () => {
  it("tracks one active run per chat and supports cancellation", () => {
    const store = createChatRunStore();

    const run = store.startRun({
      chatId: "chat-1",
      ackMessageId: "ack-1",
      replyMessageId: "reply-1"
    });

    expect(store.getRun("chat-1")).toMatchObject({
      runId: run.runId,
      chatId: "chat-1",
      status: "thinking",
      cancelRequested: false
    });
    expect(store.canSend("chat-1")).toBe(false);

    expect(store.requestCancel("chat-1")).toBe(true);
    expect(store.getRun("chat-1")).toMatchObject({
      runId: run.runId,
      status: "cancelled",
      cancelRequested: true
    });

    store.finishRun("chat-1", "completed");

    expect(store.getRun("chat-1")).toBeNull();
    expect(store.canSend("chat-1")).toBe(true);
  });
});
