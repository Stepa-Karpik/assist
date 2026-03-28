import { useEffect, useMemo, useState } from "react";

import {
  buildTaskArtifactDataUrl,
  formatTaskStatus,
  loadTaskSnapshot,
  type TaskSnapshotItem
} from "./taskSnapshot";

type LocalApprovalItem = Awaited<ReturnType<NonNullable<Window["karpik"]>["getLocalApprovals"]>>[number];

type TaskFilter = "all" | "active" | "attention" | "completed";

const filterLabels: Record<TaskFilter, string> = {
  all: "Все",
  active: "Активные",
  attention: "Требуют внимания",
  completed: "Завершенные"
};

function isVisibleTask(task: TaskSnapshotItem): boolean {
  return !["succeeded"].includes(task.status);
}

function matchesFilter(task: TaskSnapshotItem, filter: TaskFilter): boolean {
  if (filter === "all") {
    return true;
  }

  if (filter === "active") {
    return ["queued", "running", "awaiting_auth", "awaiting_local_approval", "cancel_requested"].includes(task.status);
  }

  if (filter === "attention") {
    return ["failed", "blocked", "stalled", "awaiting_local_approval"].includes(task.status);
  }

  return ["done", "cancelled"].includes(task.status);
}

function canCancel(task: TaskSnapshotItem): boolean {
  return ["queued", "awaiting_auth", "awaiting_local_approval", "running", "stalled"].includes(task.status);
}

function canRetry(task: TaskSnapshotItem): boolean {
  return ["blocked", "failed", "cancelled"].includes(task.status);
}

function formatIntent(task: TaskSnapshotItem): string {
  if (task.intent.trim().length > 0) {
    return task.intent;
  }

  return "Задача";
}

