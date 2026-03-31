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

const PROFILE_NOTE_PATH = ["assist", "profile", "Профиль владельца.md"] as const;
const PREFERENCES_NOTE_PATH = ["assist", "preferences", "Предпочтения общения.md"] as const;

function toAbsolutePath(vaultRoot: string, parts: readonly string[]): string {
  return path.join(vaultRoot, ...parts);
}

async function upsertSectionEntries(
  notePath: string,
  title: string,
  sectionTitle: string,
  entries: string[]
): Promise<boolean> {
  if (entries.length === 0) {
    return false;
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
  let changed = false;

  if (content.trim().length === 0) {
    content = `${heading}\n\n${sectionHeading}\n\n${normalizedEntries.join("\n")}\n`;
    await fs.writeFile(notePath, content, "utf8");
    return true;
  }

  if (!content.includes(heading)) {
    content = `${heading}\n\n${content.trim()}\n`;
    changed = true;
  }

  if (!content.includes(sectionHeading)) {
    content = `${content.trimEnd()}\n\n${sectionHeading}\n\n${normalizedEntries.join("\n")}\n`;
    await fs.writeFile(notePath, content, "utf8");
    return true;
  }

  for (const entry of normalizedEntries) {
    if (content.includes(entry)) {
      continue;
    }

    content = `${content.trimEnd()}\n${entry}\n`;
    changed = true;
  }

  if (changed) {
    await fs.writeFile(notePath, content, "utf8");
  }

  return changed;
}

async function applyStructuredMemoryWrites(
  vaultRoot: string,
  memoryWrites: ChatKnowledgeWrite[]
): Promise<number> {
  const profileEntries: string[] = [];
  const preferenceEntries: string[] = [];

  for (const write of memoryWrites) {
    if (write.target === "assist/profile") {
      if (write.key === "full_name") {
        profileEntries.push(`- **ФИО:** ${write.value}`);
      } else if (write.key === "occupation") {
        profileEntries.push(`- **Роль:** ${write.value}`);
      } else {
        profileEntries.push(`- **${write.key}:** ${write.value}`);
      }
    } else if (write.target === "assist/preferences") {
      if (write.key === "preferred_stack") {
        preferenceEntries.push(`- **Предпочитаемый стек:** ${write.value}`);
      } else {
        preferenceEntries.push(`- **${write.key}:** ${write.value}`);
      }
    }
  }

  let appliedCount = 0;

  if (
    await upsertSectionEntries(
      toAbsolutePath(vaultRoot, PROFILE_NOTE_PATH),
      "Профиль владельца",
      "Подтверждённые факты",
      profileEntries
    )
  ) {
    appliedCount += profileEntries.length;
  }

  if (
    await upsertSectionEntries(
      toAbsolutePath(vaultRoot, PREFERENCES_NOTE_PATH),
      "Предпочтения общения",
      "Подтверждённые предпочтения",
      preferenceEntries
    )
  ) {
    appliedCount += preferenceEntries.length;
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

    const preferredTitle =
      !isUrlCandidate(write.value) ? write.value : undefined;
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
