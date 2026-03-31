import crypto from "node:crypto";

import { createChatPlanner } from "./chatPlanner";
import type { ChatSessionStore } from "./chatSessionStore";
import type { ChatKnowledgeWrite, ChatPlan } from "./chatPlan";
import type { ChatRunState, ChatRunStore } from "./chatRunStore";
import type { CodexConversationHandle } from "./codexConversationRunner";
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

type ConversationRunner = {
  start: (input: {
    chatId: string;
    prompt: string;
    workspaceRoot: string;
    sessionId?: string;
    onDelta?: (chunk: string) => void;
  }) => CodexConversationHandle;
};

type LocalChatRuntimeOptions = {
  chatStore: LocalChatStore;
  chatRunStore: ChatRunStore;
  chatSessionStore?: ChatSessionStore;
  conversationRunner?: ConversationRunner;
  executeTask: (task: ExecutableTask) => Promise<TaskExecutionResult>;
  deviceId?: string;
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
    historyContext?: string | null;
  }) => Promise<string | ConversationReplyResult>;
  replyToConversation?: (input: {
    chatId: string;
    prompt: string;
    plan: ChatPlan;
    historyContext?: string | null;
  }) => Promise<string | ConversationReplyResult> | string | ConversationReplyResult;
  onChatUpdated?: (detail: LocalChatDetail) => void;
  onRunUpdated?: (input: { chatId: string; run: ChatRunState | null }) => void;
  planMessage?: (text: string) => ChatPlan;
  getWorkspaceRootForChat?: (chatId: string) => string | null | undefined;
  resolveInput?: (text: string) => Promise<LocalConversationResolution> | LocalConversationResolution;
  generateTaskId?: () => string;
  streamDelayMs?: number;
  logActivity?: (input: {
    kind: "local_request" | "local_result";
    status: "info" | "success" | "warning" | "error";
    title: string;
    detail?: string | null;
    chatId: string;
  }) => void;
};

