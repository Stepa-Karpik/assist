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
};

export function createLocalChatRuntime({
  chatStore,
  executeTask,
  persistLocalApproval,
  getWorkspaceRootForChat,
  generateTaskId = () => crypto.randomUUID()
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

      const workspaceRoot = getWorkspaceRootForChat?.(chatId);
      const executionResult = await executeTask({
        task_id: generateTaskId(),
        intent: normalizedText,
        workspace_root: workspaceRoot ?? undefined
      });

      if (executionResult.ok && executionResult.requiresLocalApproval) {
        await persistLocalApproval?.(normalizedText, executionResult.draft);
        return chatStore.appendMessage(chatId, {
          role: "system",
          text: executionResult.waitingText
        });
      }

      if (executionResult.ok) {
        return chatStore.appendMessage(chatId, {
          role: "assistant",
          text: executionResult.resultText
        });
      }

      return chatStore.appendMessage(chatId, {
        role: "system",
        text: executionResult.errorText
      });
    }
  };
}
