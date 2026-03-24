import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export type LocalChatRecord = {
  chatId: string;
  source: "desktop_chat" | "local_continuation_chat";
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  referenceLabel: string | null;
  telegramChatId: number | null;
  workspaceId: string | null;
};

type LocalChatStoreOptions = {
  stateRoot: string;
  now?: () => Date;
  generateChatId?: () => string;
};

type CreateDesktopChatInput = {
  title?: string;
  workspaceId?: string | null;
};

type CreateContinuationChatInput = {
  telegramChatId: number;
  title?: string;
  workspaceId?: string | null;
};

function sortChats(chats: LocalChatRecord[]): LocalChatRecord[] {
  return [...chats].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export class LocalChatStore {
  private readonly filePath: string;

  private readonly now: () => Date;

  private readonly generateChatId: () => string;

  private chats: LocalChatRecord[];

  constructor({
    stateRoot,
    now = () => new Date(),
    generateChatId = () => crypto.randomUUID()
  }: LocalChatStoreOptions) {
    this.filePath = path.join(stateRoot, "local-chats.json");
    this.now = now;
    this.generateChatId = generateChatId;
    this.chats = this.load();
  }

  list(): LocalChatRecord[] {
    return sortChats(this.chats).map((chat) => ({ ...chat }));
  }

  createDesktopChat({
    title = "Новый локальный чат",
    workspaceId = null
  }: CreateDesktopChatInput = {}): LocalChatRecord {
    const timestamp = this.now().toISOString();
    const nextChat: LocalChatRecord = {
      chatId: this.generateChatId(),
      source: "desktop_chat",
      title,
      createdAt: timestamp,
      updatedAt: timestamp,
      messageCount: 0,
      referenceLabel: null,
      telegramChatId: null,
      workspaceId
    };

    this.chats = sortChats([nextChat, ...this.chats]);
    this.persist();
    return { ...nextChat };
  }

  createContinuationChat({
    telegramChatId,
    title,
    workspaceId = null
  }: CreateContinuationChatInput): LocalChatRecord {
    const timestamp = this.now().toISOString();
    const nextChat: LocalChatRecord = {
      chatId: this.generateChatId(),
      source: "local_continuation_chat",
      title: title?.trim() || `Telegram ${telegramChatId}`,
      createdAt: timestamp,
      updatedAt: timestamp,
      messageCount: 0,
      referenceLabel: `Ссылается на Telegram chat ${telegramChatId}`,
      telegramChatId,
      workspaceId
    };

    this.chats = sortChats([nextChat, ...this.chats]);
    this.persist();
    return { ...nextChat };
  }

  private load(): LocalChatRecord[] {
    if (!fs.existsSync(this.filePath)) {
      return [];
    }

    try {
      return sortChats(JSON.parse(fs.readFileSync(this.filePath, "utf8")) as LocalChatRecord[]);
    } catch {
      return [];
    }
  }

  private persist(): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(sortChats(this.chats), null, 2));
  }
}
