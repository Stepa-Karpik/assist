// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import { runTaskSyncCycle } from "./taskRuntime";

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

describe("runTaskSyncCycle", () => {
  it("starts and completes queued tasks, then returns the refreshed snapshot", async () => {
    const fetchTaskHistory = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValueOnce(
        jsonResponse({
          items: [{ task_id: "task-1", intent: "status", status: "queued" }]
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              task_id: "task-1",
              intent: "status",
              status: "done",
              result_text: "desktop-local is online"
            }
          ]
        })
      );
    const fetchQueuedTasks = vi.fn(async () =>
      jsonResponse({
        items: [{ task_id: "task-1", intent: "status", status: "queued" }]
      })
    );
    const startTask = vi.fn(async () =>
      jsonResponse({
        task_id: "task-1",
        intent: "status",
        status: "running"
      })
    );
    const completeTask = vi.fn(async () =>
      jsonResponse({
        task_id: "task-1",
        intent: "status",
        status: "done"
      })
    );
    const failTask = vi.fn();
    const awaitLocalApproval = vi.fn();
    const blockTask = vi.fn();
    const executeTask = vi.fn(async () => ({
      ok: true as const,
      resultText: "desktop-local is online"
    }));

    const snapshot = await runTaskSyncCycle({
      client: {
        fetchTaskHistory,
        fetchQueuedTasks,
        startTask,
        awaitLocalApproval,
        blockTask,
        completeTask,
        failTask
      },
      executeTask
    });

    expect(fetchTaskHistory).toHaveBeenCalledTimes(2);
    expect(fetchQueuedTasks).toHaveBeenCalledTimes(1);
    expect(startTask).toHaveBeenCalledWith("task-1");
    expect(executeTask).toHaveBeenCalledWith({
      task_id: "task-1",
      intent: "status",
      status: "queued"
    });
    expect(completeTask).toHaveBeenCalledWith("task-1", "desktop-local is online");
    expect(failTask).not.toHaveBeenCalled();
    expect(awaitLocalApproval).not.toHaveBeenCalled();
    expect(blockTask).not.toHaveBeenCalled();
    expect(snapshot[0].status).toBe("done");
  });

  it("fails queued tasks when the executor returns an error", async () => {
    const fetchTaskHistory = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValueOnce(
        jsonResponse({
          items: [{ task_id: "task-2", intent: "read docs/missing.txt", status: "queued" }]
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              task_id: "task-2",
              intent: "read docs/missing.txt",
              status: "failed",
              error_text: "File not found."
            }
          ]
        })
      );
    const fetchQueuedTasks = vi.fn(async () =>
      jsonResponse({
        items: [{ task_id: "task-2", intent: "read docs/missing.txt", status: "queued" }]
      })
    );
    const startTask = vi.fn(async () =>
      jsonResponse({
        task_id: "task-2",
        intent: "read docs/missing.txt",
        status: "running"
      })
    );
    const completeTask = vi.fn();
    const failTask = vi.fn(async () =>
      jsonResponse({
        task_id: "task-2",
        intent: "read docs/missing.txt",
        status: "failed"
      })
    );
    const awaitLocalApproval = vi.fn();
    const blockTask = vi.fn();
    const executeTask = vi.fn(async () => ({
      ok: false as const,
      errorText: "File not found."
    }));

    const snapshot = await runTaskSyncCycle({
      client: {
        fetchTaskHistory,
        fetchQueuedTasks,
        startTask,
        awaitLocalApproval,
        blockTask,
        completeTask,
        failTask
      },
      executeTask
    });

    expect(startTask).toHaveBeenCalledWith("task-2");
    expect(completeTask).not.toHaveBeenCalled();
    expect(failTask).toHaveBeenCalledWith("task-2", "File not found.");
    expect(awaitLocalApproval).not.toHaveBeenCalled();
    expect(blockTask).not.toHaveBeenCalled();
    expect(snapshot[0].status).toBe("failed");
  });

  it("moves tasks into awaiting_local_approval and persists the preview draft", async () => {
    const fetchTaskHistory = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValueOnce(
        jsonResponse({
          items: [{ task_id: "task-3", intent: "codex-write update README", status: "queued" }]
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              task_id: "task-3",
              intent: "codex-write update README",
              status: "awaiting_local_approval",
              result_text: "Waiting for local review. Files: README.md"
            }
          ]
        })
      );
    const fetchQueuedTasks = vi.fn(async () =>
      jsonResponse({
        items: [{ task_id: "task-3", intent: "codex-write update README", status: "queued" }]
      })
    );
    const startTask = vi.fn(async () =>
      jsonResponse({
        task_id: "task-3",
        intent: "codex-write update README",
        status: "running"
      })
    );
    const awaitLocalApproval = vi.fn(async () =>
      jsonResponse({
        task_id: "task-3",
        intent: "codex-write update README",
        status: "awaiting_local_approval"
      })
    );
    const completeTask = vi.fn();
    const failTask = vi.fn();
    const blockTask = vi.fn();
    const persistLocalApproval = vi.fn(async () => undefined);
    const executeTask = vi.fn(async () => ({
      ok: true as const,
      requiresLocalApproval: true as const,
      waitingText: "Waiting for local review. Files: README.md",
      draft: {
        taskId: "task-3",
        workspaceRoot: "C:\\Workspace",
        previewRoot: "C:\\Preview",
        summaryText: "Updated README",
        previewText: "diff preview",
        changedFiles: ["README.md"],
        changes: [
          {
            kind: "write" as const,
            relativePath: "README.md",
            originalHash: "hash-before"
          }
        ]
      }
    }));

    const snapshot = await runTaskSyncCycle({
      client: {
        fetchTaskHistory,
        fetchQueuedTasks,
        startTask,
        awaitLocalApproval,
        completeTask,
        failTask,
        blockTask
      },
      executeTask,
      persistLocalApproval
    });

    expect(awaitLocalApproval).toHaveBeenCalledWith(
      "task-3",
      "Waiting for local review. Files: README.md"
    );
    expect(persistLocalApproval).toHaveBeenCalledWith(
      {
        task_id: "task-3",
        intent: "codex-write update README",
        status: "queued"
      },
      expect.objectContaining({
        taskId: "task-3",
        changedFiles: ["README.md"]
      })
    );
    expect(completeTask).not.toHaveBeenCalled();
    expect(failTask).not.toHaveBeenCalled();
    expect(blockTask).not.toHaveBeenCalled();
    expect(snapshot[0].status).toBe("awaiting_local_approval");
  });
});
