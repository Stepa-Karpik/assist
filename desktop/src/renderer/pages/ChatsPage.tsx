import { useEffect, useMemo, useState } from "react";

type LocalChatItem = Awaited<
  ReturnType<NonNullable<Window["karpik"]>["getLocalChats"]>
>[number];

type LocalChatDetail = NonNullable<
  Awaited<ReturnType<NonNullable<Window["karpik"]>["getLocalChatDetail"]>>
>;

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

function createEmptyDetail(chat: LocalChatItem): LocalChatDetail {
  return {
    ...chat,
    messages: []
  };
}

function buildChatSubtitle(chat: LocalChatItem): string {
  if (chat.referenceLabel) {
    return chat.referenceLabel;
  }

  if (chat.workspaceId) {
    return `Workspace: ${chat.workspaceId}`;
  }

  return chat.source === "local_continuation_chat" ? "Продолжение Telegram-диалога" : "Локальный диалог";
}

type ChatsPageProps = {
  selectedChatId?: string | null;
  onSelectChat?: (chatId: string | null) => void;
};

export function ChatsPage({ selectedChatId, onSelectChat }: ChatsPageProps) {
  const [localChats, setLocalChats] = useState<LocalChatItem[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(selectedChatId ?? null);
  const [activeChat, setActiveChat] = useState<LocalChatDetail | null>(null);
  const [requestText, setRequestText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeChatSummary = useMemo(
    () => localChats.find((chat) => chat.chatId === activeChatId) ?? null,
    [activeChatId, localChats]
  );

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

    setActiveChatId(selectedChatId);
  }, [selectedChatId]);

  useEffect(() => {
    if (activeChatId !== null && localChats.some((chat) => chat.chatId === activeChatId)) {
      return;
    }

    const nextChatId = localChats[0]?.chatId ?? null;
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
        setError("Local chat API недоступен в этом окружении.");
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

  async function handleCreateDesktopChat() {
    if (!window.karpik?.createDesktopChat) {
      setError("Local chat API недоступен в этом окружении.");
      return;
    }

    setError(null);

    try {
      const nextChat = await window.karpik.createDesktopChat({
        title: "Новый локальный чат"
      });
      setLocalChats((currentChats) => upsertChatSummary(currentChats, nextChat));
      setActiveChatId(nextChat.chatId);
      setActiveChat(createEmptyDetail(nextChat));
      onSelectChat?.(nextChat.chatId);
    } catch {
      setError("Не удалось создать локальный чат.");
    }
  }

  async function handleSendLocalRequest() {
    if (!window.karpik?.sendLocalChatMessage || activeChatId === null) {
      setError("API локального выполнения недоступен в этом окружении.");
      return;
    }

    const normalizedRequest = requestText.trim();

    if (!normalizedRequest) {
      return;
    }

    setError(null);
    setIsSending(true);

    try {
      const nextDetail = await window.karpik.sendLocalChatMessage({
        chatId: activeChatId,
        text: normalizedRequest
      });

      if (nextDetail === null) {
        setError("Локальный чат не найден.");
        return;
      }

      setActiveChat(nextDetail);
      setLocalChats((currentChats) => upsertChatSummary(currentChats, toSummary(nextDetail)));
      setRequestText("");
      onSelectChat?.(nextDetail.chatId);
    } catch {
      setError("Не удалось выполнить локальный запрос.");
    } finally {
      setIsSending(false);
    }
  }

  function handleSelectChat(chatId: string) {
    setActiveChatId(chatId);
    onSelectChat?.(chatId);
  }

  return (
    <div className="page-shell page-shell--full">
      <div className="page-header">
        <div>
          <p className="eyebrow">Чаты</p>
          <h2>Локальный операторский диалог</h2>
          <p className="muted-text">
            Сообщения пользователя справа, ответы ассистента слева. Telegram continuation-чаты живут здесь же.
          </p>
        </div>
        <button
          className="ghost-button ghost-button--primary ghost-button--wide"
          onClick={() => {
            void handleCreateDesktopChat();
          }}
          type="button"
        >
          Новый локальный чат
        </button>
      </div>

      {error !== null ? <p className="task-error">{error}</p> : null}

      <div className="messenger-layout">
        <aside className="chat-list-shell">
          {isLoading ? <p className="muted-text">Загружаем локальные чаты...</p> : null}

          {!isLoading && localChats.length === 0 ? (
            <div className="empty-panel">
              <strong>Локальных чатов пока нет.</strong>
              <p className="muted-text">Создай первый локальный чат и отправь обычное сообщение.</p>
            </div>
          ) : null}

          {localChats.map((chat) => (
            <button
              className={`chat-list-item${chat.chatId === activeChatId ? " active" : ""}`}
              key={chat.chatId}
              onClick={() => {
                handleSelectChat(chat.chatId);
              }}
              type="button"
            >
              <div className="chat-list-item__top">
                <strong>{chat.title}</strong>
                <span className="task-status">{chat.messageCount}</span>
              </div>
              <p className="chat-list-item__meta">{buildChatSubtitle(chat)}</p>
            </button>
          ))}
        </aside>

        <section className="chat-thread-shell">
          {isDetailLoading ? <p className="muted-text">Загружаем чат...</p> : null}

          {!isDetailLoading && activeChat === null ? (
            <div className="empty-panel">
              <strong>Выбери чат</strong>
              <p className="muted-text">Слева доступны локальные и continuation-чаты.</p>
            </div>
          ) : null}

          {activeChat !== null ? (
            <>
              <header className="chat-thread-header">
                <div>
                  <strong>{activeChat.title}</strong>
                  <p className="muted-text">
                    {activeChat.referenceLabel ?? buildChatSubtitle(activeChatSummary ?? activeChat)}
                  </p>
                </div>
                {activeChat.workspaceId ? <span className="workspace-pill">{activeChat.workspaceId}</span> : null}
              </header>

              <div className="chat-thread" aria-live="polite">
                {activeChat.messages.length === 0 ? (
                  <div className="empty-panel">
                    <strong>Диалог пуст</strong>
                    <p className="muted-text">
                      Напиши что-то вроде «привет», «скинь скриншот» или «обнови README».
                    </p>
                  </div>
                ) : null}

                {activeChat.messages.map((message) => {
                  const imageUrl = buildArtifactDataUrl(message);
                  return (
                    <div className={`chat-message-row chat-message-row--${message.role}`} key={message.messageId}>
                      <article className={`chat-bubble chat-bubble--${message.role}`}>
                        <div className="chat-bubble__meta">
                          <span>
                            {message.role === "user"
                              ? "Ты"
                              : message.role === "assistant"
                                ? "Ассистент"
                                : "System"}
                          </span>
                          <span>{formatMessageTime(message.createdAt)}</span>
                        </div>
                        <p>{message.text}</p>
                        {imageUrl !== null ? (
                          <figure className="chat-bubble__figure">
                            <img alt={message.artifactFileName ?? "artifact"} src={imageUrl} />
                            {message.artifactFileName ? <figcaption>{message.artifactFileName}</figcaption> : null}
                          </figure>
                        ) : null}
                      </article>
                    </div>
                  );
                })}
              </div>

              <div className="chat-composer">
                <label className="section-label" htmlFor="local-chat-request">
                  Новый запрос
                </label>
                <div className="chat-composer__row">
                  <input
                    aria-label="Local request"
                    className="quick-input"
                    id="local-chat-request"
                    onChange={(event) => setRequestText(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void handleSendLocalRequest();
                      }
                    }}
                    placeholder="Напиши обычным языком: например, «привет» или «скинь скриншот второго экрана»"
                    type="text"
                    value={requestText}
                  />
                  <button
                    className="ghost-button ghost-button--primary ghost-button--wide"
                    disabled={isSending || requestText.trim().length === 0}
                    onClick={() => {
                      void handleSendLocalRequest();
                    }}
                    type="button"
                  >
                    {isSending ? "Отправляем..." : "Отправить"}
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
}
