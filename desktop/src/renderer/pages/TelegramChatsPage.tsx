import { useEffect, useMemo, useState } from "react";

import {
  buildTaskArtifactDataUrl,
  formatTaskStatus,
  loadTaskSnapshot,
  type TaskSnapshotItem
} from "./taskSnapshot";

type CodexWorkspace = Awaited<ReturnType<NonNullable<Window["karpik"]>["getCodexConfigState"]>>["workspaces"][number];

type CodexConfigState = Awaited<ReturnType<NonNullable<Window["karpik"]>["getCodexConfigState"]>>;

const emptyCodexConfigState: CodexConfigState = {
  workspaces: [],
  defaultWorkspaceId: "",
  chatBindings: {}
};

function isTelegramTask(task: TaskSnapshotItem): task is TaskSnapshotItem & { chat_id: number } {
  return task.chat_id !== null && task.chat_id !== undefined;
}

function canCancelTask(task: TaskSnapshotItem): boolean {
  return ["queued", "awaiting_auth", "awaiting_local_approval", "running", "stalled"].includes(task.status);
}

function groupTasksByChat(tasks: TaskSnapshotItem[]): Array<{ chatId: number; tasks: TaskSnapshotItem[] }> {
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
      tasks: [...chatTasks].reverse()
    }));
}

function formatTaskTime(value: string): string {
  try {
    return new Date(value).toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return value;
  }
}

function getTaskTimestamp(task: TaskSnapshotItem): string {
  const rawTask = task as Record<string, unknown>;
  const candidate = [rawTask.updated_at, rawTask.created_at, rawTask.updatedAt, rawTask.createdAt].find(
    (value): value is string => typeof value === "string" && value.length > 0
  );

  return candidate ?? "";
}

type TelegramChatsPageProps = {
  onContinueToLocalChats?: (chatId: string) => void;
};

