import type { RemoteTaskRecord, TaskListResponse } from "./syncClient";
import type { CodexWritePreviewDraft } from "./codexWritePreview";
import type { TaskExecutionResult } from "./taskExecutor";
import type { TaskResultArtifact } from "./syncClient";

type TaskSyncClient = {
  fetchTaskHistory: () => Promise<Response>;
  fetchQueuedTasks: () => Promise<Response>;
  startTask: (taskId: string) => Promise<Response>;
  awaitLocalApproval: (taskId: string, resultText: string) => Promise<Response>;
  blockTask: (taskId: string, errorText: string) => Promise<Response>;
  completeTask: (
    taskId: string,
    payload: { resultText: string; artifact?: TaskResultArtifact }
  ) => Promise<Response>;
  failTask: (taskId: string, errorText: string) => Promise<Response>;
};

type ExecuteTask = (task: RemoteTaskRecord) => Promise<TaskExecutionResult>;

type TaskRuntimeOptions = {
  client: TaskSyncClient;
  executeTask: ExecuteTask;
  persistLocalApproval?: (
    task: RemoteTaskRecord,
    draft: CodexWritePreviewDraft
  ) => Promise<void>;
  discardLocalApproval?: (draft: CodexWritePreviewDraft) => Promise<void>;
};

async function readTaskList(response: Response): Promise<RemoteTaskRecord[]> {
  if (!response.ok) {
    throw new Error(`Task sync request failed: ${response.status}`);
  }

  const payload = (await response.json()) as TaskListResponse;
  return payload.items;
}

export async function runTaskSyncCycle({
  client,
  executeTask,
  persistLocalApproval,
  discardLocalApproval
}: TaskRuntimeOptions): Promise<RemoteTaskRecord[]> {
  const initialSnapshot = await readTaskList(await client.fetchTaskHistory());
  const queuedTasks = await readTaskList(await client.fetchQueuedTasks());

  for (const task of queuedTasks) {
    const startResponse = await client.startTask(task.task_id);

    if (!startResponse.ok) {
      continue;
    }

    const executionResult = await executeTask(task);

    if (executionResult.ok && executionResult.requiresLocalApproval) {
      const approvalResponse = await client.awaitLocalApproval(
        task.task_id,
        executionResult.waitingText
      );

      if (!approvalResponse.ok) {
        if (discardLocalApproval !== undefined) {
          await discardLocalApproval(executionResult.draft);
        }
        await client.failTask(task.task_id, "Failed to publish local approval state.");
        continue;
      }

      if (persistLocalApproval !== undefined) {
        try {
          await persistLocalApproval(task, executionResult.draft);
        } catch {
          if (discardLocalApproval !== undefined) {
            await discardLocalApproval(executionResult.draft);
          }
          await client.blockTask(task.task_id, "Failed to persist local approval preview.");
        }
      }
      continue;
    }

    if (executionResult.ok) {
      await client.completeTask(task.task_id, {
        resultText: executionResult.resultText,
        artifact: executionResult.artifact
      });
      continue;
    }

    await client.failTask(task.task_id, executionResult.errorText);
  }

  if (queuedTasks.length === 0) {
    return initialSnapshot;
  }

  return readTaskList(await client.fetchTaskHistory());
}
