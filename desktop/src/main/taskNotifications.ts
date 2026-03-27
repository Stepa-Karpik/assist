import type { RemoteTaskRecord } from "./syncClient";

export type TaskNotification = {
  title: string;
  body: string;
};

function buildNotificationBody(task: Pick<RemoteTaskRecord, "intent" | "result_text" | "error_text">, fallback: string) {
  const detail = task.result_text ?? task.error_text ?? fallback;
  return `${task.intent}\n${detail}`;
}

export function buildTaskNotification(
  task: Pick<RemoteTaskRecord, "task_id" | "intent" | "status" | "result_text" | "error_text">
): TaskNotification | null {
  switch (task.status) {
    case "awaiting_local_approval":
      return {
        title: "Local approval required",
        body: buildNotificationBody(task, "Open Karpik to review the task.")
      };
    case "done":
      return {
        title: "Task completed",
        body: buildNotificationBody(task, "Done.")
      };
    case "failed":
      return {
        title: "Task failed",
        body: buildNotificationBody(task, "No details.")
      };
    case "blocked":
      return {
        title: "Task blocked",
        body: buildNotificationBody(task, "Blocked.")
      };
    default:
      return null;
  }
}
