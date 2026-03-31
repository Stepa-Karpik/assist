import type { ChatSessionStore } from "./chatSessionStore";
import type { CodexConversationHandle } from "./codexConversationRunner";
import type {
  ConversationEventListResponse,
  ConversationEventUpdatePayload,
  RemoteConversationEvent
} from "./syncClient";

type ConversationClient = {
  fetchConversationEvents: () => Promise<Response>;
  updateConversationEvent: (
    eventId: string,
    payload: ConversationEventUpdatePayload
  ) => Promise<Response>;
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

type ConversationEventRuntimeOptions = {
  client: ConversationClient;
  conversationRunner: ConversationRunner;
  chatSessionStore: ChatSessionStore;
  deviceId: string;
  resolveWorkspaceRoot: (telegramChatId: number) => string;
  recordKnowledgeInteraction?: (input: {
    origin: "telegram-chat";
    prompt: string;
    answer: string;
  }) => Promise<void> | void;
  logResponseError?: (action: string, response: Response) => void;
};

const STREAMING_PLACEHOLDER = "Ассистент отвечает...";
const PROGRESS_PUSH_INTERVAL_MS = 250;

function isUpdateTerminal(event: RemoteConversationEvent): boolean {
  return event.status === "completed" || event.status === "failed" || event.status === "cancelled";
}

export function createConversationEventRuntime({
  client,
  conversationRunner,
  chatSessionStore,
  deviceId,
  resolveWorkspaceRoot,
  recordKnowledgeInteraction,
  logResponseError = () => {}
}: ConversationEventRuntimeOptions) {
  const activeEventIds = new Set<string>();

  async function pushUpdate(
    eventId: string,
    payload: ConversationEventUpdatePayload
  ): Promise<void> {
    const response = await client.updateConversationEvent(eventId, payload);

    if (!response.ok) {
      logResponseError("Updating conversation event", response);
    }
  }

  function startEvent(event: RemoteConversationEvent): void {
    activeEventIds.add(event.event_id);

    void (async () => {
      const existingSession = chatSessionStore.getByTelegramChatId(event.chat_id);
      const workspaceRoot = resolveWorkspaceRoot(event.chat_id);
      let streamedText = "";
      let lastProgressPushAt = -PROGRESS_PUSH_INTERVAL_MS;

      const handle = conversationRunner.start({
        chatId: `telegram:${event.chat_id}`,
        prompt: event.prompt,
        workspaceRoot,
        sessionId: existingSession?.codexSessionId,
        onDelta: (chunk) => {
          streamedText += chunk;
          const now = Date.now();

          if (now - lastProgressPushAt < PROGRESS_PUSH_INTERVAL_MS) {
            return;
          }

          lastProgressPushAt = now;
          void pushUpdate(event.event_id, {
            status: "running",
            response_text: streamedText.trim() || STREAMING_PLACEHOLDER
          });
        }
      });

      try {
        const result = await handle.result;

        chatSessionStore.saveTelegramChatSession({
          telegramChatId: event.chat_id,
          deviceId,
          codexSessionId: result.sessionId
        });
        chatSessionStore.markInterrupted(`telegram:${event.chat_id}`, result.cancelled);

        const finalText =
          result.text.trim() || streamedText.trim() || STREAMING_PLACEHOLDER;

        await pushUpdate(event.event_id, {
          status: result.cancelled ? "cancelled" : "completed",
          response_text: finalText
        });

        if (!result.cancelled) {
          await recordKnowledgeInteraction?.({
            origin: "telegram-chat",
            prompt: event.prompt,
            answer: finalText
          });
        }
      } catch (error) {
        const errorText =
          error instanceof Error && error.message.trim().length > 0
            ? error.message
            : "Не удалось подготовить ответ.";

        await pushUpdate(event.event_id, {
          status: "failed",
          error_text: errorText
        });
      } finally {
        activeEventIds.delete(event.event_id);
      }
    })();
  }

  return {
    async syncPendingEvents(): Promise<void> {
      const response = await client.fetchConversationEvents();

      if (!response.ok) {
        logResponseError("Fetching conversation events", response);
        return;
      }

      const payload = (await response.json()) as ConversationEventListResponse;

      for (const event of payload.items) {
        if (activeEventIds.has(event.event_id) || isUpdateTerminal(event)) {
          continue;
        }

        startEvent(event);
      }
    }
  };
}
