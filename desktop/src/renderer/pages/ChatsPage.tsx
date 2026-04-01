import { useEffect, useMemo, useRef, useState } from "react";

type LocalChatItem = Awaited<ReturnType<NonNullable<Window["karpik"]>["getLocalChats"]>>[number];

type LocalChatDetail = NonNullable<
  Awaited<ReturnType<NonNullable<Window["karpik"]>["getLocalChatDetail"]>>
>;

type LocalChatRunState = Awaited<
  ReturnType<NonNullable<Window["karpik"]>["getLocalChatRunState"]>
>;

type OptimisticRunState = {
  runId: string;
  chatId: string;
  status: "thinking";
  cancelRequested: false;
  ackMessageId: string | null;
  replyMessageId: string;
};

function buildArtifactDataUrl(message: LocalChatDetail["messages"][number]): string | null {
  if (message.artifactKind !== "image_base64" || !message.artifactMimeType || !message.artifactBase64) {
    return null;
  }

  return `data:${message.artifactMimeType};base64,${message.artifactBase64}`;
}

function formatMessageTime(value: string): string {
  try {
    return new Date(value).toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return value;
  }
}

function sortChats(chats: LocalChatItem[]): LocalChatItem[] {
  return [...chats].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function toSummary(chat: LocalChatDetail): LocalChatItem {
  const { messages, ...summary } = chat;
  return summary;
}

function upsertChatSummary(chats: LocalChatItem[], nextChat: LocalChatItem): LocalChatItem[] {
  return sortChats([nextChat, ...chats.filter((chat) => chat.chatId !== nextChat.chatId)]);
}

function shouldReplaceChatDetail(
  currentChat: LocalChatDetail | null,
  nextChat: LocalChatDetail
): boolean {
  if (currentChat === null || currentChat.chatId !== nextChat.chatId) {
    return true;
  }

  if (nextChat.messageCount > currentChat.messageCount) {
    return true;
  }

  if (nextChat.updatedAt > currentChat.updatedAt) {
    return true;
  }

  return false;
}

function buildChatSubtitle(chat: LocalChatItem): string {
  if (chat.referenceLabel) {
    return chat.referenceLabel;
  }

  if (chat.workspaceId) {
    return `workspace ${chat.workspaceId}`;
  }

  return chat.source === "local_continuation_chat" ? "Продолжение Telegram-диалога" : "Локальный диалог";
}

function isTypingMessage(
  message: LocalChatDetail["messages"][number],
  run: LocalChatRunState | OptimisticRunState | null
): boolean {
  return (
    run !== null &&
    message.role === "assistant" &&
    message.messageId === run.replyMessageId &&
    message.text.trim().length === 0
  );
}

type ChatsPageProps = {
  selectedChatId?: string | null;
  onSelectChat?: (chatId: string | null) => void;
};

export function ChatsPage({ selectedChatId, onSelectChat }: ChatsPageProps) {
  const [localChats, setLocalChats] = useState<LocalChatItem[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(selectedChatId ?? null);
  const [activeChat, setActiveChat] = useState<LocalChatDetail | null>(null);
  const [activeRun, setActiveRun] = useState<LocalChatRunState>(null);
  const [requestText, setRequestText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [optimisticRun, setOptimisticRun] = useState<OptimisticRunState | null>(null);
  const [optimisticMessages, setOptimisticMessages] = useState<LocalChatDetail["messages"]>([]);
  const messagesViewportRef = useRef<HTMLDivElement | null>(null);
  const composerInputRef = useRef<HTMLTextAreaElement | null>(null);
  const activeChatIdRef = useRef<string | null>(selectedChatId ?? null);

  const activeChatSummary = useMemo(
    () => localChats.find((chat) => chat.chatId === activeChatId) ?? null,
    [activeChatId, localChats]
  );
  const effectiveRun = optimisticRun ?? activeRun;
  const isChatBusy = effectiveRun !== null;
  const displayedMessages = useMemo(() => {
    const persistedMessages = activeChat?.messages ?? [];

    if (optimisticMessages.length === 0) {
      return persistedMessages;
    }

    return [...persistedMessages, ...optimisticMessages];
  }, [activeChat?.messages, optimisticMessages]);

  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);

  useEffect(() => {
    let isSubscribed = true;

    async function loadLocalChats() {
      try {
        const chats = await (window.karpik?.getLocalChats?.() ?? Promise.resolve([]));

        if (!isSubscribed) {
          return;
        }

        const sortedChats = sortChats(chats);
        setLocalChats(sortedChats);
        const preferredChatId =
          selectedChatId && sortedChats.some((chat) => chat.chatId === selectedChatId)
            ? selectedChatId
            : activeChatId && sortedChats.some((chat) => chat.chatId === activeChatId)
              ? activeChatId
              : sortedChats[0]?.chatId ?? null;
        activeChatIdRef.current = preferredChatId;
        setActiveChatId(preferredChatId);
      } catch {
        if (isSubscribed) {
          setError("Не удалось загрузить локальные чаты.");
        }
      } finally {
        if (isSubscribed) {
          setIsLoading(false);
        }
      }
    }

    void loadLocalChats();

    return () => {
      isSubscribed = false;
    };
  }, [activeChatId, selectedChatId]);

  useEffect(() => {
    onSelectChat?.(activeChatId ?? null);
  }, [activeChatId, onSelectChat]);

  useEffect(() => {
    if (selectedChatId === undefined) {
      return;
    }

    activeChatIdRef.current = selectedChatId;
    setActiveChatId(selectedChatId);
  }, [selectedChatId]);

  useEffect(() => {
    if (activeChatId !== null && localChats.some((chat) => chat.chatId === activeChatId)) {
      return;
    }

    const nextChatId = localChats[0]?.chatId ?? null;
    activeChatIdRef.current = nextChatId;
    setActiveChatId(nextChatId);
    onSelectChat?.(nextChatId);
  }, [activeChatId, localChats, onSelectChat]);

  useEffect(() => {
    let isSubscribed = true;

    async function loadLocalChatDetail() {
      if (activeChatId === null) {
        setActiveChat(null);
        return;
      }

      if (!window.karpik?.getLocalChatDetail) {
        setError("API локальных чатов недоступен в этом окружении.");
        return;
      }

      setIsDetailLoading(true);

      try {
        const detail = await window.karpik.getLocalChatDetail(activeChatId);

        if (!isSubscribed) {
          return;
        }

        if (detail === null) {
          setActiveChat(null);
          setError("Локальный чат не найден.");
          return;
        }

        setActiveChat(detail);
      } catch {
        if (isSubscribed) {
          setError("Не удалось загрузить детали локального чата.");
        }
      } finally {
        if (isSubscribed) {
          setIsDetailLoading(false);
        }
      }
    }

    void loadLocalChatDetail();

    return () => {
      isSubscribed = false;
    };
  }, [activeChatId]);

  useEffect(() => {
    let isSubscribed = true;

    async function loadRunState() {
      if (activeChatId === null || !window.karpik?.getLocalChatRunState) {
        setActiveRun(null);
        return;
      }

      try {
        const run = await window.karpik.getLocalChatRunState(activeChatId);

        if (isSubscribed) {
          setActiveRun(run);
        }
      } catch {
        if (isSubscribed) {
          setActiveRun(null);
        }
      }
    }

    void loadRunState();

    return () => {
      isSubscribed = false;
    };
  }, [activeChatId]);

  useEffect(() => {
    if (!window.karpik?.subscribeLocalChatEvents) {
      return;
    }

    const unsubscribe = window.karpik.subscribeLocalChatEvents(({ chatId, detail }) => {
      setLocalChats((currentChats) => upsertChatSummary(currentChats, toSummary(detail)));
      if (chatId === activeChatId) {
        setActiveChat((currentChat) =>
          shouldReplaceChatDetail(currentChat, detail) ? detail : currentChat
        );
        setOptimisticMessages([]);
        setOptimisticRun(null);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [activeChatId]);

  useEffect(() => {
    if (!window.karpik?.subscribeLocalChatRunEvents) {
      return;
    }

    const unsubscribe = window.karpik.subscribeLocalChatRunEvents(({ chatId, run }) => {
      if (chatId === activeChatId) {
        setActiveRun(run);
        if (run !== null) {
          setOptimisticRun(null);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [activeChatId]);

  useEffect(() => {
    const viewport = messagesViewportRef.current;

    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [displayedMessages]);

  useEffect(() => {
    const input = composerInputRef.current;

    if (!input) {
      return;
    }

    input.style.height = "0px";
    input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
  }, [requestText]);

  function buildOptimisticMessages(chatId: string, text: string): {
    messages: LocalChatDetail["messages"];
    run: OptimisticRunState;
  } {
    const createdAt = new Date().toISOString();
    const replyMessageId = `optimistic-reply-${chatId}-${createdAt}`;

    return {
      messages: [
        {
          messageId: `optimistic-user-${chatId}-${createdAt}`,
          role: "user",
          text,
          createdAt
        },
        {
          messageId: replyMessageId,
          role: "assistant",
          text: "",
          createdAt
        }
      ],
      run: {
        runId: `optimistic-run-${chatId}-${createdAt}`,
        chatId,
        status: "thinking",
        cancelRequested: false,
        ackMessageId: null,
        replyMessageId
      }
    };
  }

  function handleSendLocalRequest() {
    if (!window.karpik?.sendLocalChatMessage || activeChatId === null) {
      setError("API локального выполнения недоступен в этом окружении.");
      return;
    }

    const normalizedRequest = requestText.trim();

    if (!normalizedRequest || isChatBusy) {
      return;
    }

    setError(null);
    setIsSending(true);

    const sentChatId = activeChatId;
    const optimistic = buildOptimisticMessages(sentChatId, normalizedRequest);
    setOptimisticMessages(optimistic.messages);
    setOptimisticRun(optimistic.run);
    setRequestText("");

    void window.karpik.sendLocalChatMessage({
        chatId: sentChatId,
        text: normalizedRequest
      })
      .then((nextDetail) => {

      if (nextDetail === null) {
        setOptimisticMessages([]);
        setOptimisticRun(null);
        setError("Локальный чат не найден.");
        return;
      }

      setLocalChats((currentChats) => upsertChatSummary(currentChats, toSummary(nextDetail)));
      setActiveChat(nextDetail);
      if (activeChatIdRef.current === sentChatId) {
        onSelectChat?.(nextDetail.chatId);
      }
      })
      .catch(() => {
      setOptimisticMessages([]);
      setOptimisticRun(null);
      setError("Не удалось выполнить локальный запрос.");
      })
      .finally(() => {
      setIsSending(false);
      });
  }

  async function handleCancelLocalRun() {
    if (!window.karpik?.cancelLocalChatRun || activeChatId === null) {
      return;
    }

    setError(null);
    await window.karpik.cancelLocalChatRun(activeChatId);
  }

  function handleSelectChat(chatId: string) {
    activeChatIdRef.current = chatId;
    setActiveChatId(chatId);
    onSelectChat?.(chatId);
  }

  return (
    <section className="reference-chat-page" data-testid="reference-chats">
      <aside className="reference-chat-page__sidebar-column">
        <div className="reference-chat-page__heading">
          <h2>{activeChatSummary?.title ?? "Локальный чат"}</h2>
          <p>{activeChatSummary ? buildChatSubtitle(activeChatSummary) : "Локальный диалог"}</p>
        </div>

        <div className="reference-chat-list">
          {isLoading ? <p className="muted-text">Загружаем локальные чаты...</p> : null}

          {!isLoading && localChats.length === 0 ? (
            <div className="reference-empty-state">
              <strong>Локальных чатов пока нет.</strong>
            </div>
          ) : null}

          {localChats.map((chat) => (
            <button
              className={`reference-chat-list__item${chat.chatId === activeChatId ? " active" : ""}`}
              key={chat.chatId}
              onClick={() => {
                handleSelectChat(chat.chatId);
              }}
              type="button"
            >
              <span className="reference-chat-list__title">{chat.title}</span>
            </button>
          ))}
        </div>
      </aside>

      <section className="reference-thread-shell">
        <div aria-hidden="true" className="reference-thread-shell__glow" />
        <div className="reference-thread-shell__messages" ref={messagesViewportRef} role="log">
          {isDetailLoading ? <p className="muted-text">Загружаем чат...</p> : null}

          {!isDetailLoading && activeChat === null ? (
            <div className="reference-empty-state">
              <strong>Выбери чат слева.</strong>
            </div>
          ) : null}

          {displayedMessages.map((message) => {
            const imageUrl = buildArtifactDataUrl(message);
            return (
              <div className={`reference-message reference-message--${message.role}`} key={message.messageId}>
                <div className="reference-message__bubble">
                  {isTypingMessage(message, effectiveRun) ? (
                    <div
                      className="reference-message__typing"
                      data-testid="local-chat-typing-indicator"
                    >
                      <span />
                      <span />
                      <span />
                    </div>
                  ) : (
                    <p>{message.text}</p>
                  )}
                  <span className="reference-message__time">{formatMessageTime(message.createdAt)}</span>
                </div>
                {imageUrl !== null ? (
                  <figure className="reference-message__artifact">
                    <img alt={message.artifactFileName ?? "artifact"} src={imageUrl} />
                  </figure>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="reference-thread-shell__composer">
          <button aria-label="Прикрепить" className="reference-thread-shell__attach" type="button">
            +
          </button>
          <textarea
            aria-label="Local request"
            className="reference-thread-shell__input"
            ref={composerInputRef}
            disabled={isChatBusy}
            onChange={(event) => setRequestText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !isChatBusy) {
                event.preventDefault();
                void handleSendLocalRequest();
              }
            }}
            placeholder="Сообщение..."
            rows={1}
            value={requestText}
          />
          <button
            aria-label={isChatBusy ? "Остановить ответ" : "Отправить"}
            className={`reference-thread-shell__submit${isSending || isChatBusy ? " is-busy" : ""}`}
            disabled={!isChatBusy && requestText.trim().length === 0}
            onClick={() => {
              if (isChatBusy) {
                void handleCancelLocalRun();
                return;
              }

              void handleSendLocalRequest();
            }}
            type="button"
          >
            {isChatBusy ? "■" : "↑"}
          </button>
        </div>

        {error !== null ? <p className="task-error">{error}</p> : null}
      </section>
    </section>
  );
}
