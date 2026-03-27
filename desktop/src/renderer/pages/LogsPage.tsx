import { useEffect, useState } from "react";

type ActivityLogEntry = Awaited<
  ReturnType<NonNullable<Window["karpik"]>["getActivityLog"]>
>[number];

const statusLabels: Record<ActivityLogEntry["status"], string> = {
  info: "Info",
  success: "Success",
  warning: "Warning",
  error: "Error"
};

export function LogsPage() {
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isSubscribed = true;

    async function loadEntries() {
      try {
        const nextEntries = await (window.karpik?.getActivityLog?.() ?? Promise.resolve([]));

        if (!isSubscribed) {
          return;
        }

        setEntries(nextEntries);
      } catch {
        if (isSubscribed) {
          setError("Не удалось загрузить runtime activity.");
        }
      } finally {
        if (isSubscribed) {
          setIsLoading(false);
        }
      }
    }

    void loadEntries();
    const intervalId = window.setInterval(() => {
      void loadEntries();
    }, 2_000);

    return () => {
      isSubscribed = false;
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <div className="page-shell">
      <p className="eyebrow">Логи</p>
      <h2>Audit Trail and Human-Readable Summaries</h2>
      <p className="muted-text">
        Здесь видна локальная лента событий desktop runtime: quick requests, chat execution и remote task state changes.
      </p>

      {isLoading ? <p className="muted-text">Загружаем activity log...</p> : null}
      {error !== null ? <p className="task-error">{error}</p> : null}
      {!isLoading && entries.length === 0 ? (
        <p className="muted-text">Событий пока нет.</p>
      ) : null}

      {entries.length > 0 ? (
        <div className="task-list" aria-live="polite">
          {entries.map((entry) => (
            <article className={`task-card activity-log-card status-${entry.status}`} key={entry.entryId}>
              <div className="task-card-header">
                <strong>{entry.title}</strong>
                <span className="task-status">{statusLabels[entry.status]}</span>
              </div>
              <p className="muted-text">{entry.createdAt}</p>
              {entry.detail ? <p className="task-result">{entry.detail}</p> : null}
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}
