import fs from "node:fs/promises";
import path from "node:path";

import type { ChatKnowledgeWrite } from "./chatPlan";
import {
  decideKnowledgeWrites,
  type KnowledgeIngestInput,
  type KnowledgeSkillApprovalDraft,
  type KnowledgeWritePlan
} from "./knowledgeIngestDecider";
import { ensureKnowledgeVault } from "./knowledgeVaultBootstrap";
import { KnowledgeLinker } from "./knowledgeLinker";
import { KnowledgeWriter } from "./knowledgeWriter";

type KnowledgeBackgroundWriterOptions = {
  getVaultRoot: () => string | null;
  decide?: (input: KnowledgeIngestInput) => KnowledgeWritePlan;
  persistSkillApprovalDraft?: (draft: KnowledgeSkillApprovalDraft) => Promise<void> | void;
};

export type KnowledgeBackgroundWriteResult = {
  applied: boolean;
  pendingApproval: boolean;
  userWriteCount: number;
  assistWriteCount: number;
};

type StandaloneSourceRecord = {
  sourceUrl: string;
  sourceTitle?: string;
};

type StructuredNoteConfig = {
  parts: readonly string[];
  title: string;
  sectionTitle: string;
  label: string;
};

type StructuredGroup = {
  notePath: string;
  title: string;
  sectionTitle: string;
  entries: string[];
};

const STRUCTURED_NOTE_MAP: Record<string, StructuredNoteConfig> = {
  full_name: {
    parts: ["assist", "profile", "Личность.md"],
    title: "Личность",
    sectionTitle: "Подтверждённые факты",
    label: "ФИО"
  },
  occupation: {
    parts: ["assist", "profile", "Деятельность.md"],
    title: "Деятельность",
    sectionTitle: "Подтверждённые факты",
    label: "Роль"
  },
  current_activity: {
    parts: ["assist", "profile", "Деятельность.md"],
    title: "Деятельность",
    sectionTitle: "Подтверждённые факты",
    label: "Текущая деятельность"
  },
  personal_project: {
    parts: ["assist", "profile", "Деятельность.md"],
    title: "Деятельность",
    sectionTitle: "Подтверждённые факты",
    label: "Личный проект"
  },
  education_university: {
    parts: ["assist", "profile", "Образование.md"],
    title: "Образование",
    sectionTitle: "Подтверждённые факты",
    label: "Вуз"
  },
  education_department: {
    parts: ["assist", "profile", "Образование.md"],
    title: "Образование",
    sectionTitle: "Подтверждённые факты",
    label: "Кафедра"
  },
  education_course: {
    parts: ["assist", "profile", "Образование.md"],
    title: "Образование",
    sectionTitle: "Подтверждённые факты",
    label: "Курс"
  },
  gpu: {
    parts: ["assist", "profile", "Устройства и железо.md"],
    title: "Устройства и железо",
    sectionTitle: "Подтверждённые факты",
    label: "Видеокарта"
  },
  cpu: {
    parts: ["assist", "profile", "Устройства и железо.md"],
    title: "Устройства и железо",
    sectionTitle: "Подтверждённые факты",
    label: "Процессор"
  },
  ram: {
    parts: ["assist", "profile", "Устройства и железо.md"],
    title: "Устройства и железо",
    sectionTitle: "Подтверждённые факты",
    label: "Оперативная память"
  },
  storage: {
    parts: ["assist", "profile", "Устройства и железо.md"],
    title: "Устройства и железо",
    sectionTitle: "Подтверждённые факты",
    label: "Накопитель"
  },
  preferred_stack: {
    parts: ["assist", "preferences", "Стек и технологии.md"],
    title: "Стек и технологии",
    sectionTitle: "Подтверждённые предпочтения",
    label: "Предпочитаемый стек"
  },
  interests: {
    parts: ["assist", "preferences", "Досуг и интересы.md"],
    title: "Досуг и интересы",
    sectionTitle: "Подтверждённые предпочтения",
    label: "Интерес"
  },
  hobbies: {
    parts: ["assist", "preferences", "Досуг и интересы.md"],
    title: "Досуг и интересы",
    sectionTitle: "Подтверждённые предпочтения",
    label: "Хобби"
  },
  preferred_environment: {
    parts: ["assist", "preferences", "Условия работы.md"],
    title: "Условия работы",
    sectionTitle: "Подтверждённые предпочтения",
    label: "Предпочитаемая среда"
  },
  career_preference: {
    parts: ["assist", "preferences", "Карьерные ориентиры.md"],
    title: "Карьерные ориентиры",
    sectionTitle: "Подтверждённые предпочтения",
    label: "Карьерный ориентир"
  },
  core_values: {
    parts: ["assist", "preferences", "Ценности и принципы.md"],
    title: "Ценности и принципы",
    sectionTitle: "Подтверждённые предпочтения",
    label: "Ключевая ценность"
  },
  communication_style: {
    parts: ["assist", "observations", "Поведенческие наблюдения.md"],
    title: "Поведенческие наблюдения",
    sectionTitle: "Наблюдения",
    label: "Стиль коммуникации"
  },
  life_period: {
    parts: ["assist", "observations", "Поведенческие наблюдения.md"],
    title: "Поведенческие наблюдения",
    sectionTitle: "Наблюдения",
    label: "Период жизни"
  },
  recent_emotional_signal: {
    parts: ["assist", "observations", "Эмоциональные сигналы.md"],
    title: "Эмоциональные сигналы",
    sectionTitle: "Наблюдения",
    label: "Эмоциональный сигнал"
  }
};

