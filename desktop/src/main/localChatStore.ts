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

export type LocalChatMessageArtifactKind = "image_base64" | "file_base64";

export type LocalChatMessage = {
  messageId: string;
  role: "user" | "assistant" | "system";
  text: string;
  createdAt: string;
  artifactKind?: LocalChatMessageArtifactKind;
  artifactMimeType?: string | null;
  artifactFileName?: string | null;
  artifactBase64?: string | null;
  remoteTaskId?: string | null;
  remoteTaskSignature?: string | null;
};

export type LocalChatDetail = LocalChatRecord & {
  messages: LocalChatMessage[];
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

type AppendMessageInput = {
  role: LocalChatMessage["role"];
  text: string;
  artifact?: {
    kind: LocalChatMessageArtifactKind;
    mimeType: string;
    fileName: string;
    contentBase64: string;
  };
  remoteTaskId?: string | null;
  remoteTaskSignature?: string | null;
};

type UpdateMessageInput = {
  text?: string;
  role?: LocalChatMessage["role"];
  artifact?: {
    kind: LocalChatMessageArtifactKind;
    mimeType: string;
    fileName: string;
    contentBase64: string;
  } | null;
};

type MirrorRemoteTaskUpdateInput = {
  telegramChatId: number;
  taskId: string;
  intent: string;
  status:
    | "queued"
    | "awaiting_auth"
    | "awaiting_local_approval"
    | "cancel_requested"
    | "cancelled"
    | "blocked"
    | "running"
    | "done"
    | "failed"
    | "stalled";
  resultText?: string | null;
  errorText?: string | null;
  artifact?: {
    kind: LocalChatMessageArtifactKind;
    mimeType: string;
    fileName: string;
    contentBase64: string;
  };
};

type PersistedLocalChatRecord = Partial<LocalChatDetail>;

function sortChats<T extends { updatedAt: string }>(chats: T[]): T[] {
  return [...chats].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function toSummary(chat: LocalChatDetail): LocalChatRecord {
  return {
    chatId: chat.chatId,
    source: chat.source,
    title: chat.title,
    createdAt: chat.createdAt,
    updatedAt: chat.updatedAt,
    messageCount: chat.messages.length,
    referenceLabel: chat.referenceLabel,
    telegramChatId: chat.telegramChatId,
    workspaceId: chat.workspaceId
  };
}

function cloneDetail(chat: LocalChatDetail): LocalChatDetail {
  return {
    ...toSummary(chat),
    messages: chat.messages.map((message) => ({ ...message }))
  };
}

function normalizeArtifactFields(value: Partial<LocalChatMessage> | undefined) {
  if (
    (value?.artifactKind === "image_base64" || value?.artifactKind === "file_base64") &&
    typeof value.artifactMimeType === "string" &&
    typeof value.artifactFileName === "string" &&
    typeof value.artifactBase64 === "string"
  ) {
    return {
      artifactKind: value.artifactKind,
      artifactMimeType: value.artifactMimeType,
      artifactFileName: value.artifactFileName,
      artifactBase64: value.artifactBase64
    };
  }

  return {};
}

function normalizeRemoteTaskFields(value: Partial<LocalChatMessage> | undefined) {
  if (typeof value?.remoteTaskId === "string" && typeof value?.remoteTaskSignature === "string") {
    return {
      remoteTaskId: value.remoteTaskId,
      remoteTaskSignature: value.remoteTaskSignature
    };
  }

  return {};
}

function repairLegacyTitle(value: string): string {
  return value === "РќРѕРІС‹Р№ Р»РѕРєР°Р»СЊРЅС‹Р№ С‡Р°С‚" ? "Новый локальный чат" : value;
}

function repairLegacyReferenceLabel(value: string | null, telegramChatId: number | null): string | null {
  if (value === null) {
    return null;
  }

  if (value.startsWith("РЎСЃС‹Р»Р°РµС‚СЃСЏ") && telegramChatId !== null) {
    return `Ссылается на Telegram chat ${telegramChatId}`;
  }

  return value;
}

function normalizeMessage(value: Partial<LocalChatMessage> | undefined): LocalChatMessage | null {
  if (value?.text === undefined || typeof value.text !== "string") {
    return null;
  }

  if (value.role !== "user" && value.role !== "assistant" && value.role !== "system") {
    return null;
  }

  return {
    messageId:
      typeof value.messageId === "string" && value.messageId.length > 0
        ? value.messageId
        : crypto.randomUUID(),
    role: value.role,
    text: value.text,
    createdAt:
      typeof value.createdAt === "string" && value.createdAt.length > 0
        ? value.createdAt
        : new Date(0).toISOString(),
    ...normalizeArtifactFields(value),
    ...normalizeRemoteTaskFields(value)
  };
}

function buildRemoteTaskMirrorSignature(input: MirrorRemoteTaskUpdateInput): string {
  return JSON.stringify([
    input.telegramChatId,
    input.taskId,
    input.status,
    input.intent,
    input.resultText ?? null,
    input.errorText ?? null,
    input.artifact?.fileName ?? null,
    input.artifact?.contentBase64 ?? null
  ]);
}

function buildRemoteTaskMirrorText(input: MirrorRemoteTaskUpdateInput): string {
  const statusLine = (() => {
    switch (input.status) {
      case "done":
        return `Telegram-задача ${input.taskId} завершена.`;
      case "cancelled":
        return `Telegram-задача ${input.taskId} остановлена.`;
      case "failed":
        return `Telegram-задача ${input.taskId} завершилась ошибкой.`;
      case "blocked":
        return `Telegram-задача ${input.taskId} заблокирована.`;
      case "cancel_requested":
        return `Telegram-задача ${input.taskId} останавливается.`;
      case "awaiting_auth":
        return `Telegram-задача ${input.taskId} ждёт авторизации.`;
      case "awaiting_local_approval":
        return `Telegram-задача ${input.taskId} ждёт локального подтверждения.`;
      case "stalled":
        return `Telegram-задача ${input.taskId} зависла.`;
      case "running":
        return `Telegram-задача ${input.taskId} выполняется.`;
      case "queued":
        return `Telegram-задача ${input.taskId} стоит в очереди.`;
      default:
        return `Telegram-задача ${input.taskId} обновлена.`;
    }
  })();
  const detailLine = input.resultText ?? input.errorText ?? null;

  return detailLine === null
    ? `${statusLine}\n${input.intent}`
    : `${statusLine}\n${input.intent}\n${detailLine}`;
}

function normalizeChat(value: PersistedLocalChatRecord): LocalChatDetail | null {
  if (
    typeof value.chatId !== "string" ||
    (value.source !== "desktop_chat" && value.source !== "local_continuation_chat") ||
    typeof value.title !== "string" ||
    typeof value.createdAt !== "string"
  ) {
    return null;
  }

  const messages = Array.isArray(value.messages)
    ? value.messages
        .map((message) => normalizeMessage(message))
        .filter((message): message is LocalChatMessage => message !== null)
    : [];
  const updatedAt =
    typeof value.updatedAt === "string" && value.updatedAt.length > 0
      ? value.updatedAt
      : messages.at(-1)?.createdAt ?? value.createdAt;
  const telegramChatId = typeof value.telegramChatId === "number" ? value.telegramChatId : null;

  return {
    chatId: value.chatId,
    source: value.source,
    title: repairLegacyTitle(value.title),
    createdAt: value.createdAt,
    updatedAt,
    messageCount: messages.length,
    referenceLabel: repairLegacyReferenceLabel(
      typeof value.referenceLabel === "string" ? value.referenceLabel : null,
      telegramChatId
    ),
    telegramChatId,
    workspaceId: typeof value.workspaceId === "string" ? value.workspaceId : null,
    messages
  };
}

export class LocalChatStore {
  private readonly filePath: string;

  private readonly now: () => Date;

  private readonly generateChatId: () => string;

  private chats: LocalChatDetail[];

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
    return sortChats(this.chats).map((chat) => toSummary(chat));
  }

  getChat(chatId: string): LocalChatDetail | null {
    const chat = this.chats.find((candidate) => candidate.chatId === chatId);
    return chat ? cloneDetail(chat) : null;
  }

  createDesktopChat({
    title = "Новый локальный чат",
    workspaceId = null
  }: CreateDesktopChatInput = {}): LocalChatRecord {
    const timestamp = this.now().toISOString();
    const nextChat: LocalChatDetail = {
      chatId: this.generateChatId(),
      source: "desktop_chat",
      title,
      createdAt: timestamp,
      updatedAt: timestamp,
      messageCount: 0,
      referenceLabel: null,
      telegramChatId: null,
      workspaceId: workspaceId ?? null,
      messages: []
    };

    this.chats = sortChats([nextChat, ...this.chats]);
    this.persist();
    return toSummary(nextChat);
  }

  createContinuationChat({
    telegramChatId,
    title,
    workspaceId
  }: CreateContinuationChatInput): LocalChatRecord {
    const timestamp = this.now().toISOString();
    const existingChat = this.chats.find(
      (chat) => chat.source === "local_continuation_chat" && chat.telegramChatId === telegramChatId
    );

    if (existingChat !== undefined) {
      const nextWorkspaceId: string | null =
        workspaceId === undefined ? existingChat.workspaceId : workspaceId;
      const nextChat: LocalChatDetail = {
        ...existingChat,
        title: title?.trim() || existingChat.title,
        updatedAt: timestamp,
        workspaceId: nextWorkspaceId
      };

      this.chats = sortChats([
        nextChat,
        ...this.chats.filter((chat) => chat.chatId !== existingChat.chatId)
      ]);
      this.persist();
      return toSummary(nextChat);
    }

    const nextChat: LocalChatDetail = {
      chatId: this.generateChatId(),
      source: "local_continuation_chat",
      title: title?.trim() || `Telegram ${telegramChatId}`,
      createdAt: timestamp,
      updatedAt: timestamp,
      messageCount: 0,
      referenceLabel: `Ссылается на Telegram chat ${telegramChatId}`,
      telegramChatId,
      workspaceId: workspaceId ?? null,
      messages: []
    };

    this.chats = sortChats([nextChat, ...this.chats]);
    this.persist();
    return toSummary(nextChat);
  }

  appendMessage(chatId: string, input: AppendMessageInput): LocalChatDetail {
    const chat = this.chats.find((candidate) => candidate.chatId === chatId);

    if (chat === undefined) {
      throw new Error("Local chat not found.");
    }

    const nextMessage: LocalChatMessage = {
      messageId: crypto.randomUUID(),
      role: input.role,
      text: input.text,
      createdAt: this.now().toISOString(),
      artifactKind: input.artifact?.kind,
      artifactMimeType: input.artifact?.mimeType,
      artifactFileName: input.artifact?.fileName,
      artifactBase64: input.artifact?.contentBase64,
      ...(input.remoteTaskId && input.remoteTaskSignature
        ? {
            remoteTaskId: input.remoteTaskId,
            remoteTaskSignature: input.remoteTaskSignature
          }
        : {})
    };
    const nextChat: LocalChatDetail = {
      ...chat,
      updatedAt: nextMessage.createdAt,
      messageCount: chat.messages.length + 1,
      messages: [...chat.messages, nextMessage]
    };

    this.chats = sortChats([nextChat, ...this.chats.filter((candidate) => candidate.chatId !== chatId)]);
    this.persist();
    return cloneDetail(nextChat);
  }

  updateMessage(chatId: string, messageId: string, input: UpdateMessageInput): LocalChatDetail {
    const chat = this.chats.find((candidate) => candidate.chatId === chatId);

    if (chat === undefined) {
      throw new Error("Local chat not found.");
    }

    const nextMessages = chat.messages.map((message) => {
      if (message.messageId !== messageId) {
        return message;
      }

      return {
        ...message,
        role: input.role ?? message.role,
        text: input.text ?? message.text,
        artifactKind: input.artifact === null ? undefined : input.artifact?.kind ?? message.artifactKind,
        artifactMimeType:
          input.artifact === null ? undefined : input.artifact?.mimeType ?? message.artifactMimeType,
        artifactFileName:
          input.artifact === null ? undefined : input.artifact?.fileName ?? message.artifactFileName,
        artifactBase64:
          input.artifact === null ? undefined : input.artifact?.contentBase64 ?? message.artifactBase64
      };
    });

    const nextChat: LocalChatDetail = {
      ...chat,
      updatedAt: this.now().toISOString(),
      messageCount: nextMessages.length,
      messages: nextMessages
    };

    this.chats = sortChats([nextChat, ...this.chats.filter((candidate) => candidate.chatId !== chatId)]);
    this.persist();
    return cloneDetail(nextChat);
  }

  mirrorRemoteTaskUpdate(input: MirrorRemoteTaskUpdateInput): LocalChatDetail | null {
    const chat = this.chats.find(
      (candidate) =>
        candidate.source === "local_continuation_chat" && candidate.telegramChatId === input.telegramChatId
    );

    if (chat === undefined) {
      return null;
    }

    const remoteTaskSignature = buildRemoteTaskMirrorSignature(input);

    if (chat.messages.some((message) => message.remoteTaskSignature === remoteTaskSignature)) {
      return cloneDetail(chat);
    }

    return this.appendMessage(chat.chatId, {
      role: "system",
      text: buildRemoteTaskMirrorText(input),
      artifact: input.artifact,
      remoteTaskId: input.taskId,
      remoteTaskSignature
    });
  }

  private load(): LocalChatDetail[] {
    if (!fs.existsSync(this.filePath)) {
      return [];
    }

    try {
      const rawValue = JSON.parse(fs.readFileSync(this.filePath, "utf8")) as unknown;

      if (!Array.isArray(rawValue)) {
        return [];
      }

      return sortChats(
        rawValue
          .map((item) => normalizeChat(item as PersistedLocalChatRecord))
          .filter((item): item is LocalChatDetail => item !== null)
      );
    } catch {
      return [];
    }
  }

  private persist(): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(sortChats(this.chats), null, 2));
  }
}
