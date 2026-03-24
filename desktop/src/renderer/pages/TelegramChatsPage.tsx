import { useEffect, useMemo, useState } from "react";

import {
  formatTaskStatus,
  loadTaskSnapshot,
  type TaskSnapshotItem
} from "./taskSnapshot";

type CodexWorkspace = Awaited<
  ReturnType<NonNullable<Window["karpik"]>["getCodexConfigState"]>
>["workspaces"][number];

type CodexConfigState = Awaited<
  ReturnType<NonNullable<Window["karpik"]>["getCodexConfigState"]>
>;

const emptyCodexConfigState: CodexConfigState = {
  workspaces: [],
  defaultWorkspaceId: "",
  chatBindings: {}
};

function isTelegramTask(
  task: TaskSnapshotItem
): task is TaskSnapshotItem & { chat_id: number } {
  return task.chat_id !== null && task.chat_id !== undefined;
}

function groupTasksByChat(tasks: TaskSnapshotItem[]): Array<{
  chatId: number;
  tasks: TaskSnapshotItem[];
}> {
  const grouped = new Map<number, TaskSnapshotItem[]>();

  for (const task of tasks) {
    if (!isTelegramTask(task)) {
      continue;
    }

    const chatTasks = grouped.get(task.chat_id) ?? [];
    chatTasks.push(task);
    grouped.set(task.chat_id, chatTasks);
  }

  return Array.from(grouped.entries())
    .sort((left, right) => right[0] - left[0])
    .map(([chatId, chatTasks]) => ({
      chatId,
      tasks: chatTasks
    }));
}

type TelegramChatsPageProps = {
  onContinueToLocalChats?: (chatId: string) => void;
};

