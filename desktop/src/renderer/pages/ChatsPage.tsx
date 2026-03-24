import { useEffect, useState } from "react";

type LocalChatItem = Awaited<
  ReturnType<NonNullable<Window["karpik"]>["getLocalChats"]>
>[number];

type LocalChatDetail = NonNullable<
  Awaited<ReturnType<NonNullable<Window["karpik"]>["getLocalChatDetail"]>>
>;

type ChatsPageProps = {
  selectedChatId?: string | null;
  onSelectChat?: (chatId: string | null) => void;
};

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

export function ChatsPage({ selectedChatId, onSelectChat }: ChatsPageProps) {
  const [localChats, setLocalChats] = useState<LocalChatItem[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(selectedChatId ?? null);
  const [activeChat, setActiveChat] = useState<LocalChatDetail | null>(null);
  const [requestText, setRequestText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        setActiveChatId((currentChatId) => {
          const preferredChatId =
            selectedChatId && sortedChats.some((chat) => chat.chatId === selectedChatId)
              ? selectedChatId
              : currentChatId && sortedChats.some((chat) => chat.chatId === currentChatId)
                ? currentChatId
                : sortedChats[0]?.chatId ?? null;

          onSelectChat?.(preferredChatId);
          return preferredChatId;
        });
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
  }, [onSelectChat, selectedChatId]);

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
        setError("Local chat detail API недоступен в этом окружении.");
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
      const nextChat = await window.karpik.createDesktopChat();
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
      setError("Local execution API недоступен в этом окружении.");
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
    <div className="page-shell">
      <p className="eyebrow">Чаты</p>
      <h2>Local Desktop Chats</h2>
      <p className="muted-text">
        Здесь видны только локальные чаты, включая continuations, созданные из Telegram.
      </p>

      {error !== null ? <p className="task-error">{error}</p> : null}

      <div className="local-chats-layout">
        <section className="local-chat-sidebar">
          <button
            className="ghost-button"
            onClick={() => {
              void handleCreateDesktopChat();
            }}
            type="button"
          >
            Новый локальный чат
          </button>

          {isLoading ? <p className="muted-text">Загружаем локальные чаты...</p> : null}

          {!isLoading && localChats.length === 0 ? (
            <p className="muted-text">Локальных чатов пока нет.</p>
          ) : null}

          {localChats.length > 0 ? (
            <div className="task-list" aria-live="polite">
              {localChats.map((chat) => (
                <button
                  className={`task-card local-chat-summary${
                    chat.chatId === activeChatId ? " active" : ""
                  }`}
                  key={chat.chatId}
                  onClick={() => {
                    handleSelectChat(chat.chatId);
                  }}
                  type="button"
                >
                  <div className="task-card-header">
                    <strong>{chat.title}</strong>
                    <span className="task-status">{chat.source}</span>
                  </div>
                  {chat.referenceLabel ? <p className="task-result">{chat.referenceLabel}</p> : null}
                  {chat.workspaceId ? <p className="muted-text">Workspace: {chat.workspaceId}</p> : null}
                  <p className="muted-text">Messages: {chat.messageCount}</p>
                </button>
              ))}
            </div>
          ) : null}
        </section>

        <section className="local-chat-detail">
          {isDetailLoading ? <p className="muted-text">Загружаем чат...</p> : null}

          {!isDetailLoading && activeChat === null ? (
            <p className="muted-text">Выбери локальный чат, чтобы продолжить работу.</p>
          ) : null}

          {activeChat !== null ? (
            <>
              <div className="task-card">
                <strong>{activeChat.title}</strong>
              </div>

              <div className="local-chat-messages" aria-live="polite">
                {activeChat.messages.length === 0 ? (
                  <p className="muted-text">Сообщений пока нет.</p>
                ) : null}

                {activeChat.messages.map((message) => (
                  <article
                    className={`task-card local-chat-message local-chat-message-${message.role}`}
                    key={message.messageId}
                  >
                    <div className="task-card-header">
                      <strong>{message.role}</strong>
                      <span className="task-status">{message.createdAt}</span>
                    </div>
                    <p>{message.text}</p>
                  </article>
                ))}
              </div>

              <div className="task-card local-chat-composer">
                <label className="section-label" htmlFor="local-chat-request">
                  Local request
                </label>
                <input
                  className="quick-input"
                  id="local-chat-request"
                  onChange={(event) => setRequestText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void handleSendLocalRequest();
                    }
                  }}
                  placeholder="status, read docs/note.txt, codex summarize the workspace"
                  type="text"
                  value={requestText}
                />
                <div className="local-chat-actions">
                  <button
                    className="ghost-button"
                    disabled={isSending || requestText.trim().length === 0}
                    onClick={() => {
                      void handleSendLocalRequest();
                    }}
                    type="button"
                  >
                    {isSending ? "Sending..." : "Send"}
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
