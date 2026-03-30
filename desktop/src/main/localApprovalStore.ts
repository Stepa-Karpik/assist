import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

import type { CodexWritePreviewDraft } from "./codexWritePreview";
import type { KnowledgeSkillApprovalDraft } from "./knowledgeIngestDecider";

export type { CodexWritePreviewDraft } from "./codexWritePreview";

type LocalApprovalStoreOptions = {
  stateRoot: string;
  now?: () => Date;
};

type PersistedCodexWriteApprovalRecord = {
  kind: "codex_write";
  taskId: string;
  intent: string;
  title: string;
  workspaceRoot: string;
  previewRoot: string;
  summaryText: string;
  previewText: string;
  changedFiles: string[];
  changes: CodexWritePreviewDraft["changes"];
  createdAt: string;
};

type PersistedAssistSkillApprovalRecord = {
  kind: "assist_skill";
  taskId: string;
  intent: string;
  title: string;
  targetPath: string;
  content: string;
  summaryText: string;
  previewText: string;
  changedFiles: string[];
  createdAt: string;
};

type PersistedLocalApprovalRecord =
  | PersistedCodexWriteApprovalRecord
  | PersistedAssistSkillApprovalRecord;

export type LocalApprovalSummary = {
  kind: "codex_write" | "assist_skill";
  taskId: string;
  intent: string;
  title: string;
  summaryText: string;
  previewText: string;
  changedFiles: string[];
  createdAt: string;
};

function hashBuffer(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

async function readHashOrNull(targetPath: string): Promise<string | null> {
  try {
    const stat = await fsp.stat(targetPath);

    if (!stat.isFile()) {
      return null;
    }

    return hashBuffer(await fsp.readFile(targetPath));
  } catch {
    return null;
  }
}

function toSummary(record: PersistedLocalApprovalRecord): LocalApprovalSummary {
  return {
    kind: record.kind,
    taskId: record.taskId,
    intent: record.intent,
    title: record.title,
    summaryText: record.summaryText,
    previewText: record.previewText,
    changedFiles: [...record.changedFiles],
    createdAt: record.createdAt
  };
}

export class LocalApprovalStore {
  private readonly filePath: string;

  private readonly now: () => Date;

  private records: PersistedLocalApprovalRecord[];

  constructor({ stateRoot, now = () => new Date() }: LocalApprovalStoreOptions) {
    this.filePath = path.join(stateRoot, "local-approvals.json");
    this.now = now;
    this.records = this.load();
  }

  list(): LocalApprovalSummary[] {
    return this.records.map((record) => toSummary(record));
  }

  getSummary(taskId: string): LocalApprovalSummary | null {
    const record = this.records.find((item) => item.taskId === taskId);
    return record ? toSummary(record) : null;
  }

  saveDraft(intent: string, draft: CodexWritePreviewDraft): LocalApprovalSummary {
    const record: PersistedCodexWriteApprovalRecord = {
      kind: "codex_write",
      taskId: draft.taskId,
      intent,
      title: draft.taskId,
      workspaceRoot: draft.workspaceRoot,
      previewRoot: draft.previewRoot,
      summaryText: draft.summaryText,
      previewText: draft.previewText,
      changedFiles: draft.changedFiles,
      changes: draft.changes,
      createdAt: this.now().toISOString()
    };
    this.records = this.records.filter((item) => item.taskId !== record.taskId);
    this.records.unshift(record);
    this.persist();
    return toSummary(record);
  }

  saveSkillDraft(intent: string, draft: KnowledgeSkillApprovalDraft): LocalApprovalSummary {
    const record: PersistedAssistSkillApprovalRecord = {
      kind: "assist_skill",
      taskId: draft.taskId,
      intent,
      title: draft.title,
      targetPath: draft.targetPath,
      content: draft.content,
      summaryText: draft.summaryText,
      previewText: draft.previewText,
      changedFiles: [...draft.changedFiles],
      createdAt: this.now().toISOString()
    };
    this.records = this.records.filter((item) => item.taskId !== record.taskId);
    this.records.unshift(record);
    this.persist();
    return toSummary(record);
  }

  async discardDraft(draft: CodexWritePreviewDraft): Promise<void> {
    await fsp.rm(draft.previewRoot, {
      recursive: true,
      force: true
    });
  }

  async approve(taskId: string): Promise<{ resultText: string }> {
    const record = this.records.find((item) => item.taskId === taskId);

    if (record === undefined) {
      throw new Error("Local approval preview not found.");
    }

    if (record.kind === "assist_skill") {
      await fsp.mkdir(path.dirname(record.targetPath), { recursive: true });
      await fsp.writeFile(record.targetPath, record.content, "utf8");
      await this.removeRecord(record.taskId);

      return {
        resultText: `Applied locally. ${record.summaryText}`
      };
    }

    for (const change of record.changes) {
      const currentHash = await readHashOrNull(path.join(record.workspaceRoot, change.relativePath));

      if (currentHash !== change.originalHash) {
        throw new Error("Workspace changed since preview generation.");
      }
    }

    const deletions = record.changes
      .filter((change) => change.kind === "delete")
      .sort((left, right) => right.relativePath.length - left.relativePath.length);
    const writes = record.changes
      .filter((change) => change.kind === "write")
      .sort((left, right) => left.relativePath.localeCompare(right.relativePath));

    for (const change of deletions) {
      await fsp.rm(path.join(record.workspaceRoot, change.relativePath), {
        recursive: true,
        force: true
      });
    }

    for (const change of writes) {
      const sourcePath = path.join(record.previewRoot, change.relativePath);
      const targetPath = path.join(record.workspaceRoot, change.relativePath);
      await fsp.mkdir(path.dirname(targetPath), { recursive: true });
      await fsp.copyFile(sourcePath, targetPath);
    }

    await this.removeRecord(record.taskId);

    return {
      resultText: `Applied locally. ${record.summaryText}`
    };
  }

  async reject(taskId: string): Promise<{ errorText: string }> {
    const record = this.records.find((item) => item.taskId === taskId);

    if (record === undefined) {
      throw new Error("Local approval preview not found.");
    }

    await this.removeRecord(record.taskId);
    return {
      errorText: "Rejected locally."
    };
  }

  private async removeRecord(taskId: string): Promise<void> {
    const record = this.records.find((item) => item.taskId === taskId);

    if (record === undefined) {
      return;
    }

    this.records = this.records.filter((item) => item.taskId !== taskId);
    this.persist();

    if (record.kind === "codex_write") {
      await fsp.rm(record.previewRoot, {
        recursive: true,
        force: true
      });
    }
  }

  private load(): PersistedLocalApprovalRecord[] {
    if (!fs.existsSync(this.filePath)) {
      return [];
    }

    return JSON.parse(fs.readFileSync(this.filePath, "utf8")) as PersistedLocalApprovalRecord[];
  }

  private persist(): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(this.records, null, 2));
  }
}
