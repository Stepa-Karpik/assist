import type { RemoteTaskRecord, TaskListResponse } from "./syncClient";
import type { TaskExecutionResult } from "./taskExecutor";

type TaskSyncClient = {
  fetchTaskHistory: () => Promise<Response>;
  fetchQueuedTasks: () => Promise<Response>;
  startTask: (taskId: string) => Promise<Response>;
  completeTask: (taskId: string, resultText: string) => Promise<Response>;
  failTask: (taskId: string, errorText: string) => Promise<Response>;
};

type ExecuteTask = (task: RemoteTaskRecord) => Promise<TaskExecutionResult>;

type TaskRuntimeOptions = {
  client: TaskSyncClient;
  executeTask: ExecuteTask;
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
  executeTask
}: TaskRuntimeOptions): Promise<RemoteTaskRecord[]> {
  const initialSnapshot = await readTaskList(await client.fetchTaskHistory());
  const queuedTasks = await readTaskList(await client.fetchQueuedTasks());

  for (const task of queuedTasks) {
    const startResponse = await client.startTask(task.task_id);

    if (!startResponse.ok) {
      continue;
    }

    const executionResult = await executeTask(task);

    if (executionResult.ok) {
      await client.completeTask(task.task_id, executionResult.resultText);
      continue;
    }

    await client.failTask(task.task_id, executionResult.errorText);
  }

  if (queuedTasks.length === 0) {
    return initialSnapshot;
  }

  return readTaskList(await client.fetchTaskHistory());
}