export function TelegramChatsPage({ onContinueToLocalChats }: TelegramChatsPageProps) {
  const [tasks, setTasks] = useState<TaskSnapshotItem[]>([]);
  const [codexConfigState, setCodexConfigState] = useState<CodexConfigState>(emptyCodexConfigState);
  const [selectedWorkspaceIds, setSelectedWorkspaceIds] = useState<Record<string, string>>({});
  const [selectedChatId, setSelectedChatId] = useState<number | null>(null);
  const [workspaceFeedbackByChat, setWorkspaceFeedbackByChat] = useState<Record<string, string>>({});
  const [continueFeedbackByChat, setContinueFeedbackByChat] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const chatGroups = useMemo(() => groupTasksByChat(tasks), [tasks]);
  const selectedGroup = chatGroups.find((group) => group.chatId === selectedChatId) ?? chatGroups[0] ?? null;

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
      const nextGroups = groupTasksByChat(telegramTasks);
      setTasks(telegramTasks);
      setCodexConfigState(nextCodexConfigState);
      setSelectedWorkspaceIds((currentSelectedWorkspaceIds) => {
        const nextSelectedWorkspaceIds = { ...currentSelectedWorkspaceIds };

        for (const group of nextGroups) {
          const chatKey = String(group.chatId);

          if (nextSelectedWorkspaceIds[chatKey] !== undefined) {
            continue;
          }

          nextSelectedWorkspaceIds[chatKey] =
            nextCodexConfigState.chatBindings[chatKey] ?? nextCodexConfigState.defaultWorkspaceId;
        }

        return nextSelectedWorkspaceIds;
      });
      setSelectedChatId((currentSelectedChatId) => {
        if (currentSelectedChatId !== null && nextGroups.some((group) => group.chatId === currentSelectedChatId)) {
          return currentSelectedChatId;
        }

        return nextGroups[0]?.chatId ?? null;
      });
      setError(null);
      setIsLoading(false);
    }

    void refreshPageState().catch(() => {
      if (isSubscribed) {
        setError("Не удалось загрузить Telegram задачи.");
        setIsLoading(false);
      }
    });

    const intervalId = window.setInterval(() => {
      void refreshPageState().catch(() => {
        if (isSubscribed) {
          setError("Не удалось обновить Telegram задачи.");
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
      setError("API привязки workspace недоступен в этом окружении.");
      return;
    }

    const workspaceId = selectedWorkspaceIds[String(chatId)] || codexConfigState.defaultWorkspaceId;

    setError(null);
    setBusyKey(`workspace:${chatId}`);
    setWorkspaceFeedbackByChat((current) => ({
      ...current,
      [String(chatId)]: ""
    }));

    try {
      const nextCodexConfigState = await window.karpik.saveChatWorkspaceBinding({
        chatId,
        workspaceId
      });
      setCodexConfigState(nextCodexConfigState);
      setSelectedWorkspaceIds((currentSelectedWorkspaceIds) => ({
        ...currentSelectedWorkspaceIds,
        [String(chatId)]:
          nextCodexConfigState.chatBindings[String(chatId)] ?? nextCodexConfigState.defaultWorkspaceId
      }));
      setWorkspaceFeedbackByChat((current) => ({
        ...current,
        [String(chatId)]: `Workspace для чата ${chatId} сохранён.`
      }));
    } catch {
      setError("Не удалось сохранить привязку чата к workspace.");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleContinueChat(chatId: number) {
    if (!window.karpik?.createLocalContinuationChat) {
      setError("API continuation чата недоступен в этом окружении.");
      return;
    }

    const workspaceId =
      selectedWorkspaceIds[String(chatId)] ||
      codexConfigState.chatBindings[String(chatId)] ||
      codexConfigState.defaultWorkspaceId;

    setError(null);
    setBusyKey(`continue:${chatId}`);
    setContinueFeedbackByChat((current) => ({
      ...current,
      [String(chatId)]: ""
    }));

    try {
      const nextChat = await window.karpik.createLocalContinuationChat({
        telegramChatId: chatId,
        title: `Telegram ${chatId}`,
        workspaceId
      });
      setContinueFeedbackByChat((current) => ({
        ...current,
        [String(chatId)]: `Продолжение открыто: ${nextChat.title}.`
      }));
      onContinueToLocalChats?.(nextChat.chatId);
    } catch {
      setError("Не удалось создать локальный continuation чат.");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleCancelTask(taskId: string) {
    if (!window.karpik?.cancelTask) {
      setError("API остановки задачи недоступен в этом окружении.");
      return;
    }

    setError(null);
    setBusyKey(`cancel:${taskId}`);

    try {
      await window.karpik.cancelTask(taskId);
    } catch {
      setError("Не удалось остановить Telegram задачу.");
    } finally {
      setBusyKey(null);
    }
  }

  function renderWorkspaceOptions(workspaces: CodexWorkspace[]) {
    return workspaces.map((workspace) => (
      <option key={workspace.id} value={workspace.id}>
        {workspace.name}
      </option>
    ));
  }

  return (
    <section className="reference-chat-page" data-testid="reference-telegram-chats">
      <aside className="reference-chat-page__sidebar-column">
        <div className="reference-chat-page__heading">
          <h2>{selectedGroup ? `Telegram чат ${selectedGroup.chatId}` : "Telegram чаты"}</h2>
          <p>{selectedGroup ? "Продолжен в локальном чате 12" : "Удаленные диалоги"}</p>
        </div>

        <div className="reference-chat-list">
          {isLoading ? <p className="muted-text">Загружаем Telegram чаты...</p> : null}

          {!isLoading && chatGroups.length === 0 ? (
            <div className="reference-empty-state">
              <strong>Telegram задач пока нет.</strong>
            </div>
          ) : null}

          {chatGroups.map((group) => (
            <button
              className={`reference-chat-list__item${group.chatId === selectedGroup?.chatId ? " active" : ""}`}
              key={group.chatId}
              onClick={() => {
                setSelectedChatId(group.chatId);
              }}
              type="button"
            >
              <span className="reference-chat-list__title">{`Telegram чат ${group.chatId}`}</span>
            </button>
          ))}
        </div>
      </aside>

      <section className="reference-thread-shell">
        <div aria-hidden="true" className="reference-thread-shell__glow" />
        {selectedGroup ? (
          <>
            <div className="reference-thread-shell__toolbar">
              <select
                aria-label={`Workspace for chat ${selectedGroup.chatId}`}
                className="reference-thread-shell__workspace"
                onChange={(event) =>
                  setSelectedWorkspaceIds((currentSelectedWorkspaceIds) => ({
                    ...currentSelectedWorkspaceIds,
                    [String(selectedGroup.chatId)]: event.target.value
                  }))
                }
                value={
                  selectedWorkspaceIds[String(selectedGroup.chatId)] ||
                  codexConfigState.chatBindings[String(selectedGroup.chatId)] ||
                  codexConfigState.defaultWorkspaceId
                }
              >
                {renderWorkspaceOptions(codexConfigState.workspaces)}
              </select>
              <button
                aria-label="Сохранить workspace"
                className="reference-thread-shell__mini-action"
                disabled={busyKey === `workspace:${selectedGroup.chatId}`}
                onClick={() => {
                  void handleSaveChatWorkspace(selectedGroup.chatId);
                }}
                type="button"
              >
                Сохранить
              </button>
              <button
                className="reference-thread-shell__mini-action reference-thread-shell__mini-action--primary"
                disabled={busyKey === `continue:${selectedGroup.chatId}`}
                onClick={() => {
                  void handleContinueChat(selectedGroup.chatId);
                }}
                type="button"
              >
                Продолжить чат
              </button>
            </div>

            {workspaceFeedbackByChat[String(selectedGroup.chatId)] ? (
              <p className="task-success">{workspaceFeedbackByChat[String(selectedGroup.chatId)]}</p>
            ) : null}
            {continueFeedbackByChat[String(selectedGroup.chatId)] ? (
              <p className="task-success">{continueFeedbackByChat[String(selectedGroup.chatId)]}</p>
            ) : null}

            <div className="reference-thread-shell__messages" role="log">
              {selectedGroup.tasks.map((task) => (
                <div className={`reference-message reference-message--${task.chat_id ? "assistant" : "user"}`} key={task.task_id}>
                  <div className="reference-message__bubble reference-message__bubble--wide">
                    <p className="reference-message__task-id">{task.task_id}</p>
                    <p>{task.intent}</p>
                    <span className="reference-message__time">{formatTaskTime(getTaskTimestamp(task))}</span>
                    <span className={`reference-message__status reference-message__status--${task.status}`}>
                      {formatTaskStatus(task.status)}
                    </span>
                    {task.result_text ? <p className="reference-message__result">{task.result_text}</p> : null}
                    {task.error_text ? <p className="task-error">{task.error_text}</p> : null}
                    {buildTaskArtifactDataUrl(task) !== null ? (
                      <figure className="reference-message__artifact">
                        <img
                          alt={task.artifactFileName ?? "remote-task-artifact"}
                          src={buildTaskArtifactDataUrl(task) ?? undefined}
                        />
                      </figure>
                    ) : null}
                  </div>
                  {canCancelTask(task) ? (
                    <button
                      className="reference-message__cancel"
                      disabled={busyKey === `cancel:${task.task_id}`}
                      onClick={() => {
                        void handleCancelTask(task.task_id);
                      }}
                      type="button"
                    >
                      Остановить
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="reference-empty-state">
            <strong>Выбери Telegram чат слева.</strong>
          </div>
        )}

        {error !== null ? <p className="task-error">{error}</p> : null}
      </section>
    </section>
  );
}
