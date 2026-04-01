import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ChatsPage } from "./ChatsPage";

type LocalChatItem = Awaited<ReturnType<NonNullable<Window["karpik"]>["getLocalChats"]>>[number];
type LocalChatDetail = NonNullable<
  Awaited<ReturnType<NonNullable<Window["karpik"]>["getLocalChatDetail"]>>
>;
type LocalChatRunState = NonNullable<
  Awaited<ReturnType<NonNullable<Window["karpik"]>["getLocalChatRunState"]>>
>;
type LocalChatStreamEvent = {
  chatId: string;
  detail: LocalChatDetail;
};
type LocalChatRunEvent = {
  chatId: string;
  run: LocalChatRunState | null;
};
type SubscribeLocalChatEventsMock = ReturnType<
  typeof vi.fn<(listener: (event: LocalChatStreamEvent) => void) => () => void>
> & {
  listener: ((event: LocalChatStreamEvent) => void) | null;
};
type SubscribeLocalChatRunEventsMock = ReturnType<
  typeof vi.fn<(listener: (event: LocalChatRunEvent) => void) => () => void>
> & {
  listener: ((event: LocalChatRunEvent) => void) | null;
};

describe("ChatsPage", () => {
  const baseChat: LocalChatDetail = {
    chatId: "local-chat-1",
    source: "desktop_chat",
    title: "Новый локальный чат",
    createdAt: "2026-04-01T20:00:00.000Z",
    updatedAt: "2026-04-01T20:00:00.000Z",
    messageCount: 0,
    referenceLabel: null,
    telegramChatId: null,
    workspaceId: null,
    messages: []
  };

  let resolveSend: ((detail: LocalChatDetail | null) => void) | null = null;

  const getLocalChats = vi.fn<() => Promise<LocalChatItem[]>>(async () => {
    const { messages, ...summary } = baseChat;
    return [summary];
  });
  const getLocalChatDetail = vi.fn(async () => baseChat);
  const getLocalChatRunState = vi.fn<
    (chatId: string) => Promise<LocalChatRunState | null>
  >(async () => null);
  const subscribeLocalChatEvents = vi.fn((listener: (event: LocalChatStreamEvent) => void) => {
    subscribeLocalChatEvents.listener = listener;
    return () => {
      subscribeLocalChatEvents.listener = null;
    };
  }) as SubscribeLocalChatEventsMock;
  subscribeLocalChatEvents.listener = null;
  const subscribeLocalChatRunEvents = vi.fn(
    (listener: (event: LocalChatRunEvent) => void) => {
      subscribeLocalChatRunEvents.listener = listener;
      return () => {
        subscribeLocalChatRunEvents.listener = null;
      };
    }
  ) as SubscribeLocalChatRunEventsMock;
  subscribeLocalChatRunEvents.listener = null;
  const sendLocalChatMessage = vi.fn(
    async (_payload: { chatId: string; text: string }) =>
      await new Promise<LocalChatDetail | null>((resolve) => {
        resolveSend = resolve;
      })
  );
  const cancelLocalChatRun = vi.fn(async () => true);

  beforeEach(() => {
    window.karpik = {
      ...(window.karpik ?? {}),
      view: window.karpik?.view ?? "main",
      getLocalChats,
      getLocalChatDetail,
      getLocalChatRunState,
      subscribeLocalChatEvents,
      subscribeLocalChatRunEvents,
      sendLocalChatMessage,
      cancelLocalChatRun
    } as NonNullable<Window["karpik"]>;
  });

  afterEach(() => {
    cleanup();
    getLocalChats.mockClear();
    getLocalChatDetail.mockClear();
    getLocalChatRunState.mockClear();
    subscribeLocalChatEvents.mockClear();
    subscribeLocalChatRunEvents.mockClear();
    sendLocalChatMessage.mockClear();
    cancelLocalChatRun.mockClear();
    subscribeLocalChatEvents.listener = null;
    subscribeLocalChatRunEvents.listener = null;
    resolveSend = null;
  });

  it("shows one live assistant bubble without a visible ack text while the reply is pending", async () => {
    render(<ChatsPage />);

    const input = await screen.findByLabelText("Local request");
    fireEvent.change(input, {
      target: { value: "Привет" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Отправить" }));

    expect(await screen.findByText("Привет")).toBeInTheDocument();
    expect(screen.queryByText("Сейчас посмотрю и отвечу по сути.")).not.toBeInTheDocument();
    expect(screen.getByTestId("local-chat-typing-indicator")).toBeInTheDocument();

    resolveSend?.({
      ...baseChat,
      updatedAt: "2026-04-01T20:01:00.000Z",
      messageCount: 2,
      messages: [
        {
          messageId: "message-user-1",
          role: "user",
          text: "Привет",
          createdAt: "2026-04-01T20:00:30.000Z"
        },
        {
          messageId: "message-assistant-1",
          role: "assistant",
          text: "Привет. Чем помочь?",
          createdAt: "2026-04-01T20:00:31.000Z"
        }
      ]
    });

    await waitFor(() => {
      expect(screen.getByText("Привет. Чем помочь?")).toBeInTheDocument();
    });
  });
});
