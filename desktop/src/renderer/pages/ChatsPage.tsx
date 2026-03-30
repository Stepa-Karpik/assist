import { useEffect, useMemo, useState } from "react";

type LocalChatItem = Awaited<ReturnType<NonNullable<Window["karpik"]>["getLocalChats"]>>[number];

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
    return `workspace ${chat.workspaceId}`;
  }

  return chat.source === "local_continuation_chat" ? "Продолжение Telegram диалога" : "Локальный диалог";
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

  useEffect(() => {
    if (!window.karpik?.subscribeLocalChatEvents) {
      return;
    }

    const unsubscribe = window.karpik.subscribeLocalChatEvents(({ chatId, detail }) => {
      setLocalChats((currentChats) => upsertChatSummary(currentChats, toSummary(detail)));
      if (chatId === activeChatId) {
        setActiveChat(detail);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [activeChatId]);

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
    <section className="reference-chat-page" data-testid="reference-chats">
      <aside className="reference-chat-page__sidebar-column">
        <div className="reference-chat-page__heading">
          <h2>{activeChatSummary?.title ?? "Локальный чат"}</h2>
          <p>{activeChatSummary?.referenceLabel ?? "Локальный диалог"}</p>
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
        <div className="reference-thread-shell__messages" role="log">
          {isDetailLoading ? <p className="muted-text">Загружаем чат...</p> : null}

          {!isDetailLoading && activeChat === null ? (
            <div className="reference-empty-state">
              <strong>Выбери чат слева.</strong>
            </div>
          ) : null}

          {activeChat?.messages.map((message) => {
            const imageUrl = buildArtifactDataUrl(message);
            return (
              <div className={`reference-message reference-message--${message.role}`} key={message.messageId}>
                <div className="reference-message__bubble">
                  <p>{message.text}</p>
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
            ⌕
          </button>
          <input
            aria-label="Local request"
            className="reference-thread-shell__input"
            onChange={(event) => setRequestText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void handleSendLocalRequest();
              }
            }}
            placeholder="Сообщение..."
            type="text"
            value={requestText}
          />
          <button
            aria-label="Отправить"
            className="reference-thread-shell__submit"
            disabled={isSending || requestText.trim().length === 0}
            onClick={() => {
              void handleSendLocalRequest();
            }}
            type="button"
          >
            ↑
          </button>
        </div>

        {error !== null ? <p className="task-error">{error}</p> : null}
      </section>
    </section>
  );
}
