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
    const executeTask = vi.fn(async () => ({
      ok: true as const,
      resultText: "desktop-local is online"
    }));

    const snapshot = await runTaskSyncCycle({
      client: {
        fetchTaskHistory,
        fetchQueuedTasks,
        startTask,
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
    const executeTask = vi.fn(async () => ({
      ok: false as const,
      errorText: "File not found."
    }));

    const snapshot = await runTaskSyncCycle({
      client: {
        fetchTaskHistory,
        fetchQueuedTasks,
        startTask,
        completeTask,
        failTask
      },
      executeTask
    });

    expect(startTask).toHaveBeenCalledWith("task-2");
    expect(completeTask).not.toHaveBeenCalled();
    expect(failTask).toHaveBeenCalledWith("task-2", "File not found.");
    expect(snapshot[0].status).toBe("failed");
  });
});
