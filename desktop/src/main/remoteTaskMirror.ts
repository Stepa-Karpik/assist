import type { RemoteTaskRecord, RemoteTaskStatus } from "./syncClient";

const mirroredStatuses = new Set<RemoteTaskStatus>([
  "awaiting_auth",
  "awaiting_local_approval",
  "blocked",
  "done",
  "failed",
  "stalled"
]);

function buildTaskMirrorSignature(task: RemoteTaskRecord): string {
  return JSON.stringify([
    task.task_id,
    task.chat_id ?? null,
    task.status,
    task.intent,
    task.result_text ?? null,
    task.error_text ?? null,
    task.artifact_file_name ?? null,
    task.artifact_base64 ?? null
  ]);
}

export function mirrorRemoteTaskUpdates({
  previousSnapshot,
  nextSnapshot,
  mirrorTask
}: {
  previousSnapshot: RemoteTaskRecord[];
  nextSnapshot: RemoteTaskRecord[];
  mirrorTask: (task: RemoteTaskRecord) => void;
}): void {
  const previousByTaskId = new Map(
    previousSnapshot.map((task) => [task.task_id, buildTaskMirrorSignature(task)])
  );

  for (const task of nextSnapshot) {
    if (task.chat_id === null || task.chat_id === undefined) {
      continue;
    }

    if (!mirroredStatuses.has(task.status)) {
      continue;
    }

    const nextSignature = buildTaskMirrorSignature(task);

    if (previousByTaskId.get(task.task_id) === nextSignature) {
      continue;
    }

    mirrorTask(task);
  }
}
