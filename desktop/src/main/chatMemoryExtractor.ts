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
    /меня\s+зовут\s+([А-ЯЁA-Z][а-яёa-z-]+(?:\s+[А-ЯЁA-Z][а-яёa-z-]+){1,2})/iu
  );
  return match ? normalizeWhitespace(match[1]) : null;
}

function extractOccupation(text: string): string | null {
  const match = text.match(
    /(?:^|[\s,.:;!?()])(?:я\s+)?(программист|разработчик|python[-\s]?разработчик|backend[-\s]?разработчик|frontend[-\s]?разработчик)(?=$|[\s,.:;!?()])/iu
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
  if (/(нравится|люблю)\s+(?:изучать\s+)?нейросети/iu.test(text) || /нейросет/iu.test(text)) {
    return "Нейросети";
  }

  return null;
}

function extractQuietPreference(text: string): string | null {
  if (/(предпочитаю|люблю).{0,24}(тишин|в тишине)/iu.test(text)) {
    return "Тишина";
  }

  return null;
}

function extractUniversity(text: string): string | null {
  const match = text.match(/учусь\s+в\s+([А-ЯЁA-Z]{2,}(?:-[А-ЯЁA-Z]{2,})?)/u);
  return match ? normalizeWhitespace(match[1]) : null;
}

function extractDepartment(text: string): string | null {
  const match = text.match(
    /кафедр[аеи]\s+([А-ЯЁA-Z][^,.]+?)(?=\s+на\s+(?:\d+|первом|втором|третьем|четвертом|пятом|шестом)\s+курсе|,|\.|;|$)/u
  );
  return match ? normalizeWhitespace(match[1]) : null;
}

function extractCourse(text: string): string | null {
  const digitMatch = text.match(/на\s+(\d+)\s+курсе/iu);
  if (digitMatch) {
    return `${digitMatch[1]} курс`;
  }

  const courseMap: Record<string, string> = {
    первом: "1 курс",
    втором: "2 курс",
    третьем: "3 курс",
    четвертом: "4 курс",
    пятом: "5 курс",
    шестом: "6 курс"
  };
  const wordMatch = text.match(/на\s+(первом|втором|третьем|четвертом|пятом|шестом)\s+курсе/iu);
  return wordMatch ? courseMap[wordMatch[1].toLowerCase()] ?? null : null;
}

function extractCurrentActivity(text: string): string | null {
  const parts: string[] = [];

  if (/занимаюсь\s+учеб/iu.test(text) || /учусь\b/iu.test(text)) {
    parts.push("Учёба");
  }

  if (/личн(ыми|ые)\s+проект/iu.test(text) || /свои\s+проект/iu.test(text)) {
    parts.push("Личные проекты");
  }

  return parts.length > 0 ? parts.join(" и ") : null;
}

function extractPersonalProject(text: string): string | null {
  if (/ии\s+ассистент[а-яё\s]+пк/iu.test(text) || /ассистент[а-яё\s]+телефон/iu.test(text)) {
    return "ИИ-ассистент для ПК и телефона";
  }

  return null;
}

function extractHobby(text: string): string | null {
  if (/\bosu!?/i.test(text)) {
    return "osu";
  }

  return null;
}

function extractCareerPreference(text: string): string | null {
  if (/(хочу|ближе|думаю).{0,40}фриланс|фрилансер/iu.test(text)) {
    return "Фриланс и автономная работа";
  }

  if (/(крупн(ой|ую)\s+компан|сбербанк)/iu.test(text)) {
    return "Работа в крупной компании";
  }

  return null;
}

function extractCoreValue(text: string): string | null {
  if (/ценю\s+честност/iu.test(text)) {
    return "Честность";
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
  const labeledMatch = text.match(/(?:процессор|cpu)\s+([A-Za-z0-9+\-.\s]+?)(?=,|\.|;|$)/iu);
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
    /(\d+)\s*(gb|гб|tb|тб)\s*(?:ozu|озу|ram|оператив(?:ной)? памяти?)/iu
  );
  return match ? normalizeCapacity(match[1], /tb|тб/i.test(match[2]) ? "TB" : "GB") : null;
}

function extractStorage(text: string): string | null {
  const match = text.match(
    /(?:диск|ssd|hdd|накопитель)(?:\s+\w+)*\s+(?:на\s*)?(\d+)\s*(gb|гб|tb|тб)/iu
  );
  return match ? normalizeCapacity(match[1], /tb|тб/i.test(match[2]) ? "TB" : "GB") : null;
}

function extractObservationCandidates(text: string): MemoryCandidate[] {
  const observations: MemoryCandidate[] = [];

  if (/(грустн|тяжело|тревожн|уста(л|ю|ет|ем))/iu.test(text)) {
    observations.push({
      kind: "observation",
      target: "assist/observations",
      key: "recent_emotional_signal",
      value: "Пользователь описывает устойчивое негативное или уставшее состояние.",
      confidence: "inferred"
    });
  }

  if (/(ошибк|опечатк)/iu.test(text) && /(пишу|пишет|грамот)/iu.test(text)) {
    observations.push({
      kind: "observation",
      target: "assist/observations",
      key: "communication_style",
      value: "Возможны устойчивые орфографические ошибки, стоит упрощать формулировки.",
      confidence: "inferred"
    });
  }

  if (/(спокойн(ый|ая|ое)|спокойный период)/iu.test(text)) {
    observations.push({
      kind: "observation",
      target: "assist/observations",
      key: "life_period",
      value: "Спокойный период",
      confidence: "direct"
    });
  }

  return observations;
}

function pushFact(
  candidates: MemoryCandidate[],
  key: string,
  value: string | null,
  target: "assist/profile" | "assist/preferences" | "assist/observations",
  kind: MemoryCandidate["kind"] = target === "assist/profile" ? "fact" : "preference"
) {
  if (!value) {
    return;
  }

  candidates.push({
    kind,
    target,
    key,
    value,
    confidence: "direct"
  });
}

export function extractChatMemoryCandidates(text: string): MemoryCandidate[] {
  const candidates: MemoryCandidate[] = [];
  const normalized = normalizeWhitespace(text);

  pushFact(candidates, "full_name", extractFullName(normalized), "assist/profile");
  pushFact(candidates, "occupation", extractOccupation(normalized), "assist/profile");
  pushFact(candidates, "education_university", extractUniversity(normalized), "assist/profile");
  pushFact(candidates, "education_department", extractDepartment(normalized), "assist/profile");
  pushFact(candidates, "education_course", extractCourse(normalized), "assist/profile");
  pushFact(candidates, "current_activity", extractCurrentActivity(normalized), "assist/profile");
  pushFact(candidates, "personal_project", extractPersonalProject(normalized), "assist/profile");

  pushFact(candidates, "preferred_stack", extractStack(normalized), "assist/preferences");
  pushFact(candidates, "interests", extractInterest(normalized), "assist/preferences");
  pushFact(candidates, "preferred_environment", extractQuietPreference(normalized), "assist/preferences");
  pushFact(candidates, "hobbies", extractHobby(normalized), "assist/preferences");
  pushFact(candidates, "career_preference", extractCareerPreference(normalized), "assist/preferences");
  pushFact(candidates, "core_values", extractCoreValue(normalized), "assist/preferences");

  pushFact(candidates, "gpu", extractGpu(normalized), "assist/profile");
  pushFact(candidates, "cpu", extractCpu(normalized), "assist/profile");
  pushFact(candidates, "ram", extractRam(normalized), "assist/profile");
  pushFact(candidates, "storage", extractStorage(normalized), "assist/profile");

  candidates.push(...extractObservationCandidates(normalized));

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