export function BlockedTasksPage() {
  const [tasks, setTasks] = useState<TaskSnapshotItem[]>([]);
  const [localApprovals, setLocalApprovals] = useState<Record<string, LocalApprovalItem>>({});
  const [filter, setFilter] = useState<TaskFilter>("all");
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);

  const filteredTasks = useMemo(
    () => tasks.filter((task) => matchesFilter(task, filter)),
    [filter, tasks]
  );

  async function refreshBlockedTasks() {
    const [snapshot, approvals] = await Promise.all([
      loadTaskSnapshot(),
      window.karpik?.getLocalApprovals?.() ?? Promise.resolve([])
    ]);

    const visibleTasks = snapshot.filter(isVisibleTask);
    setTasks(visibleTasks);
    setLocalApprovals(Object.fromEntries(approvals.map((approval) => [approval.taskId, approval])));
    setExpandedTaskId((currentTaskId) =>
      currentTaskId && visibleTasks.some((task) => task.task_id === currentTaskId) ? currentTaskId : visibleTasks[0]?.task_id ?? null
    );
    setIsLoading(false);
  }

  useEffect(() => {
    let isSubscribed = true;

    async function refreshTasks() {
      const [snapshot, approvals] = await Promise.all([
        loadTaskSnapshot(),
        window.karpik?.getLocalApprovals?.() ?? Promise.resolve([])
      ]);

      if (!isSubscribed) {
        return;
      }

      const visibleTasks = snapshot.filter(isVisibleTask);
      setTasks(visibleTasks);
      setLocalApprovals(Object.fromEntries(approvals.map((approval) => [approval.taskId, approval])));
      setExpandedTaskId((currentTaskId) =>
        currentTaskId && visibleTasks.some((task) => task.task_id === currentTaskId) ? currentTaskId : visibleTasks[0]?.task_id ?? null
      );
      setIsLoading(false);
    }

    void refreshTasks();
    const intervalId = window.setInterval(() => {
      void refreshTasks();
    }, 2_000);

    return () => {
      isSubscribed = false;
      window.clearInterval(intervalId);
    };
  }, []);

  async function handleApprove(taskId: string) {
    if (!window.karpik?.approveLocalApproval) {
      setActionError("API локального подтверждения недоступен.");
      return;
    }

    setActionError(null);
    setBusyTaskId(taskId);

    try {
      await window.karpik.approveLocalApproval(taskId);
      await refreshBlockedTasks();
    } catch {
      setActionError("Не удалось подтвердить локальный preview.");
    } finally {
      setBusyTaskId(null);
    }
  }

  async function handleReject(taskId: string) {
    if (!window.karpik?.rejectLocalApproval) {
      setActionError("API локального подтверждения недоступен.");
      return;
    }

    setActionError(null);
    setBusyTaskId(taskId);

    try {
      await window.karpik.rejectLocalApproval(taskId);
      await refreshBlockedTasks();
    } catch {
      setActionError("Не удалось отклонить локальный preview.");
    } finally {
      setBusyTaskId(null);
    }
  }

  async function handleRetry(taskId: string) {
    if (!window.karpik?.retryTask) {
      setActionError("API повтора задачи недоступен.");
      return;
    }

    setActionError(null);
    setBusyTaskId(taskId);

    try {
      await window.karpik.retryTask(taskId);
      await refreshBlockedTasks();
    } catch {
      setActionError("Не удалось повторить задачу.");
    } finally {
      setBusyTaskId(null);
    }
  }

  async function handleCancel(taskId: string) {
    if (!window.karpik?.cancelTask) {
      setActionError("API остановки задачи недоступен.");
      return;
    }

    setActionError(null);
    setBusyTaskId(taskId);

    try {
      await window.karpik.cancelTask(taskId);
      await refreshBlockedTasks();
    } catch {
      setActionError("Не удалось остановить задачу.");
    } finally {
      setBusyTaskId(null);
    }
  }

  return (
    <section className="reference-tasks-page" data-testid="reference-tasks">
      <aside className="reference-task-filters">
        {(Object.keys(filterLabels) as TaskFilter[]).map((filterKey) => (
          <button
            className={`reference-task-filters__item${filter === filterKey ? " active" : ""}`}
            key={filterKey}
            onClick={() => setFilter(filterKey)}
            type="button"
          >
            {filterLabels[filterKey]}
          </button>
        ))}
      </aside>

      <section className="reference-task-list-shell">
        {isLoading ? <p className="muted-text">Загружаем очередь задач...</p> : null}
        {actionError !== null ? <p className="task-error">{actionError}</p> : null}

        {!isLoading && filteredTasks.length === 0 ? (
          <div className="reference-empty-state">
            <strong>Нет задач для выбранного фильтра.</strong>
          </div>
        ) : null}

        <div className="reference-task-list" role="list">
          {filteredTasks.map((task) => {
            const approval = localApprovals[task.task_id];
            const isExpanded = expandedTaskId === task.task_id;

            return (
              <article
                className={`reference-task-row${isExpanded ? " expanded" : ""}`}
                key={task.task_id}
                onClick={() => setExpandedTaskId((currentTaskId) => (currentTaskId === task.task_id ? null : task.task_id))}
                role="listitem"
              >
                <div className="reference-task-row__summary">
                  <div className="reference-task-row__meta">
                    <span className="reference-task-row__label">ID</span>
                    <strong>{task.task_id}</strong>
                    <span className="reference-task-row__label">Задача</span>
                    <span>{formatIntent(task)}</span>
                  </div>
                  <span className={`reference-task-row__status reference-task-row__status--${task.status}`}>
                    {formatTaskStatus(task.status)}
                  </span>
                </div>

                {isExpanded ? (
                  <div className="reference-task-row__details">
                    {task.result_text ? <p className="task-result">{task.result_text}</p> : null}
                    {task.error_text ? <p className="task-error">{task.error_text}</p> : null}

                    {approval ? (
                      <div className="reference-task-row__approval">
                        <p className="task-result">{approval.summaryText}</p>
                        <p className="muted-text">Файлы: {approval.changedFiles.join(", ")}</p>
                        <pre className="task-result task-result--pre">{approval.previewText}</pre>
                      </div>
                    ) : null}

                    {buildTaskArtifactDataUrl(task) !== null ? (
                      <figure className="task-artifact">
                        <img alt={task.artifactFileName ?? "task-artifact"} src={buildTaskArtifactDataUrl(task) ?? undefined} />
                      </figure>
                    ) : null}

                    <div className="reference-task-row__actions">
                      {task.status === "awaiting_local_approval" && approval ? (
                        <>
                          <button
                            className="reference-task-row__action reference-task-row__action--primary"
                            disabled={busyTaskId === task.task_id}
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleApprove(task.task_id);
                            }}
                            type="button"
                          >
                            Подтвердить
                          </button>
                          <button
                            className="reference-task-row__action"
                            disabled={busyTaskId === task.task_id}
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleReject(task.task_id);
                            }}
                            type="button"
                          >
                            Отклонить
                          </button>
                        </>
                      ) : null}

                      {canCancel(task) ? (
                        <button
                          className="reference-task-row__action reference-task-row__action--danger"
                          disabled={busyTaskId === task.task_id}
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleCancel(task.task_id);
                          }}
                          type="button"
                        >
                          Остановить
                        </button>
                      ) : null}

                      {canRetry(task) ? (
                        <button
                          className="reference-task-row__action"
                          disabled={busyTaskId === task.task_id}
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleRetry(task.task_id);
                          }}
                          type="button"
                        >
                          Повторить
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>
    </section>
  );
}
