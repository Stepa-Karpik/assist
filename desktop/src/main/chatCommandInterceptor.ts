import { normalizeLocalIntent } from "./localIntentResolver";

export type ChatCommandInterception =
  | {
      kind: "conversation";
    }
  | {
      kind: "tool_action";
      intent: string;
    }
  | {
      kind: "clarify";
      question: string;
    };

function isScreenshotRequest(text: string): boolean {
  return /(скрин|screenshot|screen|экран|монитор)/i.test(text);
}

function isStatusRequest(text: string): boolean {
  return /(статус|онлайн|online|жив|пинг|что сейчас с задач|что с задач|что с пк|какие задачи|очередь)/i.test(
    text
  );
}

function isSendFileRequest(text: string): boolean {
  return /(скинь|пришли|отправь|send|send-file|файл|документ|презентац|\.ppt|\.pptx|\.pdf|\.doc|\.docx|\.xlsx|\.png|\.jpg|\.jpeg|\.zip)/i.test(
    text
  );
}

function hasConcreteFileTarget(text: string): boolean {
  return (
    /\b[\w.\-]+\.(?:pptx?|pdf|docx?|xlsx?|txt|md|png|jpe?g|gif|zip)\b/i.test(text) ||
    /(презентац|презу|слайды)/i.test(text)
  );
}

export function createChatCommandInterceptor() {
  return {
    intercept(text: string): ChatCommandInterception {
      const normalizedText = text.trim();

      if (!normalizedText) {
        return { kind: "conversation" };
      }

      if (isScreenshotRequest(normalizedText)) {
        return {
          kind: "tool_action",
          intent: normalizeLocalIntent(normalizedText)
        };
      }

      if (isStatusRequest(normalizedText)) {
        return {
          kind: "tool_action",
          intent: "status"
        };
      }

      if (isSendFileRequest(normalizedText)) {
        if (!hasConcreteFileTarget(normalizedText)) {
          return {
            kind: "clarify",
            question: "Уточни, какой именно файл нужно отправить."
          };
        }

        return {
          kind: "tool_action",
          intent: normalizeLocalIntent(normalizedText)
        };
      }

      return {
        kind: "conversation"
      };
    }
  };
}
