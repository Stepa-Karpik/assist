import fs from "node:fs";
import path from "node:path";

export type ChatSessionRecord = {
  chatId: string;
  telegramChatId: number | null;
  deviceId: string;
  codexSessionId: string;
  interrupted: boolean;
};

type ChatSessionStoreOptions = {
  stateRoot: string;
};

type SaveLocalChatSessionInput = {
  chatId: string;
  deviceId: string;
  codexSessionId: string;
};

type SaveTelegramChatSessionInput = {
  telegramChatId: number;
  deviceId: string;
  codexSessionId: string;
};

type LinkLocalChatToTelegramChatInput = {
  chatId: string;
  telegramChatId: number;
};

type PersistedChatSessionRecord = Partial<ChatSessionRecord>;

function normalizeRecord(value: PersistedChatSessionRecord): ChatSessionRecord | null {
  if (
    typeof value.chatId !== "string" ||
    value.chatId.length === 0 ||
    typeof value.deviceId !== "string" ||
    value.deviceId.length === 0 ||
    typeof value.codexSessionId !== "string" ||
    value.codexSessionId.length === 0
  ) {
    return null;
  }

  return {
    chatId: value.chatId,
    telegramChatId: typeof value.telegramChatId === "number" ? value.telegramChatId : null,
    deviceId: value.deviceId,
    codexSessionId: value.codexSessionId,
    interrupted: value.interrupted === true
  };
}

function cloneRecord(record: ChatSessionRecord): ChatSessionRecord {
  return {
    chatId: record.chatId,
    telegramChatId: record.telegramChatId,
    deviceId: record.deviceId,
    codexSessionId: record.codexSessionId,
    interrupted: record.interrupted
  };
}

export class ChatSessionStore {
  private readonly filePath: string;

  private records: ChatSessionRecord[];

  constructor({ stateRoot }: ChatSessionStoreOptions) {
    this.filePath = path.join(stateRoot, "chat-sessions.json");
    this.records = this.load();
  }

  getByLocalChatId(chatId: string): ChatSessionRecord | null {
    const record = this.records.find((candidate) => candidate.chatId === chatId);
    return record ? cloneRecord(record) : null;
  }

  getByTelegramChatId(telegramChatId: number): ChatSessionRecord | null {
    const record = this.records.find((candidate) => candidate.telegramChatId === telegramChatId);
    return record ? cloneRecord(record) : null;
  }

  saveLocalChatSession(input: SaveLocalChatSessionInput): ChatSessionRecord {
    const existing = this.records.find((candidate) => candidate.chatId === input.chatId);
    const nextRecord: ChatSessionRecord = {
      chatId: input.chatId,
      telegramChatId: existing?.telegramChatId ?? null,
      deviceId: input.deviceId,
      codexSessionId: input.codexSessionId,
      interrupted: existing?.interrupted ?? false
    };

    this.upsert(nextRecord);
    return cloneRecord(nextRecord);
  }

  saveTelegramChatSession(input: SaveTelegramChatSessionInput): ChatSessionRecord {
    const existing = this.records.find((candidate) => candidate.telegramChatId === input.telegramChatId);
    const nextRecord: ChatSessionRecord = {
      chatId: existing?.chatId ?? `telegram:${input.telegramChatId}`,
      telegramChatId: input.telegramChatId,
      deviceId: input.deviceId,
      codexSessionId: input.codexSessionId,
      interrupted: existing?.interrupted ?? false
    };

    this.upsert(nextRecord);
    return cloneRecord(nextRecord);
  }

  linkLocalChatToTelegramChat(input: LinkLocalChatToTelegramChatInput): ChatSessionRecord {
    const telegramRecord = this.records.find((candidate) => candidate.telegramChatId === input.telegramChatId);

    if (!telegramRecord) {
      throw new Error("Telegram chat session not found.");
    }

    const nextRecord: ChatSessionRecord = {
      ...telegramRecord,
      chatId: input.chatId
    };

    this.records = this.records.filter(
      (candidate) => candidate.chatId !== input.chatId && candidate.telegramChatId !== input.telegramChatId
    );
    this.records.push(nextRecord);
    this.persist();
    return cloneRecord(nextRecord);
  }

  markInterrupted(chatId: string, interrupted: boolean): ChatSessionRecord | null {
    const existing = this.records.find((candidate) => candidate.chatId === chatId);

    if (!existing) {
      return null;
    }

    const nextRecord: ChatSessionRecord = {
      ...existing,
      interrupted
    };

    this.upsert(nextRecord);
    return cloneRecord(nextRecord);
  }

  private upsert(nextRecord: ChatSessionRecord): void {
    this.records = this.records.filter(
      (candidate) =>
        candidate.chatId !== nextRecord.chatId &&
        (nextRecord.telegramChatId === null || candidate.telegramChatId !== nextRecord.telegramChatId)
    );
    this.records.push(nextRecord);
    this.persist();
  }

  private load(): ChatSessionRecord[] {
    if (!fs.existsSync(this.filePath)) {
      return [];
    }

    try {
      const rawValue = JSON.parse(fs.readFileSync(this.filePath, "utf8")) as unknown;

      if (!Array.isArray(rawValue)) {
        return [];
      }

      return rawValue
        .map((item) => normalizeRecord(item as PersistedChatSessionRecord))
        .filter((item): item is ChatSessionRecord => item !== null);
    } catch {
      return [];
    }
  }

  private persist(): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(this.records, null, 2));
  }
}
