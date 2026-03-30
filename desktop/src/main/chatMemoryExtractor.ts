import { URL } from "node:url";

import type { ChatKnowledgeWrite } from "./chatPlan";

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function extractUrls(text: string): string[] {
  return unique(
    (text.match(/https?:\/\/[^\s)\]]+/g) ?? []).map((value) => value.replace(/[.,;]+$/, ""))
  );
}

function extractFullName(text: string): string | null {
  const match = text.match(/меня\s+зовут\s+([А-ЯЁA-Z][а-яёa-z-]+(?:\s+[А-ЯЁA-Z][а-яёa-z-]+){1,2})/i);
  return match ? normalizeWhitespace(match[1]) : null;
}

function extractOccupation(text: string): string | null {
  const match = text.match(
    /(?:^|[\s,.:;!?()])(?:я\s+)?(программист|разработчик|python[-\s]?разработчик|backend[-\s]?разработчик|frontend[-\s]?разработчик)(?=$|[\s,.:;!?()])/i
  );

  return match ? normalizeWhitespace(match[1].toLowerCase()) : null;
}

function extractStack(text: string): string | null {
  const stack: string[] = [];

  if (/\bpython\b/i.test(text)) {
    stack.push("Python");
  }

  if (/\bfastapi\b/i.test(text)) {
    stack.push("FastAPI");
  }

  if (/\breact\b/i.test(text)) {
    stack.push("React");
  }

  if (/\btypescript\b/i.test(text)) {
    stack.push("TypeScript");
  }

  return stack.length > 0 ? stack.join(", ") : null;
}

export function extractChatMemoryWrites(text: string): ChatKnowledgeWrite[] {
  const writes: ChatKnowledgeWrite[] = [];
  const normalized = normalizeWhitespace(text);

  const fullName = extractFullName(normalized);
  if (fullName) {
    writes.push({
      target: "assist/profile",
      key: "full_name",
      value: fullName
    });
  }

  const occupation = extractOccupation(normalized);
  if (occupation) {
    writes.push({
      target: "assist/profile",
      key: "occupation",
      value: occupation
    });
  }

  const preferredStack = extractStack(normalized);
  if (preferredStack) {
    writes.push({
      target: "assist/preferences",
      key: "preferred_stack",
      value: preferredStack
    });
  }

  for (const sourceUrl of extractUrls(normalized)) {
    try {
      const parsed = new URL(sourceUrl);
      writes.push({
        target: "assist/docs/websites",
        key: `${parsed.protocol}//${parsed.host}`,
        value: parsed.host
      });
      writes.push({
        target: "assist/docs/papers",
        key: sourceUrl,
        value: sourceUrl
      });
    } catch {
      continue;
    }
  }

  return writes;
}
