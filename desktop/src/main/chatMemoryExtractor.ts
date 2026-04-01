import { URL } from "node:url";

import type { ChatKnowledgeWrite } from "./chatPlan";
import type { MemoryCandidate } from "./memoryModel";

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
  const match = text.match(
    /меня\s+зовут\s+([А-ЯЁA-Z][а-яёa-z-]+(?:\s+[А-ЯЁA-Z][а-яёa-z-]+){1,2})/i
  );
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

function extractInterest(text: string): string | null {
  if (
    /(нравится|люблю)\s+(?:изучать\s+)?нейросети/i.test(text) ||
    /\bнейросет/i.test(text)
  ) {
    return "Нейросети";
  }

  return null;
}

function extractQuietPreference(text: string): string | null {
  if (/(предпочитаю|люблю).{0,20}(тишин|в тишине)/i.test(text)) {
    return "Тишина";
  }

  return null;
}

function extractGpu(text: string): string | null {
  const match = text.match(
    /\b((?:AMD\s+Radeon|NVIDIA\s+GeForce|Intel\s+Arc)\s+[A-Za-z0-9!()+\-.\s]+?)(?=,|\.|;|$)/i
  );
  return match ? normalizeWhitespace(match[1]) : null;
}

function extractCpu(text: string): string | null {
  const labeledMatch = text.match(/(?:процессор|cpu)\s+([A-Za-z0-9+\-.\s]+?)(?=,|\.|;|$)/i);
  if (labeledMatch) {
    return normalizeWhitespace(labeledMatch[1]);
  }

  const directMatch = text.match(
    /\b((?:Ryzen|Intel\s+Core|Intel\s+Xeon|Apple\s+M)\s+[A-Za-z0-9+\-.\s]+?)(?=,|\.|;|$)/i
  );
  return directMatch ? normalizeWhitespace(directMatch[1]) : null;
}

function normalizeCapacity(value: string, unit: string): string {
  return `${value} ${unit.toUpperCase()}`;
}

function extractRam(text: string): string | null {
  const match = text.match(
    /(\d+)\s*(gb|гб|tb|тб)\s*(?:ozu|озу|ram|оператив(?:ной)? памяти?)/i
  );
  return match ? normalizeCapacity(match[1], /tb|тб/i.test(match[2]) ? "TB" : "GB") : null;
}

function extractStorage(text: string): string | null {
  const match = text.match(
    /(?:диск|ssd|hdd|накопитель)(?:\s+\w+)*\s+(?:на\s*)?(\d+)\s*(gb|гб|tb|тб)/i
  );
  return match ? normalizeCapacity(match[1], /tb|тб/i.test(match[2]) ? "TB" : "GB") : null;
}

function extractObservation(text: string): MemoryCandidate[] {
  const observations: MemoryCandidate[] = [];

  if (/(грустн|тяжело|тревожн|уста(л|ю|ет|ем))/i.test(text)) {
    observations.push({
      kind: "observation",
      target: "assist/observations",
      key: "recent_emotional_signal",
      value: "Пользователь описывает устойчиво негативное или уставшее состояние.",
      confidence: "inferred"
    });
  }

  if (/(ошибк|опечатк)/i.test(text) && /(пишу|пишет|грамот)/i.test(text)) {
    observations.push({
      kind: "observation",
      target: "assist/observations",
      key: "communication_style",
      value: "Возможны устойчивые орфографические ошибки, стоит упрощать формулировки.",
      confidence: "inferred"
    });
  }

  return observations;
}

export function extractChatMemoryCandidates(text: string): MemoryCandidate[] {
  const candidates: MemoryCandidate[] = [];
  const normalized = normalizeWhitespace(text);

  const fullName = extractFullName(normalized);
  if (fullName) {
    candidates.push({
      kind: "fact",
      target: "assist/profile",
      key: "full_name",
      value: fullName,
      confidence: "direct"
    });
  }

  const occupation = extractOccupation(normalized);
  if (occupation) {
    candidates.push({
      kind: "fact",
      target: "assist/profile",
      key: "occupation",
      value: occupation,
      confidence: "direct"
    });
  }

  const preferredStack = extractStack(normalized);
  if (preferredStack) {
    candidates.push({
      kind: "preference",
      target: "assist/preferences",
      key: "preferred_stack",
      value: preferredStack,
      confidence: "direct"
    });
  }

  const interest = extractInterest(normalized);
  if (interest) {
    candidates.push({
      kind: "preference",
      target: "assist/preferences",
      key: "interests",
      value: interest,
      confidence: "direct"
    });
  }

  const quietPreference = extractQuietPreference(normalized);
  if (quietPreference) {
    candidates.push({
      kind: "preference",
      target: "assist/preferences",
      key: "preferred_environment",
      value: quietPreference,
      confidence: "direct"
    });
  }

  const gpu = extractGpu(normalized);
  if (gpu) {
    candidates.push({
      kind: "fact",
      target: "assist/profile",
      key: "gpu",
      value: gpu,
      confidence: "direct"
    });
  }

  const cpu = extractCpu(normalized);
  if (cpu) {
    candidates.push({
      kind: "fact",
      target: "assist/profile",
      key: "cpu",
      value: cpu,
      confidence: "direct"
    });
  }

  const ram = extractRam(normalized);
  if (ram) {
    candidates.push({
      kind: "fact",
      target: "assist/profile",
      key: "ram",
      value: ram,
      confidence: "direct"
    });
  }

  const storage = extractStorage(normalized);
  if (storage) {
    candidates.push({
      kind: "fact",
      target: "assist/profile",
      key: "storage",
      value: storage,
      confidence: "direct"
    });
  }

  candidates.push(...extractObservation(normalized));

  for (const sourceUrl of extractUrls(normalized)) {
    try {
      const parsed = new URL(sourceUrl);
      candidates.push({
        kind: "source",
        target: "assist/docs/websites",
        key: `${parsed.protocol}//${parsed.host}`,
        value: parsed.host,
        confidence: "direct"
      });
      candidates.push({
        kind: "source",
        target: "assist/docs/papers",
        key: sourceUrl,
        value: sourceUrl,
        confidence: "direct"
      });
    } catch {
      continue;
    }
  }

  return candidates;
}

export function extractChatMemoryWrites(text: string): ChatKnowledgeWrite[] {
  return extractChatMemoryCandidates(text).map((candidate) => ({
    target: candidate.target,
    key: candidate.key,
    value: candidate.value
  }));
}
