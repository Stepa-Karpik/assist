import crypto from "node:crypto";

import { createChatPlanner } from "./chatPlanner";
import type { ChatKnowledgeWrite, ChatPlan } from "./chatPlan";
import type { CodexWritePreviewDraft } from "./codexWritePreview";
import type { LocalChatDetail, LocalChatStore } from "./localChatStore";
import { createLocalConversationRouter, type LocalConversationResolution } from "./localConversationRouter";
import type { ExecutableTask, TaskExecutionResult } from "./taskExecutor";

type SendLocalChatMessageInput = {
  chatId: string;
  text: string;
};

type ConversationReplyResult = {
  text: string;
  sourceUrls?: string[];
};

type LocalChatRuntimeOptions = {
  chatStore: LocalChatStore;
  executeTask: (task: ExecutableTask) => Promise<TaskExecutionResult>;
  recordKnowledgeInteraction?: (input: {
    origin: "local-chat" | "telegram-chat";
    prompt: string;
    answer: string;
    sourceUrls?: string[];
    memoryWrites?: ChatKnowledgeWrite[];
  }) => Promise<void> | void;
  persistLocalApproval?: (
    intent: string,
    draft: CodexWritePreviewDraft
  ) => Promise<void> | void;
  streamReply?: (input: {
    chatId: string;
    prompt: string;
    plan: ChatPlan;
  }) => Promise<string | ConversationReplyResult>;
  replyToConversation?: (input: {
    chatId: string;
    prompt: string;
    plan: ChatPlan;
  }) => Promise<string | ConversationReplyResult> | string | ConversationReplyResult;
  onChatUpdated?: (detail: LocalChatDetail) => void;
  planMessage?: (text: string) => ChatPlan;
  getWorkspaceRootForChat?: (chatId: string) => string | null | undefined;
  resolveInput?: (text: string) => Promise<LocalConversationResolution> | LocalConversationResolution;
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
  recordKnowledgeInteraction,
  persistLocalApproval,
  streamReply,
  replyToConversation,
  onChatUpdated,
  planMessage = createChatPlanner().plan,
  getWorkspaceRootForChat,
  resolveInput = createLocalConversationRouter().resolve,
  generateTaskId = () => crypto.randomUUID(),
  logActivity
}: LocalChatRuntimeOptions) {
  function extractMemoryWrites(plan: ChatPlan): ChatKnowledgeWrite[] {
    return plan.actions
      .filter(
        (
          action
        ): action is Extract<ChatPlan["actions"][number], { kind: "knowledge_write"; writes: ChatKnowledgeWrite[] }> =>
          action.kind === "knowledge_write"
      )
      .flatMap((action) => action.writes);
  }

  function buildStaticConversationReply(text: string): string {
    const normalized = text.trim().toLowerCase();

    if (
      normalized.startsWith("привет") ||
      normalized.startsWith("здравствуй") ||
      normalized.startsWith("здравствуйте") ||
      normalized.startsWith("hello") ||
      normalized.startsWith("hi")
    ) {
      return "Привет. Чем помочь?";
    }

    if (
      normalized.includes("спасибо") ||
      normalized.includes("благодарю") ||
      normalized.includes("thanks") ||
      normalized.includes("thank you")
    ) {
      return "Пожалуйста.";
    }

    return "Сейчас посмотрю и отвечу по сути.";
  }

  function startBackgroundConversationReply({
    chatId,
    prompt,
    plan,
    placeholderMessageId
  }: {
    chatId: string;
    prompt: string;
    plan: ChatPlan;
    placeholderMessageId: string;
  }): void {
    void (async () => {
      try {
        const memoryWrites = extractMemoryWrites(plan);
        const reply =
          streamReply !== undefined
            ? await streamReply({
                chatId,
                prompt,
                plan
              })
            : await replyToConversation?.({
                chatId,
                prompt,
                plan
              });
        const finalText =
          typeof reply === "string"
            ? reply.trim()
            : reply?.text?.trim();
        const sourceUrls = typeof reply === "string" ? [] : reply?.sourceUrls ?? [];
        const normalizedFinalText = finalText || buildStaticConversationReply(prompt);
        const detail = chatStore.updateMessage(chatId, placeholderMessageId, {
          text: normalizedFinalText,
          role: "assistant"
        });
        await recordKnowledgeInteraction?.({
          origin: "local-chat",
          prompt,
          answer: normalizedFinalText,
          sourceUrls,
          memoryWrites
        });
        logActivity?.({
          kind: "local_result",
          status: "success",
          title: "Local assistant reply",
          detail: normalizedFinalText,
          chatId
        });
        onChatUpdated?.(detail);
      } catch (error: unknown) {
        const fallbackText = "Не удалось подготовить ответ. Попробуй уточнить запрос.";
        const detail = chatStore.updateMessage(chatId, placeholderMessageId, {
          text: fallbackText,
          role: "assistant"
        });
        logActivity?.({
          kind: "local_result",
          status: "error",
          title: "Local assistant reply failed",
          detail: error instanceof Error ? error.message : fallbackText,
          chatId
        });
        onChatUpdated?.(detail);
      }
    })();
  }

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

      const plan = planMessage(normalizedText);

      if (plan.mode === "conversation") {
        if (streamReply === undefined && replyToConversation === undefined) {
          const resolvedConversation = await resolveInput(normalizedText);
          const memoryWrites = extractMemoryWrites(plan);

          if (resolvedConversation.kind === "reply") {
            await recordKnowledgeInteraction?.({
              origin: "local-chat",
              prompt: normalizedText,
              answer: resolvedConversation.text,
              memoryWrites
            });
            logActivity?.({
              kind: "local_result",
              status: "success",
              title: "Local assistant reply",
              detail: resolvedConversation.text,
              chatId
            });
            return chatStore.appendMessage(chatId, {
              role: "assistant",
              text: resolvedConversation.text
            });
          }
        }

        const pendingDetail = chatStore.appendMessage(chatId, {
          role: "assistant",
          text: "Ассистент отвечает..."
        });
        const placeholderMessageId = pendingDetail.messages.at(-1)?.messageId;

        if (!placeholderMessageId) {
          throw new Error("Failed to create assistant placeholder message.");
        }

        onChatUpdated?.(pendingDetail);
        startBackgroundConversationReply({
          chatId,
          prompt: normalizedText,
          plan,
          placeholderMessageId
        });
        return pendingDetail;
      }

      const resolvedInput = await resolveInput(normalizedText);

      if (resolvedInput.kind === "reply") {
        await recordKnowledgeInteraction?.({
          origin: "local-chat",
          prompt: normalizedText,
          answer: resolvedInput.text
        });
        logActivity?.({
          kind: "local_result",
          status: "success",
          title: "Local assistant reply",
          detail: resolvedInput.text,
          chatId
        });
        return chatStore.appendMessage(chatId, {
          role: "assistant",
          text: resolvedInput.text
        });
      }

      const deviceTaskAction = plan.actions.find(
        (
          action
        ): action is Extract<ChatPlan["actions"][number], { kind: "device_task"; intent: string }> =>
          action.kind === "device_task"
      );
      const deviceTaskIntent = deviceTaskAction?.intent ?? resolvedInput.intent;
      const workspaceRoot = getWorkspaceRootForChat?.(chatId);
      const executionResult = await executeTask({
        task_id: generateTaskId(),
        intent: deviceTaskIntent,
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
        await recordKnowledgeInteraction?.({
          origin: "local-chat",
          prompt: normalizedText,
          answer: executionResult.resultText
        });
        logActivity?.({
          kind: "local_result",
          status: "success",
          title: "Local request completed",
          detail: executionResult.resultText,
          chatId
        });
        return chatStore.appendMessage(chatId, {
          role: "assistant",
          text: executionResult.resultText,
          artifact: executionResult.artifact
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
