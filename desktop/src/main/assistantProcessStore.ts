export type AssistantProcessRecord = {
  taskId: string;
  appId: string;
  displayName: string;
  aliases: string[];
  pid: number | null;
  kill?: () => Promise<void> | void;
};

function normalizeQuery(value: string): string {
  return value
    .toLowerCase()
    .replaceAll("ё", "е")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildSearchKeys(record: AssistantProcessRecord): Set<string> {
  const keys = new Set<string>();
  keys.add(normalizeQuery(record.displayName));

  for (const alias of record.aliases) {
    const normalized = normalizeQuery(alias);
    if (normalized) {
      keys.add(normalized);
    }
  }

  return keys;
}

export class AssistantProcessStore {
  private readonly active = new Map<string, AssistantProcessRecord>();

  register(record: AssistantProcessRecord): void {
    this.active.set(record.taskId, {
      ...record,
      aliases: [...record.aliases]
    });
  }

  listActive(): AssistantProcessRecord[] {
    return [...this.active.values()].map((record) => ({
      ...record,
      aliases: [...record.aliases]
    }));
  }

  findActiveByQuery(query: string): AssistantProcessRecord | null {
    const normalizedQuery = normalizeQuery(query);

    for (const record of this.active.values()) {
      const keys = buildSearchKeys(record);
      if (keys.has(normalizedQuery)) {
        return {
          ...record,
          aliases: [...record.aliases]
        };
      }
    }

    return null;
  }

  markExited(taskId: string): void {
    this.active.delete(taskId);
  }

  markCancelled(taskId: string): void {
    this.active.delete(taskId);
  }
}