const ACK_TEXT = "Сейчас посмотрю и отвечу по сути.";
const STREAM_PLACEHOLDER_TEXT = "Ассистент отвечает...";
const CANCELLED_TEXT = "Ответ остановлен.";
const STREAM_DELAY_MS = 24;
const HISTORY_MESSAGE_LIMIT = 8;

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function splitIntoStreamingChunks(text: string): string[] {
  const parts = text.match(/\S+\s*/g) ?? [text];
  const chunks: string[] = [];
  let currentChunk = "";

  for (const part of parts) {
    if ((currentChunk + part).length > 36 && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = part;
      continue;
    }

    currentChunk += part;
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks.length > 0 ? chunks : [text];
}

function toHistoryRoleLabel(role: LocalChatDetail["messages"][number]["role"]): string | null {
  if (role === "user") {
    return "Пользователь";
  }

  if (role === "assistant") {
    return "Ассистент";
  }

  return null;
}

function buildHistoryContext(messages: LocalChatDetail["messages"]): string | null {
  const relevantLines = messages
    .filter((message) => message.text.trim().length > 0)
    .map((message) => {
      const label = toHistoryRoleLabel(message.role);
      return label ? `${label}: ${message.text.trim()}` : null;
    })
    .filter((line): line is string => line !== null)
    .slice(-HISTORY_MESSAGE_LIMIT);

  return relevantLines.length > 0 ? relevantLines.join("\n") : null;
}

export function createLocalChatRuntime({
  chatStore,
  chatRunStore,
  chatSessionStore,
  conversationRunner,
  executeTask,
  deviceId = "desktop-local",
  recordKnowledgeInteraction,
  persistLocalApproval,
  streamReply,
  replyToConversation,
  onChatUpdated,
  onRunUpdated,
  planMessage = createChatPlanner().plan,
  getWorkspaceRootForChat,
  resolveInput = createLocalConversationRouter().resolve,
  generateTaskId = () => crypto.randomUUID(),
  streamDelayMs = STREAM_DELAY_MS,
  logActivity
}: LocalChatRuntimeOptions) {
  const activeConversationCancels = new Map<string, () => void>();

  function emitRun(chatId: string) {
    onRunUpdated?.({
      chatId,
      run: chatRunStore.getRun(chatId)
    });
  }

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

  return "РќРµ СЃРјРѕРі СЃСЂР°Р·Сѓ РґР°С‚СЊ РЅРѕСЂРјР°Р»СЊРЅС‹Р№ РѕС‚РІРµС‚. РЈС‚РѕС‡РЅРё, С‡С‚Рѕ РёРјРµРЅРЅРѕ С‚РµР±Рµ РІР°Р¶РЅРѕ, Рё СЏ СЂР°Р·Р±РµСЂСѓ СЌС‚Рѕ РїРѕ С€Р°РіР°Рј.";
}

  function removeAckMessage(chatId: string, ackMessageId: string): LocalChatDetail {
    const detail = chatStore.deleteMessage(chatId, ackMessageId);
    onChatUpdated?.(detail);
    return detail;
  }

async function streamAssistantText(input: {
    chatId: string;
    runId: string;
    placeholderMessageId: string;
    text: string;
  }): Promise<{ renderedText: string; cancelled: boolean }> {
    const chunks = splitIntoStreamingChunks(input.text);
    let renderedText = "";

    chatRunStore.updateStatus(input.chatId, "streaming");
    emitRun(input.chatId);

    for (const chunk of chunks) {
      const run = chatRunStore.getRun(input.chatId);

      if (run === null || run.runId !== input.runId || run.cancelRequested) {
        return {
          renderedText,
          cancelled: true
        };
      }

      renderedText += chunk;
      const detail = chatStore.updateMessage(input.chatId, input.placeholderMessageId, {
        text: renderedText,
        role: "assistant"
      });
      onChatUpdated?.(detail);
      if (streamDelayMs > 0) {
        await delay(streamDelayMs);
      }
    }

    return {
      renderedText,
      cancelled: false
    };
  }

  function finishRun(chatId: string, status: "completed" | "cancelled" | "failed") {
    activeConversationCancels.delete(chatId);
    chatRunStore.finishRun(chatId, status);
    emitRun(chatId);
  }

  function updateAssistantMessage(chatId: string, messageId: string, text: string): LocalChatDetail {
    const detail = chatStore.updateMessage(chatId, messageId, {
      text,
      role: "assistant"
    });
    onChatUpdated?.(detail);
    return detail;
  }

  function startBackgroundCodexConversationReply({
    chatId,
    prompt,
    plan,
    ackMessageId,
    placeholderMessageId,
    runId,
    workspaceRoot
  }: {
    chatId: string;
    prompt: string;
    plan: ChatPlan;
    ackMessageId: string;
    placeholderMessageId: string;
    runId: string;
    workspaceRoot: string;
  }): void {
    if (conversationRunner === undefined || chatSessionStore === undefined) {
      throw new Error("Codex conversational runtime is not configured.");
    }

    void (async () => {
      const memoryWrites = extractMemoryWrites(plan);
      const existingSession = chatSessionStore.getByLocalChatId(chatId);
      let streamedText = "";
      const handle = conversationRunner.start({
        chatId,
        prompt,
        workspaceRoot,
        sessionId: existingSession?.codexSessionId,
        onDelta: (chunk) => {
          const run = chatRunStore.getRun(chatId);

          if (run === null || run.runId !== runId || run.cancelRequested) {
            return;
          }

          streamedText += chunk;
          chatRunStore.updateStatus(chatId, "streaming");
          emitRun(chatId);
          updateAssistantMessage(chatId, placeholderMessageId, streamedText);
        }
      });
      activeConversationCancels.set(chatId, handle.cancel);

      try {
        const reply = await handle.result;
        removeAckMessage(chatId, ackMessageId);
        chatSessionStore.saveLocalChatSession({
          chatId,
          deviceId,
          codexSessionId: reply.sessionId
        });
        chatSessionStore.markInterrupted(chatId, reply.cancelled);

        const finalText = reply.text.trim() || streamedText.trim() || CANCELLED_TEXT;
        updateAssistantMessage(chatId, placeholderMessageId, finalText);

        if (reply.cancelled) {
          finishRun(chatId, "cancelled");
          return;
        }

        try {
          await recordKnowledgeInteraction?.({
            origin: "local-chat",
            prompt,
            answer: finalText,
            memoryWrites
          });
        } catch (error: unknown) {
          logActivity?.({
            kind: "local_result",
            status: "warning",
            title: "Knowledge write skipped",
            detail: error instanceof Error ? error.message : "Knowledge write failed",
            chatId
          });
        }

        logActivity?.({
          kind: "local_result",
          status: "success",
          title: "Local assistant reply",
          detail: finalText,
          chatId
        });
        finishRun(chatId, "completed");
      } catch (error: unknown) {
        chatSessionStore.markInterrupted(chatId, true);
        updateAssistantMessage(
          chatId,
          placeholderMessageId,
          "Не удалось подготовить ответ. Попробуй уточнить запрос."
        );
        try {
          removeAckMessage(chatId, ackMessageId);
        } catch {
          // Ignore ack cleanup failure after primary error.
        }
        logActivity?.({
          kind: "local_result",
          status: "error",
          title: "Local assistant reply failed",
          detail: error instanceof Error ? error.message : "Conversation failed",
          chatId
        });
        finishRun(chatId, "failed");
      }
    })();
  }

  function startBackgroundConversationReply({
    chatId,
    prompt,
    plan,
    historyContext,
    ackMessageId,
    placeholderMessageId,
    runId
  }: {
    chatId: string;
    prompt: string;
    plan: ChatPlan;
    historyContext?: string | null;
    ackMessageId: string;
    placeholderMessageId: string;
    runId: string;
  }): void {
    void (async () => {
      try {
        const memoryWrites = extractMemoryWrites(plan);
        const reply =
          streamReply !== undefined
            ? await streamReply({
                chatId,
                prompt,
                plan,
                historyContext
              })
            : await replyToConversation?.({
                chatId,
                prompt,
                plan,
                historyContext
              });
        const finalText = (typeof reply === "string" ? reply : reply?.text)?.trim();
        const sourceUrls = typeof reply === "string" ? [] : reply?.sourceUrls ?? [];
        const normalizedFinalText = finalText || buildStaticConversationReply(prompt);
        const streamed = await streamAssistantText({
          chatId,
          runId,
          placeholderMessageId,
          text: normalizedFinalText
        });

        removeAckMessage(chatId, ackMessageId);

        if (streamed.cancelled) {
          const textToKeep = streamed.renderedText.trim() || CANCELLED_TEXT;
          const detail = chatStore.updateMessage(chatId, placeholderMessageId, {
            text: textToKeep,
            role: "assistant"
          });
          onChatUpdated?.(detail);
          finishRun(chatId, "cancelled");
          return;
        }

        try {
          await recordKnowledgeInteraction?.({
            origin: "local-chat",
            prompt,
            answer: normalizedFinalText,
            sourceUrls,
            memoryWrites
          });
        } catch (error: unknown) {
          logActivity?.({
            kind: "local_result",
            status: "warning",
            title: "Knowledge write skipped",
            detail: error instanceof Error ? error.message : "Knowledge write failed",
            chatId
          });
        }
        logActivity?.({
          kind: "local_result",
          status: "success",
          title: "Local assistant reply",
          detail: normalizedFinalText,
          chatId
        });
        finishRun(chatId, "completed");
      } catch (error: unknown) {
        const fallbackText = "Не удалось подготовить ответ. Попробуй уточнить запрос.";
        const detail = chatStore.updateMessage(chatId, placeholderMessageId, {
          text: fallbackText,
          role: "assistant"
        });
        onChatUpdated?.(detail);
        try {
          removeAckMessage(chatId, ackMessageId);
        } catch {
          // Ignore cleanup error; primary failure is already reflected in the chat.
        }
        logActivity?.({
          kind: "local_result",
          status: "error",
          title: "Local assistant reply failed",
          detail: error instanceof Error ? error.message : fallbackText,
          chatId
        });
        finishRun(chatId, "failed");
      }
    })();
  }

  return {
    cancelRun(chatId: string): boolean {
      const run = chatRunStore.getRun(chatId);

      if (run === null) {
        return false;
      }

      chatRunStore.requestCancel(chatId);
      chatSessionStore?.markInterrupted(chatId, true);
      activeConversationCancels.get(chatId)?.();
      removeAckMessage(chatId, run.ackMessageId);

      const detail = chatStore.getChat(chatId);
      const replyMessage = detail?.messages.find((message) => message.messageId === run.replyMessageId);
      const nextText =
        replyMessage && replyMessage.text.trim().length > 0 && replyMessage.text !== STREAM_PLACEHOLDER_TEXT
          ? replyMessage.text
          : CANCELLED_TEXT;

      const nextDetail = chatStore.updateMessage(chatId, run.replyMessageId, {
        text: nextText,
        role: "assistant"
      });
      onChatUpdated?.(nextDetail);
      finishRun(chatId, "cancelled");
      return true;
    },
    getRun(chatId: string): ChatRunState | null {
      return chatRunStore.getRun(chatId);
    },
    async sendMessage({ chatId, text }: SendLocalChatMessageInput): Promise<LocalChatDetail> {
      const normalizedText = text.trim();

      if (!normalizedText) {
        throw new Error("Local request is empty.");
      }

      if (!chatRunStore.canSend(chatId)) {
        throw new Error("Assistant is already replying in this chat.");
      }

      const priorMessages = chatStore.getChat(chatId)?.messages.filter((message) => message.role !== "system") ?? [];
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
      const historyContext = buildHistoryContext(priorMessages);

      if (plan.mode === "conversation") {
        if (conversationRunner !== undefined && chatSessionStore !== undefined) {
          const ackDetail = chatStore.appendMessage(chatId, {
            role: "assistant",
            text: ACK_TEXT
          });
          const ackMessageId = ackDetail.messages.at(-1)?.messageId;

          if (!ackMessageId) {
            throw new Error("Failed to create assistant acknowledgment message.");
          }

          const pendingDetail = chatStore.appendMessage(chatId, {
            role: "assistant",
            text: STREAM_PLACEHOLDER_TEXT
          });
          const placeholderMessageId = pendingDetail.messages.at(-1)?.messageId;

          if (!placeholderMessageId) {
            throw new Error("Failed to create assistant placeholder message.");
          }

          const run = chatRunStore.startRun({
            chatId,
            ackMessageId,
            replyMessageId: placeholderMessageId
          });
          emitRun(chatId);
          onChatUpdated?.(pendingDetail);
          startBackgroundCodexConversationReply({
            chatId,
            prompt: normalizedText,
            plan,
            ackMessageId,
            placeholderMessageId,
            runId: run.runId,
            workspaceRoot: getWorkspaceRootForChat?.(chatId) ?? process.cwd()
          });
          return pendingDetail;
        }

        if (streamReply === undefined && replyToConversation === undefined) {
          const resolvedConversation = await resolveInput(normalizedText);
          const memoryWrites = extractMemoryWrites(plan);

          if (resolvedConversation.kind === "reply") {
            try {
              await recordKnowledgeInteraction?.({
                origin: "local-chat",
                prompt: normalizedText,
                answer: resolvedConversation.text,
                memoryWrites
              });
            } catch (error: unknown) {
              logActivity?.({
                kind: "local_result",
                status: "warning",
                title: "Knowledge write skipped",
                detail: error instanceof Error ? error.message : "Knowledge write failed",
                chatId
              });
            }
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

        const ackDetail = chatStore.appendMessage(chatId, {
          role: "assistant",
          text: ACK_TEXT
        });
        const ackMessageId = ackDetail.messages.at(-1)?.messageId;

        if (!ackMessageId) {
          throw new Error("Failed to create assistant acknowledgment message.");
        }

        const pendingDetail = chatStore.appendMessage(chatId, {
          role: "assistant",
          text: STREAM_PLACEHOLDER_TEXT
        });
        const placeholderMessageId = pendingDetail.messages.at(-1)?.messageId;

        if (!placeholderMessageId) {
          throw new Error("Failed to create assistant placeholder message.");
        }

        const run = chatRunStore.startRun({
          chatId,
          ackMessageId,
          replyMessageId: placeholderMessageId
        });
        emitRun(chatId);
        onChatUpdated?.(pendingDetail);
        startBackgroundConversationReply({
          chatId,
          prompt: normalizedText,
          plan,
          historyContext,
          ackMessageId,
          placeholderMessageId,
          runId: run.runId
        });
        return pendingDetail;
      }

      const resolvedInput = await resolveInput(normalizedText);

      if (resolvedInput.kind === "reply") {
        try {
          await recordKnowledgeInteraction?.({
            origin: "local-chat",
            prompt: normalizedText,
            answer: resolvedInput.text
          });
        } catch (error: unknown) {
          logActivity?.({
            kind: "local_result",
            status: "warning",
            title: "Knowledge write skipped",
            detail: error instanceof Error ? error.message : "Knowledge write failed",
            chatId
          });
        }
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