function toAbsolutePath(vaultRoot: string, parts: readonly string[]): string {
  return path.join(vaultRoot, ...parts);
}

async function upsertSectionEntries(
  notePath: string,
  title: string,
  sectionTitle: string,
  entries: string[]
): Promise<number> {
  if (entries.length === 0) {
    return 0;
  }

  await fs.mkdir(path.dirname(notePath), { recursive: true });
  const heading = `# ${title}`;
  const sectionHeading = `## ${sectionTitle}`;
  let content = "";

  try {
    content = await fs.readFile(notePath, "utf8");
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code !== "ENOENT") {
      throw error;
    }
  }

  const normalizedEntries = entries.filter((entry) => entry.trim().length > 0);

  if (content.trim().length === 0) {
    content = `${heading}\n\n${sectionHeading}\n\n${normalizedEntries.join("\n")}\n`;
    await fs.writeFile(notePath, content, "utf8");
    return normalizedEntries.length;
  }

  let changed = 0;

  if (!content.includes(heading)) {
    content = `${heading}\n\n${content.trim()}\n`;
  }

  if (!content.includes(sectionHeading)) {
    content = `${content.trimEnd()}\n\n${sectionHeading}\n\n`;
  }

  for (const entry of normalizedEntries) {
    if (content.includes(entry)) {
      continue;
    }

    content = `${content.trimEnd()}\n${entry}\n`;
    changed += 1;
  }

  if (changed > 0) {
    await fs.writeFile(notePath, content, "utf8");
  }

  return changed;
}

function buildStructuredGroups(
  vaultRoot: string,
  memoryWrites: ChatKnowledgeWrite[]
): StructuredGroup[] {
  const groups = new Map<string, StructuredGroup>();

  for (const write of memoryWrites) {
    const config = STRUCTURED_NOTE_MAP[write.key];
    if (!config) {
      continue;
    }

    const notePath = toAbsolutePath(vaultRoot, config.parts);
    const entry = `- **${config.label}:** ${write.value}`;
    const existing = groups.get(notePath);

    if (existing) {
      existing.entries.push(entry);
      continue;
    }

    groups.set(notePath, {
      notePath,
      title: config.title,
      sectionTitle: config.sectionTitle,
      entries: [entry]
    });
  }

  return [...groups.values()];
}

