import { useEffect, useMemo, useState } from "react";

import {
  buildTaskArtifactDataUrl,
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

type TelegramChatsPageProps = {
  onContinueToLocalChats?: (chatId: string) => void;
};

export function TelegramChatsPage({ onContinueToLocalChats }: TelegramChatsPageProps) {
  const [tasks, setTasks] = useState<TaskSnapshotItem[]>([]);
  const [codexConfigState, setCodexConfigState] = useState<CodexConfigState>(emptyCodexConfigState);
  const [selectedWorkspaceIds, setSelectedWorkspaceIds] = useState<Record<string, string>>({});
  const [workspaceFeedbackByChat, setWorkspaceFeedbackByChat] = useState<Record<string, string>>({});
  const [continueFeedbackByChat, setContinueFeedbackByChat] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

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
          const chatKey = String(task.chat_id);

          if (nextSelectedWorkspaceIds[chatKey] !== undefined) {
            continue;
          }

          nextSelectedWorkspaceIds[chatKey] =
            nextCodexConfigState.chatBindings[chatKey] ?? nextCodexConfigState.defaultWorkspaceId;
        }

        return nextSelectedWorkspaceIds;
      });
      setError(null);
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
        [String(chatId)]: `Привязка workspace для чата ${chatId} сохранена.`
      }));
    } catch {
      setError("Не удалось сохранить привязку чата к workspace.");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleContinueChat(chatId: number) {
    if (!window.karpik?.createLocalContinuationChat) {
      setError("API continuation-чата недоступен в этом окружении.");
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
        [String(chatId)]: `Continuation-чат готов: ${nextChat.title}.`
      }));
      onContinueToLocalChats?.(nextChat.chatId);
    } catch {
      setError("Не удалось создать локальный continuation-чат.");
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
      setError("Не удалось остановить Telegram-задачу.");
    } finally {
      setBusyKey(null);
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
    <div className="page-shell page-shell--full">
      <div className="page-header">
        <div>
          <p className="eyebrow">Чаты Telegram</p>
          <h2>Удалённые очереди и routing по workspace</h2>
          <p className="muted-text">
            Здесь видны последние Telegram-задачи, их статусы и привязка чатов к workspace.
          </p>
        </div>
      </div>

      {isLoading ? <p className="muted-text">Загружаем Telegram-задачи...</p> : null}
      {error !== null ? <p className="task-error">{error}</p> : null}

      {!isLoading && chatGroups.length === 0 ? (
        <div className="empty-panel">
          <strong>Пусто</strong>
          <p className="muted-text">Telegram-задач пока нет.</p>
        </div>
      ) : null}

      {chatGroups.length > 0 ? (
        <div className="task-list" aria-live="polite">
          {chatGroups.map((chatGroup) => {
            const chatKey = String(chatGroup.chatId);
            const workspaceFeedback = workspaceFeedbackByChat[chatKey] || null;
            const continueFeedback = continueFeedbackByChat[chatKey] || null;

            return (
              <article className="task-card task-card--chat" key={chatGroup.chatId}>
                <div className="task-card-header">
                  <div>
                    <strong>Chat {chatGroup.chatId}</strong>
                    <p className="muted-text">Задач в истории: {chatGroup.tasks.length}</p>
                  </div>
                  <span className="task-status">Telegram</span>
                </div>

                <div className="chat-workspace-bar">
                  <label className="section-label" htmlFor={`telegram-chat-workspace-${chatGroup.chatId}`}>
                    Workspace для чата {chatGroup.chatId}
                  </label>
                  <div className="chat-workspace-bar__controls">
                    <select
                      aria-label={`Workspace for chat ${chatGroup.chatId}`}
                      className="quick-input"
                      id={`telegram-chat-workspace-${chatGroup.chatId}`}
                      onChange={(event) =>
                        setSelectedWorkspaceIds((currentSelectedWorkspaceIds) => ({
                          ...currentSelectedWorkspaceIds,
                          [chatKey]: event.target.value
                        }))
                      }
                      value={
                        selectedWorkspaceIds[chatKey] ||
                        codexConfigState.chatBindings[chatKey] ||
                        codexConfigState.defaultWorkspaceId
                      }
                    >
                      {renderWorkspaceOptions(codexConfigState.workspaces)}
                    </select>
                    <button
                      className="ghost-button"
                      disabled={busyKey === `workspace:${chatGroup.chatId}`}
                      onClick={() => {
                        void handleSaveChatWorkspace(chatGroup.chatId);
                      }}
                      type="button"
                    >
                      {busyKey === `workspace:${chatGroup.chatId}` ? "Сохраняем..." : "Сохранить workspace"}
                    </button>
                    <button
                      className="ghost-button ghost-button--primary"
                      disabled={busyKey === `continue:${chatGroup.chatId}`}
                      onClick={() => {
                        void handleContinueChat(chatGroup.chatId);
                      }}
                      type="button"
                    >
                      {busyKey === `continue:${chatGroup.chatId}` ? "Открываем..." : "Продолжить чат"}
                    </button>
                  </div>
                  {workspaceFeedback !== null ? <p className="task-success status-feedback">{workspaceFeedback}</p> : null}
                  {continueFeedback !== null ? <p className="task-success status-feedback">{continueFeedback}</p> : null}
                </div>

                <div className="task-list task-list--compact">
                  {chatGroup.tasks.map((task) => (
                    <article className="task-card task-card--task" key={task.task_id}>
                      <div className="task-card-header">
                        <strong>{task.task_id}</strong>
                        <span className="task-status">{formatTaskStatus(task.status)}</span>
                      </div>
                      <p className="task-title">{task.intent}</p>
                      {task.result_text ? <p className="task-result">{task.result_text}</p> : null}
                      {task.error_text ? <p className="task-error">{task.error_text}</p> : null}
                      {buildTaskArtifactDataUrl(task) !== null ? (
                        <figure className="task-artifact">
                          <img
                            alt={task.artifactFileName ?? "remote-task-artifact"}
                            src={buildTaskArtifactDataUrl(task) ?? undefined}
                          />
                          {task.artifactFileName ? <figcaption>{task.artifactFileName}</figcaption> : null}
                        </figure>
                      ) : null}
                      {canCancelTask(task) ? (
                        <div className="action-row">
                          <button
                            className="ghost-button ghost-button--danger"
                            disabled={busyKey === `cancel:${task.task_id}`}
                            onClick={() => {
                              void handleCancelTask(task.task_id);
                            }}
                            type="button"
                          >
                            {busyKey === `cancel:${task.task_id}` ? "Останавливаем..." : "Остановить"}
                          </button>
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
