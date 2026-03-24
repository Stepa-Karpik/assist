import { useEffect, useState } from "react";

type LocalChatItem = Awaited<
  ReturnType<NonNullable<Window["karpik"]>["getLocalChats"]>
>[number];

export function ChatsPage() {
  const [localChats, setLocalChats] = useState<LocalChatItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isSubscribed = true;

    async function loadLocalChats() {
      try {
        const chats = await (window.karpik?.getLocalChats?.() ?? Promise.resolve([]));

        if (!isSubscribed) {
          return;
        }

        setLocalChats(chats);
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
  }, []);

  async function handleCreateDesktopChat() {
    if (!window.karpik?.createDesktopChat) {
      setError("Local chat API недоступен в этом окружении.");
      return;
    }

    setError(null);

    try {
      const nextChat = await window.karpik.createDesktopChat();
      setLocalChats((currentChats) => [nextChat, ...currentChats]);
    } catch {
      setError("Не удалось создать локальный чат.");
    }
  }

  return (
    <div className="page-shell">
      <p className="eyebrow">Чаты</p>
      <h2>Local Desktop Chats</h2>
      <p className="muted-text">
        Здесь видны только локальные чаты, включая continuations, созданные из Telegram.
      </p>

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
      {error !== null ? <p className="task-error">{error}</p> : null}

      {!isLoading && localChats.length === 0 ? (
        <p className="muted-text">Локальных чатов пока нет.</p>
      ) : null}

      {localChats.length > 0 ? (
        <div className="task-list" aria-live="polite">
          {localChats.map((chat) => (
            <article className="task-card" key={chat.chatId}>
              <div className="task-card-header">
                <strong>{chat.title}</strong>
                <span className="task-status">{chat.source}</span>
              </div>
              {chat.referenceLabel ? <p className="task-result">{chat.referenceLabel}</p> : null}
              {chat.workspaceId ? <p className="muted-text">Workspace: {chat.workspaceId}</p> : null}
              <p className="muted-text">Messages: {chat.messageCount}</p>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}
