import {
  messageExplicitlyRequestsCodex,
  messageRequiresCodex,
  normalizeLocalIntent
} from "./localIntentResolver";

export type LocalConversationResolution =
  | {
      kind: "task";
      intent: string;
    }
  | {
      kind: "reply";
      text: string;
    };

type LocalChatResponder = {
  reply: (
    text: string,
    options?: {
      ownerProfileContext?: string | null;
    }
  ) => Promise<string> | string;
};

type LocalConversationRouterOptions = {
  chatResponder?: LocalChatResponder | null;
  resolveIntent?: (text: string) => string;
  getOwnerProfileContext?: () => string | null | undefined;
};

function buildFallbackReply(text: string): string {
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

  return "Сформулируйте задачу обычным текстом или добавьте «кодекс», если нужен анализ проекта.";
}

export function createLocalConversationRouter({
  chatResponder = null,
  resolveIntent = normalizeLocalIntent,
  getOwnerProfileContext
}: LocalConversationRouterOptions = {}) {
  return {
    async resolve(text: string): Promise<LocalConversationResolution> {
      const intent = resolveIntent(text);
      const normalizedText = text.trim();

      if (
        intent === `codex ${normalizedText}` &&
        !messageExplicitlyRequestsCodex(text) &&
        !messageRequiresCodex(text)
      ) {
        const replyText =
          chatResponder === null
            ? buildFallbackReply(text)
            : await chatResponder.reply(normalizedText, {
                ownerProfileContext: getOwnerProfileContext?.() ?? null
              });

        return {
          kind: "reply",
          text: replyText
        };
      }

      return {
        kind: "task",
        intent
      };
    }
  };
}
