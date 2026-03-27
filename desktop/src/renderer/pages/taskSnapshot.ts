export type TaskSnapshot = Awaited<
  ReturnType<NonNullable<Window["karpik"]>["getTaskSnapshot"]>
>;
export type TaskSnapshotItem = TaskSnapshot[number];

export async function loadTaskSnapshot(): Promise<TaskSnapshot> {
  return window.karpik?.getTaskSnapshot?.() ?? [];
}

export function formatTaskStatus(status: TaskSnapshotItem["status"]): string {
  switch (status) {
    case "queued":
      return "В очереди";
    case "awaiting_auth":
      return "Ждёт авторизации";
    case "awaiting_local_approval":
      return "Ждёт локального подтверждения";
    case "cancel_requested":
      return "Останавливается";
    case "cancelled":
      return "Остановлена";
    case "blocked":
      return "Заблокирована";
    case "running":
      return "Выполняется";
    case "done":
      return "Готово";
    case "failed":
      return "Ошибка";
    case "stalled":
      return "Зависла";
    default:
      return status;
  }
}

export function buildTaskArtifactDataUrl(task: TaskSnapshotItem): string | null {
  if (task.artifactKind !== "image_base64" || !task.artifactMimeType || !task.artifactBase64) {
    return null;
  }

  return `data:${task.artifactMimeType};base64,${task.artifactBase64}`;
}