export function TelegramChatsPage({ onContinueToLocalChats }: TelegramChatsPageProps) {
  const [tasks, setTasks] = useState<TaskSnapshotItem[]>([]);
  const [codexConfigState, setCodexConfigState] =
    useState<CodexConfigState>(emptyCodexConfigState);
  const [selectedWorkspaceIds, setSelectedWorkspaceIds] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyChatId, setBusyChatId] = useState<number | null>(null);

  const chatGroups = useMemo(() => groupTasksByChat(tasks), [tasks]);

  useEffect(() => {
    let isSubscribed = true;

    async function refreshPageState() {
      const [snapshot, nextCodexConfigState] = await Promise.all([
        loadTaskSnapshot(),
        window.karpik?.getCodexConfigState?.() ?? Promise.resolve(emptyCodexConfigState)
      ]);

      if (!isSubscribed) {
        return;
      }

      const telegramTasks = snapshot.filter(isTelegramTask);
      setTasks(telegramTasks);
      setCodexConfigState(nextCodexConfigState);
      setSelectedWorkspaceIds((currentSelectedWorkspaceIds) => {
        const nextSelectedWorkspaceIds = { ...currentSelectedWorkspaceIds };

        for (const task of telegramTasks) {
          const chatId = task.chat_id;
          const chatKey = String(chatId);

          if (nextSelectedWorkspaceIds[chatKey] !== undefined) {
            continue;
          }

          nextSelectedWorkspaceIds[chatKey] =
            nextCodexConfigState.chatBindings[chatKey] ??
            nextCodexConfigState.defaultWorkspaceId;
        }

        return nextSelectedWorkspaceIds;
      });
      setIsLoading(false);
    }

    void refreshPageState().catch(() => {
      if (isSubscribed) {
        setError("Не удалось загрузить Telegram-задачи.");
        setIsLoading(false);
      }
    });

    const intervalId = window.setInterval(() => {
      void refreshPageState().catch(() => {
        if (isSubscribed) {
          setError("Не удалось обновить Telegram-задачи.");
        }
      });
    }, 2_000);

    return () => {
      isSubscribed = false;
      window.clearInterval(intervalId);
    };
  }, []);

  async function handleSaveChatWorkspace(chatId: number) {
    if (!window.karpik?.saveChatWorkspaceBinding) {
      setError("Chat workspace API недоступен в этом окружении.");
      return;
    }

    const workspaceId =
      selectedWorkspaceIds[String(chatId)] || codexConfigState.defaultWorkspaceId;

    setError(null);
    setBusyChatId(chatId);

    try {
      const nextCodexConfigState = await window.karpik.saveChatWorkspaceBinding({
        chatId,
        workspaceId
      });
      setCodexConfigState(nextCodexConfigState);
      setSelectedWorkspaceIds((currentSelectedWorkspaceIds) => ({
        ...currentSelectedWorkspaceIds,
        [String(chatId)]:
          nextCodexConfigState.chatBindings[String(chatId)] ??
          nextCodexConfigState.defaultWorkspaceId
      }));
    } catch {
      setError("Не удалось сохранить привязку чата к workspace.");
    } finally {
      setBusyChatId(null);
    }
  }

  async function handleContinueChat(chatId: number) {
    if (!window.karpik?.createLocalContinuationChat) {
      setError("Local continuation API недоступен в этом окружении.");
      return;
    }

    const workspaceId =
      selectedWorkspaceIds[String(chatId)] ||
      codexConfigState.chatBindings[String(chatId)] ||
      codexConfigState.defaultWorkspaceId;

    setError(null);
    setBusyChatId(chatId);

    try {
      const nextChat = await window.karpik.createLocalContinuationChat({
        telegramChatId: chatId,
        title: `Telegram ${chatId}`,
        workspaceId
      });
      onContinueToLocalChats?.(nextChat.chatId);
    } catch {
      setError("Не удалось создать локальный continuation chat.");
    } finally {
      setBusyChatId(null);
    }
  }

  function renderWorkspaceOptions(workspaces: CodexWorkspace[]) {
    return workspaces.map((workspace) => (
      <option key={workspace.id} value={workspace.id}>
        {workspace.name} ({workspace.id})
      </option>
    ));
  }

  return (
    <div className="page-shell">
      <p className="eyebrow">Чаты Telegram</p>
      <h2>Telegram Conversations</h2>
      <p className="muted-text">
        Здесь видны последние Telegram-задачи, их статусы и локальная привязка чатов к
        workspace.
      </p>

      {isLoading ? <p className="muted-text">Загружаем Telegram-задачи...</p> : null}
      {error !== null ? <p className="task-error">{error}</p> : null}

      {!isLoading && chatGroups.length === 0 ? (
        <p className="muted-text">Telegram-задач пока нет.</p>
      ) : null}

      {chatGroups.length > 0 ? (
        <div className="task-list" aria-live="polite">
          {chatGroups.map((chatGroup) => (
            <article className="task-card" key={chatGroup.chatId}>
              <div className="task-card-header">
                <strong>Chat {chatGroup.chatId}</strong>
                <span className="task-status">
                  {chatGroup.tasks.length} task{chatGroup.tasks.length === 1 ? "" : "s"}
                </span>
              </div>

              <label
                className="section-label"
                htmlFor={`telegram-chat-workspace-${chatGroup.chatId}`}
              >
                Workspace for chat {chatGroup.chatId}
              </label>
              <select
                className="quick-input"
                id={`telegram-chat-workspace-${chatGroup.chatId}`}
                onChange={(event) =>
                  setSelectedWorkspaceIds((currentSelectedWorkspaceIds) => ({
                    ...currentSelectedWorkspaceIds,
                    [String(chatGroup.chatId)]: event.target.value
                  }))
                }
                value={
                  selectedWorkspaceIds[String(chatGroup.chatId)] ||
                  codexConfigState.chatBindings[String(chatGroup.chatId)] ||
                  codexConfigState.defaultWorkspaceId
                }
              >
                {renderWorkspaceOptions(codexConfigState.workspaces)}
              </select>
              <div className="task-card-header">
                <button
                  className="ghost-button"
                  disabled={busyChatId === chatGroup.chatId}
                  onClick={() => {
                    void handleSaveChatWorkspace(chatGroup.chatId);
                  }}
                  type="button"
                >
                  {busyChatId === chatGroup.chatId
                    ? "Saving..."
                    : "Save chat workspace"}
                </button>
                <button
                  className="ghost-button"
                  disabled={busyChatId === chatGroup.chatId}
                  onClick={() => {
                    void handleContinueChat(chatGroup.chatId);
                  }}
                  type="button"
                >
                  Продолжить чат
                </button>
              </div>

              <div className="task-list">
                {chatGroup.tasks.map((task) => (
                  <article className="task-card" key={task.task_id}>
                    <div className="task-card-header">
                      <strong>{task.task_id}</strong>
                      <span className="task-status">{formatTaskStatus(task.status)}</span>
                    </div>
                    <p>{task.intent}</p>
                    {task.result_text ? <p className="task-result">{task.result_text}</p> : null}
                    {task.error_text ? <p className="task-error">{task.error_text}</p> : null}
                  </article>
                ))}
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}
