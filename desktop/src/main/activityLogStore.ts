import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export type ActivityLogEntry = {
  entryId: string;
  kind: "local_request" | "local_result" | "remote_task";
  status: "info" | "success" | "warning" | "error";
  title: string;
  detail: string | null;
  chatId: string | null;
  taskId: string | null;
  createdAt: string;
};

type AppendActivityLogInput = {
  kind: ActivityLogEntry["kind"];
  status: ActivityLogEntry["status"];
  title: string;
  detail?: string | null;
  chatId?: string | null;
  taskId?: string | null;
};

type ActivityLogStoreOptions = {
  stateRoot: string;
  now?: () => Date;
  generateEntryId?: () => string;
  maxEntries?: number;
};

function sortEntries(entries: ActivityLogEntry[]): ActivityLogEntry[] {
  return [...entries].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export class ActivityLogStore {
  private readonly filePath: string;

  private readonly now: () => Date;

  private readonly generateEntryId: () => string;

  private readonly maxEntries: number;

  private entries: ActivityLogEntry[];

  constructor({
    stateRoot,
    now = () => new Date(),
    generateEntryId = () => crypto.randomUUID(),
    maxEntries = 200
  }: ActivityLogStoreOptions) {
    this.filePath = path.join(stateRoot, "activity-log.json");
    this.now = now;
    this.generateEntryId = generateEntryId;
    this.maxEntries = maxEntries;
    this.entries = this.load();
  }

  list(): ActivityLogEntry[] {
    return sortEntries(this.entries).map((entry) => ({ ...entry }));
  }

  count(): number {
    return this.entries.length;
  }

  append(input: AppendActivityLogInput): ActivityLogEntry {
    const nextEntry: ActivityLogEntry = {
      entryId: this.generateEntryId(),
      kind: input.kind,
      status: input.status,
      title: input.title,
      detail: input.detail ?? null,
      chatId: input.chatId ?? null,
      taskId: input.taskId ?? null,
      createdAt: this.now().toISOString()
    };

    this.entries = sortEntries([nextEntry, ...this.entries]).slice(0, this.maxEntries);
    this.persist();
    return { ...nextEntry };
  }

  private load(): ActivityLogEntry[] {
    if (!fs.existsSync(this.filePath)) {
      return [];
    }

    try {
      const rawValue = JSON.parse(fs.readFileSync(this.filePath, "utf8")) as unknown;

      if (!Array.isArray(rawValue)) {
        return [];
      }

      return sortEntries(
        rawValue.flatMap((entry) => {
          if (
            typeof entry !== "object" ||
            entry === null ||
            typeof (entry as ActivityLogEntry).entryId !== "string" ||
            typeof (entry as ActivityLogEntry).kind !== "string" ||
            typeof (entry as ActivityLogEntry).status !== "string" ||
            typeof (entry as ActivityLogEntry).title !== "string" ||
            typeof (entry as ActivityLogEntry).createdAt !== "string"
          ) {
            return [];
          }

          return [
            {
              entryId: (entry as ActivityLogEntry).entryId,
              kind: (entry as ActivityLogEntry).kind,
              status: (entry as ActivityLogEntry).status,
              title: (entry as ActivityLogEntry).title,
              detail: (entry as ActivityLogEntry).detail ?? null,
              chatId: (entry as ActivityLogEntry).chatId ?? null,
              taskId: (entry as ActivityLogEntry).taskId ?? null,
              createdAt: (entry as ActivityLogEntry).createdAt
            } satisfies ActivityLogEntry
          ];
        })
      ).slice(0, this.maxEntries);
    } catch {
      return [];
    }
  }

  private persist(): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(sortEntries(this.entries), null, 2));
  }
}
