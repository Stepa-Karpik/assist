import crypto from "node:crypto";

export type ChatRunStatus = "thinking" | "streaming" | "cancelled" | "failed" | "completed";

export type ChatRunState = {
  runId: string;
  chatId: string;
  status: ChatRunStatus;
  cancelRequested: boolean;
  ackMessageId: string | null;
  replyMessageId: string;
};

type StartChatRunInput = {
  chatId: string;
  ackMessageId?: string | null;
  replyMessageId: string;
};

export function createChatRunStore() {
  const runsByChatId = new Map<string, ChatRunState>();

  return {
    canSend(chatId: string): boolean {
      return !runsByChatId.has(chatId);
    },
    getRun(chatId: string): ChatRunState | null {
      const run = runsByChatId.get(chatId);
      return run ? { ...run } : null;
    },
    startRun(input: StartChatRunInput): ChatRunState {
      const nextRun: ChatRunState = {
        runId: crypto.randomUUID(),
        chatId: input.chatId,
        status: "thinking",
        cancelRequested: false,
        ackMessageId: input.ackMessageId ?? null,
        replyMessageId: input.replyMessageId
      };
      runsByChatId.set(input.chatId, nextRun);
      return { ...nextRun };
    },
    updateStatus(chatId: string, status: ChatRunStatus): ChatRunState | null {
      const current = runsByChatId.get(chatId);
      if (!current) {
        return null;
      }

      const nextRun: ChatRunState = {
        ...current,
        status
      };
      runsByChatId.set(chatId, nextRun);
      return { ...nextRun };
    },
    requestCancel(chatId: string): boolean {
      const current = runsByChatId.get(chatId);
      if (!current) {
        return false;
      }

      runsByChatId.set(chatId, {
        ...current,
        status: "cancelled",
        cancelRequested: true
      });
      return true;
    },
    finishRun(chatId: string, _status: Extract<ChatRunStatus, "completed" | "cancelled" | "failed">): void {
      runsByChatId.delete(chatId);
    }
  };
}

export type ChatRunStore = ReturnType<typeof createChatRunStore>;
