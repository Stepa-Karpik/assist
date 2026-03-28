import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";

const getOwnerProfileState = vi.fn(async () => ({
  fullName: "Степан Карпов",
  gender: "мужской",
  age: 26,
  city: "Москва",
  timezone: "Europe/Moscow",
  language: "ru",
  contacts: "@stepa",
  occupation: "software engineer",
  bio: null,
  notes: null
}));

const getLocalChats = vi.fn(async () => [
  {
    chatId: "local-chat-12",
    source: "desktop_chat" as const,
    title: "Локальный чат 12",
    createdAt: "2026-03-28T01:00:00.000Z",
    updatedAt: "2026-03-28T01:10:00.000Z",
    messageCount: 3,
    referenceLabel: "ссылается на Telegram чат 3",
    telegramChatId: 3,
    workspaceId: "assist-main"
  }
]);

const getLocalChatDetail = vi.fn(async () => ({
  chatId: "local-chat-12",
  source: "desktop_chat" as const,
  title: "Локальный чат 12",
  createdAt: "2026-03-28T01:00:00.000Z",
  updatedAt: "2026-03-28T01:10:00.000Z",
  messageCount: 3,
  referenceLabel: "ссылается на Telegram чат 3",
  telegramChatId: 3,
  workspaceId: "assist-main",
  messages: [
    {
      messageId: "assistant-1",
      role: "assistant" as const,
      text: "Добрый день, у меня все отлично, чем могу помочь?",
      createdAt: "2026-03-28T01:05:00.000Z"
    },
    {
      messageId: "user-1",
      role: "user" as const,
      text: "Давай сделаем мобильное приложение?",
      createdAt: "2026-03-28T01:06:00.000Z"
    }
  ]
}));

const getTaskSnapshot = vi.fn(async () => [
  {
    task_id: "3f51261b-a248-4dc9-a5d6-01a89e35efb9",
    status: "queued",
    intent: "Скриншот экрана",
    result_text: null,
    error_text: null,
    artifact_kind: null,
    artifact_mime_type: null,
    artifact_file_name: null,
    artifact_base64: null,
    chat_id: 12,
    created_at: "2026-03-28T01:05:00.000Z",
    updated_at: "2026-03-28T01:06:00.000Z"
  }
]);

const getCodexConfigState = vi.fn(async () => ({
  workspaces: [
    {
      id: "assist-main",
      name: "Assist Main",
      rootPath: "C:\\Users\\TBG\\Desktop\\assist"
    }
  ],
  defaultWorkspaceId: "assist-main",
  chatBindings: {
    "12": "assist-main"
  }
}));

beforeEach(() => {
  Object.defineProperty(window, "karpik", {
    configurable: true,
    value: {
      view: "main",
      getOwnerProfileState,
      getLocalChats,
      getLocalChatDetail,
      getTaskSnapshot,
      getCodexConfigState,
      getLocalApprovals: vi.fn(async () => []),
      createDesktopChat: vi.fn(async () => ({
        chatId: "local-chat-13",
        source: "desktop_chat" as const,
        title: "Новый локальный чат",
        createdAt: "2026-03-28T01:11:00.000Z",
        updatedAt: "2026-03-28T01:11:00.000Z",
        messageCount: 0,
        referenceLabel: null,
        telegramChatId: null,
        workspaceId: "assist-main"
      })),
      submitQuickRequest: vi.fn(async () => ({
        chat: null,
        detail: {
          messages: [
            {
              messageId: "assistant-2",
              role: "assistant",
              text: "Готов помочь.",
              createdAt: "2026-03-28T01:12:00.000Z"
            }
          ]
        }
      })),
      saveOwnerProfile: vi.fn(async (payload: unknown) => payload),
      createLocalContinuationChat: vi.fn(async () => ({
        chatId: "local-chat-14",
        source: "local_continuation_chat" as const,
        title: "Telegram 12",
        createdAt: "2026-03-28T01:15:00.000Z",
        updatedAt: "2026-03-28T01:15:00.000Z",
        messageCount: 0,
        referenceLabel: "Продолжен в локальном чате 12",
        telegramChatId: 12,
        workspaceId: "assist-main"
      })),
      saveChatWorkspaceBinding: vi.fn(async () => ({
        workspaces: [
          {
            id: "assist-main",
            name: "Assist Main",
            rootPath: "C:\\Users\\TBG\\Desktop\\assist"
          }
        ],
        defaultWorkspaceId: "assist-main",
        chatBindings: {
          "12": "assist-main"
        }
      }))
    }
  });
});

describe("core pages reference shell", () => {
  it("renders the shared shell on the home page", async () => {
    render(<App />);

    expect(await screen.findByPlaceholderText("Поиск")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Задачи" })).toHaveLength(2);
    expect(screen.getByText("Новый чат")).toBeInTheDocument();
    expect(screen.getByTestId("reference-home")).toBeInTheDocument();
  });

  it("keeps chats and tasks inside the same shell", async () => {
    render(<App />);

    fireEvent.click((await screen.findAllByRole("button", { name: "Чаты" }))[0]);
    expect(await screen.findByTestId("reference-chats")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Сообщение...")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Задачи" })[1]);
    expect(await screen.findByText("Все")).toBeInTheDocument();
    expect(screen.getByText("Скриншот экрана")).toBeInTheDocument();
  });
});
