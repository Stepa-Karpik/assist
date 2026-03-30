import type { RemoteTaskRecord, TaskListResponse } from "./syncClient";
import type { CodexWritePreviewDraft } from "./codexWritePreview";
import type { TaskExecutionResult } from "./taskExecutor";
import type { TaskResultArtifact } from "./syncClient";

type TaskSyncClient = {
  fetchTaskSnapshot: () => Promise<Response>;
  fetchQueuedTasks: () => Promise<Response>;
  startTask: (taskId: string) => Promise<Response>;
  awaitLocalApproval: (taskId: string, resultText: string) => Promise<Response>;
  blockTask: (taskId: string, errorText: string) => Promise<Response>;
  cancelTask?: (taskId: string, errorText: string) => Promise<Response>;
  completeTask: (
    taskId: string,
    payload: { resultText: string; artifact?: TaskResultArtifact }
  ) => Promise<Response>;
  failTask: (taskId: string, errorText: string) => Promise<Response>;
};

export type TaskExecutionHandle = {
  kind: "immediate" | "deferred";
  result: Promise<TaskExecutionResult>;
  cancel?: () => Promise<void> | void;
};

type StartTaskExecution = (task: RemoteTaskRecord) => TaskExecutionHandle;

type ActiveTaskExecution = {
  cancel?: () => Promise<void> | void;
  cancelRequested: boolean;
  completion: Promise<void>;
};

export type TaskRuntimeState = {
  activeExecutions: Map<string, ActiveTaskExecution>;
};

type TaskRuntimeOptions = {
  client: TaskSyncClient;
  startTaskExecution: StartTaskExecution;
  recordKnowledgeInteraction?: (input: {
    origin: "remote-task";
    prompt: string;
    answer: string;
  }) => Promise<void> | void;
  persistLocalApproval?: (
    task: RemoteTaskRecord,
    draft: CodexWritePreviewDraft
  ) => Promise<void>;
  discardLocalApproval?: (draft: CodexWritePreviewDraft) => Promise<void>;
  runtimeState?: TaskRuntimeState;
};

async function readTaskList(response: Response): Promise<RemoteTaskRecord[]> {
  if (!response.ok) {
    throw new Error(`Task sync request failed: ${response.status}`);
  }

  const payload = (await response.json()) as TaskListResponse;
  return payload.items;
}

async function finalizeExecutionResult({
  client,
  task,
  executionResult,
  recordKnowledgeInteraction,
  persistLocalApproval,
  discardLocalApproval,
  cancelledByOperator
}: {
  client: TaskSyncClient;
  task: RemoteTaskRecord;
  executionResult: TaskExecutionResult;
  recordKnowledgeInteraction?: (input: {
    origin: "remote-task";
    prompt: string;
    answer: string;
  }) => Promise<void> | void;
  persistLocalApproval?: (
    task: RemoteTaskRecord,
    draft: CodexWritePreviewDraft
  ) => Promise<void>;
  discardLocalApproval?: (draft: CodexWritePreviewDraft) => Promise<void>;
  cancelledByOperator: boolean;
}): Promise<void> {
  if (cancelledByOperator && client.cancelTask !== undefined) {
    await client.cancelTask(task.task_id, "Cancelled by operator.");
    return;
  }

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
      return;
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
    return;
  }

  if (executionResult.ok) {
    try {
      await recordKnowledgeInteraction?.({
        origin: "remote-task",
        prompt: task.intent,
        answer: executionResult.resultText
      });
    } catch {
      // Knowledge ingestion is best-effort and must not fail task delivery.
    }

    const completeResponse = await client.completeTask(task.task_id, {
      resultText: executionResult.resultText,
      artifact: executionResult.artifact
    });

    if (!completeResponse.ok) {
      await client.failTask(
        task.task_id,
        `Failed to upload task result: ${completeResponse.status}`
      );
    }
    return;
  }

  if (executionResult.errorText === "Cancelled by operator." && client.cancelTask !== undefined) {
    await client.cancelTask(task.task_id, executionResult.errorText);
    return;
  }

  await client.failTask(task.task_id, executionResult.errorText);
}

export async function runTaskSyncCycle({
  client,
  startTaskExecution,
  recordKnowledgeInteraction,
  persistLocalApproval,
  discardLocalApproval,
  runtimeState = {
    activeExecutions: new Map()
  }
}: TaskRuntimeOptions): Promise<RemoteTaskRecord[]> {
  const initialSnapshot = await readTaskList(await client.fetchTaskSnapshot());

  for (const task of initialSnapshot) {
    if (task.status !== "cancel_requested") {
      continue;
    }

    const activeExecution = runtimeState.activeExecutions.get(task.task_id);

    if (activeExecution === undefined || activeExecution.cancelRequested) {
      continue;
    }

    activeExecution.cancelRequested = true;
    await activeExecution.cancel?.();
  }

  const queuedTasks = await readTaskList(await client.fetchQueuedTasks());
  let shouldRefreshSnapshot = false;

  for (const task of queuedTasks) {
    if (runtimeState.activeExecutions.has(task.task_id)) {
      continue;
    }

    const startResponse = await client.startTask(task.task_id);

    if (!startResponse.ok) {
      continue;
    }

    const executionHandle = startTaskExecution(task);

    if (executionHandle.kind === "immediate") {
      const executionResult = await executionHandle.result;
      await finalizeExecutionResult({
        client,
        task,
        executionResult,
        recordKnowledgeInteraction,
        persistLocalApproval,
        discardLocalApproval,
        cancelledByOperator: false
      });
      shouldRefreshSnapshot = true;
      continue;
    }

    let activeExecution: ActiveTaskExecution;
    const completion = executionHandle.result
      .then(async (executionResult) => {
        await finalizeExecutionResult({
          client,
          task,
          executionResult,
          recordKnowledgeInteraction,
          persistLocalApproval,
          discardLocalApproval,
          cancelledByOperator: activeExecution.cancelRequested
        });
      })
      .finally(() => {
        runtimeState.activeExecutions.delete(task.task_id);
      });

    activeExecution = {
      cancel: executionHandle.cancel,
      cancelRequested: false,
      completion
    };
    runtimeState.activeExecutions.set(task.task_id, activeExecution);
  }

  if (!shouldRefreshSnapshot) {
    return initialSnapshot;
  }

  return readTaskList(await client.fetchTaskSnapshot());
}
