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

function startImmediateTaskExecution(result: {
  ok: true;
  resultText: string;
  artifact?: {
    kind: "image_base64" | "file_base64";
    fileName: string;
    mimeType: string;
    contentBase64: string;
  };
} | {
  ok: false;
  errorText: string;
} | {
  ok: true;
  requiresLocalApproval: true;
  waitingText: string;
  draft: {
    taskId: string;
    workspaceRoot: string;
    previewRoot: string;
    summaryText: string;
    previewText: string;
    changedFiles: string[];
    changes: Array<{
      kind: "write";
      relativePath: string;
      originalHash: string;
    }>;
  };
}) {
  return {
    kind: "immediate" as const,
    result: Promise.resolve(result),
    cancel: vi.fn()
  };
}

describe("runTaskSyncCycle", () => {
  it("starts and completes queued tasks, then returns the refreshed snapshot", async () => {
    const fetchTaskSnapshot = vi
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
    const recordKnowledgeInteraction = vi.fn(async () => undefined);
    const startTaskExecution = vi.fn(() =>
      startImmediateTaskExecution({
        ok: true as const,
        resultText: "desktop-local is online"
      })
    );

    const snapshot = await runTaskSyncCycle({
      client: {
        fetchTaskSnapshot,
        fetchQueuedTasks,
        startTask,
        awaitLocalApproval,
        blockTask,
        completeTask,
        failTask
      },
      startTaskExecution,
      recordKnowledgeInteraction
    });

    expect(fetchTaskSnapshot).toHaveBeenCalledTimes(2);
    expect(fetchQueuedTasks).toHaveBeenCalledTimes(1);
    expect(startTask).toHaveBeenCalledWith("task-1");
    expect(startTaskExecution).toHaveBeenCalledWith({
      task_id: "task-1",
      intent: "status",
      status: "queued"
    });
    expect(completeTask).toHaveBeenCalledWith("task-1", {
      resultText: "desktop-local is online",
      artifact: undefined
    });
    expect(recordKnowledgeInteraction).toHaveBeenCalledWith({
      origin: "remote-task",
      prompt: "status",
      answer: "desktop-local is online"
    });
    expect(failTask).not.toHaveBeenCalled();
    expect(awaitLocalApproval).not.toHaveBeenCalled();
    expect(blockTask).not.toHaveBeenCalled();
    expect(snapshot[0].status).toBe("done");
  });

  it("fails queued tasks when the executor returns an error", async () => {
    const fetchTaskSnapshot = vi
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
    const startTaskExecution = vi.fn(() =>
      startImmediateTaskExecution({
        ok: false as const,
        errorText: "File not found."
      })
    );

    const snapshot = await runTaskSyncCycle({
      client: {
        fetchTaskSnapshot,
        fetchQueuedTasks,
        startTask,
        awaitLocalApproval,
        blockTask,
        completeTask,
        failTask
      },
      startTaskExecution
    });

    expect(startTask).toHaveBeenCalledWith("task-2");
    expect(completeTask).not.toHaveBeenCalled();
    expect(failTask).toHaveBeenCalledWith("task-2", "File not found.");
    expect(awaitLocalApproval).not.toHaveBeenCalled();
    expect(blockTask).not.toHaveBeenCalled();
    expect(snapshot[0].status).toBe("failed");
  });

  it("moves tasks into awaiting_local_approval and persists the preview draft", async () => {
    const fetchTaskSnapshot = vi
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
    const startTaskExecution = vi.fn(() =>
      startImmediateTaskExecution({
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
      })
    );

    const snapshot = await runTaskSyncCycle({
      client: {
        fetchTaskSnapshot,
        fetchQueuedTasks,
        startTask,
        awaitLocalApproval,
        completeTask,
        failTask,
        blockTask
      },
      startTaskExecution,
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

  it("fails the task when result upload is rejected by the server", async () => {
    const fetchTaskSnapshot = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValueOnce(
        jsonResponse({
          items: [{ task_id: "task-4", intent: "send-file desktop::hack.pptx", status: "queued" }]
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              task_id: "task-4",
              intent: "send-file desktop::hack.pptx",
              status: "failed",
              error_text: "Failed to upload task result: 413"
            }
          ]
        })
      );
    const fetchQueuedTasks = vi.fn(async () =>
      jsonResponse({
        items: [{ task_id: "task-4", intent: "send-file desktop::hack.pptx", status: "queued" }]
      })
    );
    const startTask = vi.fn(async () =>
      jsonResponse({
        task_id: "task-4",
        intent: "send-file desktop::hack.pptx",
        status: "running"
      })
    );
    const completeTask = vi.fn(async () => new Response("too large", { status: 413 }));
    const failTask = vi.fn(async () =>
      jsonResponse({
        task_id: "task-4",
        intent: "send-file desktop::hack.pptx",
        status: "failed"
      })
    );
    const awaitLocalApproval = vi.fn();
    const blockTask = vi.fn();
    const startTaskExecution = vi.fn(() =>
      startImmediateTaskExecution({
        ok: true as const,
        resultText: "Sending file...",
        artifact: {
          kind: "file_base64" as const,
          fileName: "hack.pptx",
          mimeType:
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          contentBase64: "ZmFrZQ=="
        }
      })
    );

    const snapshot = await runTaskSyncCycle({
      client: {
        fetchTaskSnapshot,
        fetchQueuedTasks,
        startTask,
        awaitLocalApproval,
        blockTask,
        completeTask,
        failTask
      },
      startTaskExecution
    });

    expect(completeTask).toHaveBeenCalledWith("task-4", {
      resultText: "Sending file...",
      artifact: {
        kind: "file_base64",
        fileName: "hack.pptx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        contentBase64: "ZmFrZQ=="
      }
    });
    expect(failTask).toHaveBeenCalledWith("task-4", "Failed to upload task result: 413");
    expect(snapshot[0].status).toBe("failed");
  });

  it("cancels deferred running tasks when the server marks them as cancel_requested", async () => {
    let resolveExecution: ((value: {
      ok: false;
      errorText: string;
    }) => void) | null = null;
    const cancel = vi.fn(() => {
      resolveExecution?.({
        ok: false as const,
        errorText: "Cancelled by operator."
      });
    });
    const startTaskExecution = vi.fn(() => ({
      kind: "deferred" as const,
      result: new Promise<{ ok: false; errorText: string }>((resolve) => {
        resolveExecution = resolve;
      }),
      cancel
    }));
    const fetchTaskSnapshot = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValueOnce(
        jsonResponse({
          items: [{ task_id: "task-5", intent: "codex long task", status: "queued" }]
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          items: [{ task_id: "task-5", intent: "codex long task", status: "cancel_requested" }]
        })
      );
    const fetchQueuedTasks = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValueOnce(
        jsonResponse({
          items: [{ task_id: "task-5", intent: "codex long task", status: "queued" }]
        })
      )
      .mockResolvedValueOnce(jsonResponse({ items: [] }));
    const startTask = vi.fn(async () =>
      jsonResponse({
        task_id: "task-5",
        intent: "codex long task",
        status: "running"
      })
    );
    const cancelTask = vi.fn(async () =>
      jsonResponse({
        task_id: "task-5",
        intent: "codex long task",
        status: "cancelled"
      })
    );
    const completeTask = vi.fn();
    const failTask = vi.fn();
    const awaitLocalApproval = vi.fn();
    const blockTask = vi.fn();
    const runtimeState = {
      activeExecutions: new Map()
    };

    await runTaskSyncCycle({
      client: {
        fetchTaskSnapshot,
        fetchQueuedTasks,
        startTask,
        awaitLocalApproval,
        blockTask,
        completeTask,
        failTask,
        cancelTask
      },
      startTaskExecution,
      runtimeState
    });

    await runTaskSyncCycle({
      client: {
        fetchTaskSnapshot,
        fetchQueuedTasks,
        startTask,
        awaitLocalApproval,
        blockTask,
        completeTask,
        failTask,
        cancelTask
      },
      startTaskExecution,
      runtimeState
    });

    await Promise.resolve();

    expect(cancel).toHaveBeenCalledTimes(1);
    expect(cancelTask).toHaveBeenCalledWith("task-5", "Cancelled by operator.");
    expect(runtimeState.activeExecutions.size).toBe(0);
  });
});
