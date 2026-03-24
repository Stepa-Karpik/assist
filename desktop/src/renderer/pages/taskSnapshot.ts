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
      return "Ждёт auth";
    case "awaiting_local_approval":
      return "Ждёт локального подтверждения";
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
