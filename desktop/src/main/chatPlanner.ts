import { extractChatMemoryWrites } from "./chatMemoryExtractor";
import type { ChatPlan } from "./chatPlan";
import { createChatCommandInterceptor } from "./chatCommandInterceptor";

const technicalTopics: Array<{ pattern: RegExp; query: string }> = [
  { pattern: /\bfastapi\b/i, query: "FastAPI" },
  { pattern: /\bmcp\b/i, query: "MCP" },
  { pattern: /\bpython\b/i, query: "Python" },
  { pattern: /\breact\b/i, query: "React" },
  { pattern: /\btypescript\b/i, query: "TypeScript" },
  { pattern: /\bcodex\b/i, query: "Codex" }
];

function isConversationQuestion(text: string): boolean {
  const normalized = text.toLowerCase();
  return (
    text.includes("?") ||
    /\b(что|как|почему|зачем|знаешь|объясни|расскажи|подскажи)\b/i.test(text) ||
    normalized.startsWith("привет") ||
    normalized.startsWith("здравствуй") ||
    normalized.startsWith("hello") ||
    normalized.startsWith("hi")
  );
}

function resolveKnowledgeQuery(text: string): string | null {
  for (const topic of technicalTopics) {
    if (topic.pattern.test(text)) {
      return topic.query;
    }
  }

  return null;
}

function normalizePlannedTaskIntent(text: string, normalizedIntent: string): string {
  if (
    normalizedIntent === "screenshot screen-1" &&
    /(скрин|screenshot|screen|экран|монитор)/i.test(text) &&
    !/(втор(ой|ого)|2-й|оба|обоих|both|screen 2|monitor 2|primary|основн)/i.test(text)
  ) {
    return "screenshot";
  }

  return normalizedIntent;
}

export function createChatPlanner() {
  const commandInterceptor = createChatCommandInterceptor();

  return {
    plan(text: string): ChatPlan {
      const normalizedText = text.trim();
      const interception = commandInterceptor.intercept(normalizedText);

      if (interception.kind === "tool_action") {
        return {
          mode: "task",
          actions: [
            {
              kind: "device_task",
              intent: normalizePlannedTaskIntent(normalizedText, interception.intent)
            }
          ]
        };
      }

      if (interception.kind === "clarify") {
        return {
          mode: "conversation",
          actions: [
            {
              kind: "clarify",
              text: interception.question
            }
          ]
        };
      }

      const writes = extractChatMemoryWrites(normalizedText);
      const knowledgeQuery = resolveKnowledgeQuery(normalizedText);
      const actions: ChatPlan["actions"] = [
        {
          kind: "visible_reply",
          strategy: "deepseek"
        }
      ];

      if (writes.length > 0) {
        actions.push({
          kind: "knowledge_write",
          writes
        });
      }

      if (knowledgeQuery !== null && isConversationQuestion(normalizedText)) {
        actions.push({
          kind: "knowledge_lookup",
          query: knowledgeQuery
        });
        actions.push({
          kind: "follow_up",
          suggestion: `Хочешь, я ещё соберу свежие изменения по теме ${knowledgeQuery} и сохраню краткую выжимку?`
        });
      }

      return {
        mode: "conversation",
        actions
      };
    }
  };
}
