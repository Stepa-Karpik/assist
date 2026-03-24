import crypto from "node:crypto";

import type { CodexWritePreviewDraft } from "./codexWritePreview";
import type { LocalChatDetail, LocalChatStore } from "./localChatStore";
import type { ExecutableTask, TaskExecutionResult } from "./taskExecutor";

type SendLocalChatMessageInput = {
  chatId: string;
  text: string;
};

type LocalChatRuntimeOptions = {
  chatStore: LocalChatStore;
  executeTask: (task: ExecutableTask) => Promise<TaskExecutionResult>;
  persistLocalApproval?: (
    intent: string,
    draft: CodexWritePreviewDraft
  ) => Promise<void> | void;
  getWorkspaceRootForChat?: (chatId: string) => string | null | undefined;
  generateTaskId?: () => string;
  logActivity?: (input: {
    kind: "local_request" | "local_result";
    status: "info" | "success" | "warning" | "error";
    title: string;
    detail?: string | null;
    chatId: string;
  }) => void;
};

export function createLocalChatRuntime({
  chatStore,
  executeTask,
  persistLocalApproval,
  getWorkspaceRootForChat,
  generateTaskId = () => crypto.randomUUID(),
  logActivity
}: LocalChatRuntimeOptions) {
  return {
    async sendMessage({ chatId, text }: SendLocalChatMessageInput): Promise<LocalChatDetail> {
      const normalizedText = text.trim();

      if (!normalizedText) {
        throw new Error("Local request is empty.");
      }

      chatStore.appendMessage(chatId, {
        role: "user",
        text: normalizedText
      });
      logActivity?.({
        kind: "local_request",
        status: "info",
        title: "Local request",
        detail: normalizedText,
        chatId
      });

      const workspaceRoot = getWorkspaceRootForChat?.(chatId);
      const executionResult = await executeTask({
        task_id: generateTaskId(),
        intent: normalizedText,
        workspace_root: workspaceRoot ?? undefined
      });

      if (executionResult.ok && executionResult.requiresLocalApproval) {
        await persistLocalApproval?.(normalizedText, executionResult.draft);
        logActivity?.({
          kind: "local_result",
          status: "warning",
          title: "Local request is waiting for review",
          detail: executionResult.waitingText,
          chatId
        });
        return chatStore.appendMessage(chatId, {
          role: "system",
          text: executionResult.waitingText
        });
      }

      if (executionResult.ok) {
        logActivity?.({
          kind: "local_result",
          status: "success",
          title: "Local request completed",
          detail: executionResult.resultText,
          chatId
        });
        return chatStore.appendMessage(chatId, {
          role: "assistant",
          text: executionResult.resultText
        });
      }

      logActivity?.({
        kind: "local_result",
        status: "error",
        title: "Local request failed",
        detail: executionResult.errorText,
        chatId
      });
      return chatStore.appendMessage(chatId, {
        role: "system",
        text: executionResult.errorText
      });
    }
  };
}
