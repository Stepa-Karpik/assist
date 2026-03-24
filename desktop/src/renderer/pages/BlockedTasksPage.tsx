import { useEffect, useState } from "react";

import {
  formatTaskStatus,
  loadTaskSnapshot,
  type TaskSnapshotItem
} from "./taskSnapshot";

type LocalApprovalItem = Awaited<
  ReturnType<NonNullable<Window["karpik"]>["getLocalApprovals"]>
>[number];

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
  const [localApprovals, setLocalApprovals] = useState<Record<string, LocalApprovalItem>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);

  async function refreshBlockedTasks() {
    const [snapshot, approvals] = await Promise.all([
      loadTaskSnapshot(),
      window.karpik?.getLocalApprovals?.() ?? Promise.resolve([])
    ]);

    setTasks(snapshot.filter(requiresAttention));
    setLocalApprovals(
      Object.fromEntries(approvals.map((approval) => [approval.taskId, approval]))
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

      setTasks(snapshot.filter(requiresAttention));
      setLocalApprovals(
        Object.fromEntries(approvals.map((approval) => [approval.taskId, approval]))
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
      setActionError("Local approval API is unavailable.");
      return;
    }

    setActionError(null);
    setBusyTaskId(taskId);

    try {
      await window.karpik.approveLocalApproval(taskId);
      await refreshBlockedTasks();
    } catch {
      setActionError("Failed to approve the local preview.");
    } finally {
      setBusyTaskId(null);
    }
  }

  async function handleReject(taskId: string) {
    if (!window.karpik?.rejectLocalApproval) {
      setActionError("Local approval API is unavailable.");
      return;
    }

    setActionError(null);
    setBusyTaskId(taskId);

    try {
      await window.karpik.rejectLocalApproval(taskId);
      await refreshBlockedTasks();
    } catch {
      setActionError("Failed to reject the local preview.");
    } finally {
      setBusyTaskId(null);
    }
  }

  async function handleRetry(taskId: string) {
    if (!window.karpik?.retryTask) {
      setActionError("Task retry API is unavailable.");
      return;
    }

    setActionError(null);
    setBusyTaskId(taskId);

    try {
      await window.karpik.retryTask(taskId);
      await refreshBlockedTasks();
    } catch {
      setActionError("Failed to retry the task.");
    } finally {
      setBusyTaskId(null);
    }
  }

  return (
    <div className="page-shell">
      <p className="eyebrow">РќРµРІС‹РїРѕР»РЅРµРЅРЅРѕРµ</p>
      <h2>Blocked and Local-Approval Tasks</h2>
      <p className="muted-text">
        Р—РґРµСЃСЊ СЃРѕР±СЂР°РЅС‹ Р·Р°РґР°С‡Рё, РєРѕС‚РѕСЂС‹Рµ РѕСЃС‚Р°РЅРѕРІРёР»РёСЃСЊ РЅР° auth, Р±С‹Р»Рё Р·Р°Р±Р»РѕРєРёСЂРѕРІР°РЅС‹ РёР»Рё Р·Р°РІРµСЂС€РёР»РёСЃСЊ РѕС€РёР±РєРѕР№.
      </p>

      {isLoading ? <p className="muted-text">Р—Р°РіСЂСѓР¶Р°РµРј Р·Р°РґР°С‡Рё, С‚СЂРµР±СѓСЋС‰РёРµ РІРЅРёРјР°РЅРёСЏ...</p> : null}

      {!isLoading && tasks.length === 0 ? (
        <p className="muted-text">РЎРµР№С‡Р°СЃ РЅРµС‚ Р·Р°Р±Р»РѕРєРёСЂРѕРІР°РЅРЅС‹С… РёР»Рё С‚СЂРµР±СѓСЋС‰РёС… РІРЅРёРјР°РЅРёСЏ Р·Р°РґР°С‡.</p>
      ) : null}

      {actionError !== null ? <p className="task-error">{actionError}</p> : null}

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
              {task.status === "awaiting_local_approval" &&
              localApprovals[task.task_id] !== undefined ? (
                <>
                  <p className="task-result">{localApprovals[task.task_id].summaryText}</p>
                  <p className="muted-text">
                    Files: {localApprovals[task.task_id].changedFiles.join(", ")}
                  </p>
                  <pre className="task-result">{localApprovals[task.task_id].previewText}</pre>
                  <div className="task-card-header">
                    <button
                      className="ghost-button"
                      disabled={busyTaskId === task.task_id}
                      onClick={() => {
                        void handleApprove(task.task_id);
                      }}
                      type="button"
                    >
                      Approve
                    </button>
                    <button
                      className="ghost-button"
                      disabled={busyTaskId === task.task_id}
                      onClick={() => {
                        void handleReject(task.task_id);
                      }}
                      type="button"
                    >
                      Reject
                    </button>
                  </div>
                </>
              ) : null}
              {task.status !== "awaiting_auth" && task.status !== "awaiting_local_approval" ? (
                <div className="task-card-header">
                  <button
                    className="ghost-button"
                    disabled={busyTaskId === task.task_id}
                    onClick={() => {
                      void handleRetry(task.task_id);
                    }}
                    type="button"
                  >
                    Retry
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}
