import { useEffect, useState } from "react";

import {
  formatTaskStatus,
  loadTaskSnapshot,
  type TaskSnapshotItem
} from "./taskSnapshot";

const blockedStatuses = new Set<TaskSnapshotItem["status"]>([
  "awaiting_auth",
  "awaiting_local_approval",
  "blocked",
  "failed"
]);

function requiresAttention(task: TaskSnapshotItem): boolean {
  return blockedStatuses.has(task.status);
}

export function BlockedTasksPage() {
  const [tasks, setTasks] = useState<TaskSnapshotItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isSubscribed = true;

    async function refreshTasks() {
      const snapshot = await loadTaskSnapshot();

      if (!isSubscribed) {
        return;
      }

      setTasks(snapshot.filter(requiresAttention));
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

  return (
    <div className="page-shell">
      <p className="eyebrow">Невыполненное</p>
      <h2>Blocked and Local-Approval Tasks</h2>
      <p className="muted-text">
        Здесь собраны задачи, которые остановились на auth, были заблокированы или завершились ошибкой.
      </p>

      {isLoading ? <p className="muted-text">Загружаем задачи, требующие внимания...</p> : null}

      {!isLoading && tasks.length === 0 ? (
        <p className="muted-text">Сейчас нет заблокированных или требующих внимания задач.</p>
      ) : null}

      {tasks.length > 0 ? (
        <div className="task-list" aria-live="polite">
          {tasks.map((task) => (
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
      ) : null}
    </div>
  );
}
