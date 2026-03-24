import { useEffect, useState } from "react";

import {
  formatTaskStatus,
  loadTaskSnapshot,
  type TaskSnapshotItem
} from "./taskSnapshot";

function isTelegramTask(task: TaskSnapshotItem): boolean {
  return task.chat_id !== null && task.chat_id !== undefined;
}

export function TelegramChatsPage() {
  const [tasks, setTasks] = useState<TaskSnapshotItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isSubscribed = true;

    async function refreshTasks() {
      const snapshot = await loadTaskSnapshot();

      if (!isSubscribed) {
        return;
      }

      setTasks(snapshot.filter(isTelegramTask));
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
      <p className="eyebrow">Чаты Telegram</p>
      <h2>Telegram Conversations</h2>
      <p className="muted-text">
        Здесь видны последние Telegram-задачи, их статусы и результат выполнения на ПК.
      </p>

      {isLoading ? (
        <p className="muted-text">Загружаем Telegram-задачи...</p>
      ) : null}

      {!isLoading && tasks.length === 0 ? (
        <p className="muted-text">Telegram-задач пока нет.</p>
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