async function applyStructuredMemoryWrites(
  vaultRoot: string,
  memoryWrites: ChatKnowledgeWrite[]
): Promise<number> {
  const groups = buildStructuredGroups(vaultRoot, memoryWrites);
  let appliedCount = 0;

  for (const group of groups) {
    appliedCount += await upsertSectionEntries(
      group.notePath,
      group.title,
      group.sectionTitle,
      group.entries
    );
  }

  return appliedCount;
}

function isUrlCandidate(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function resolveStandaloneSourceRecords(
  memoryWrites: ChatKnowledgeWrite[],
  sourceUrls: string[]
): StandaloneSourceRecord[] {
  const records = new Map<string, StandaloneSourceRecord>();

  for (const write of memoryWrites) {
    if (write.target !== "assist/docs/websites" && write.target !== "assist/docs/papers") {
      continue;
    }

    const sourceUrl = isUrlCandidate(write.key)
      ? write.key
      : isUrlCandidate(write.value)
        ? write.value
        : null;

    if (sourceUrl === null) {
      continue;
    }

    const preferredTitle = !isUrlCandidate(write.value) ? write.value : undefined;
    const existing = records.get(sourceUrl);

    records.set(sourceUrl, {
      sourceUrl,
      sourceTitle: preferredTitle ?? existing?.sourceTitle
    });
  }

  for (const sourceUrl of sourceUrls) {
    if (!records.has(sourceUrl) && isUrlCandidate(sourceUrl)) {
      records.set(sourceUrl, { sourceUrl });
    }
  }

  return [...records.values()];
}

async function applyStandaloneSourceWrites(
  linker: KnowledgeLinker,
  memoryWrites: ChatKnowledgeWrite[],
  sourceUrls: string[]
): Promise<number> {
  const records = resolveStandaloneSourceRecords(memoryWrites, sourceUrls);

  for (const record of records) {
    await linker.recordSource(record);
  }

  return records.length;
}

export function createKnowledgeBackgroundWriter({
  getVaultRoot,
  decide = decideKnowledgeWrites,
  persistSkillApprovalDraft
}: KnowledgeBackgroundWriterOptions) {
  return {
    async recordInteraction(input: KnowledgeIngestInput): Promise<KnowledgeBackgroundWriteResult> {
      const vaultRoot = getVaultRoot();

      if (!vaultRoot) {
        return {
          applied: false,
          pendingApproval: false,
          userWriteCount: 0,
          assistWriteCount: 0
        };
      }

      ensureKnowledgeVault(vaultRoot);
      const plan = decide(input);
      const linker = new KnowledgeLinker({ vaultRoot });
      const writer = new KnowledgeWriter({ vaultRoot, linker });
      const structuredMemoryWriteCount = await applyStructuredMemoryWrites(
        vaultRoot,
        input.memoryWrites ?? []
      );
      const standaloneSourceWriteCount = await applyStandaloneSourceWrites(
        linker,
        input.memoryWrites ?? [],
        input.sourceUrls ?? []
      );

      for (const write of plan.userWrites) {
        await writer.writeUserTopic(write);
      }

      for (const write of plan.assistWrites) {
        await writer.writeAssistTopic(write);
      }

      for (const draft of plan.skillApprovalDrafts) {
        await persistSkillApprovalDraft?.(draft);
      }

      return {
        applied:
          plan.userWrites.length > 0 ||
          plan.assistWrites.length > 0 ||
          structuredMemoryWriteCount > 0 ||
          standaloneSourceWriteCount > 0,
        pendingApproval: plan.skillApprovalDrafts.length > 0,
        userWriteCount: plan.userWrites.length,
        assistWriteCount:
          plan.assistWrites.length + structuredMemoryWriteCount + standaloneSourceWriteCount
      };
    }
  };
}
