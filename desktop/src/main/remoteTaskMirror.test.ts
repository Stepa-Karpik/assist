import { describe, expect, it, vi } from "vitest";

import type { RemoteTaskRecord } from "./syncClient";
import { mirrorRemoteTaskUpdates } from "./remoteTaskMirror";

function createTask(overrides: Partial<RemoteTaskRecord>): RemoteTaskRecord {
  return {
    task_id: "task-1",
    intent: "status",
    status: "queued",
    ...overrides
  };
}

describe("mirrorRemoteTaskUpdates", () => {
  it("mirrors only changed high-signal telegram task states", () => {
    const mirrorTask = vi.fn();

    mirrorRemoteTaskUpdates({
      previousSnapshot: [
        createTask({
          task_id: "task-queued",
          chat_id: 5001,
          status: "queued"
        }),
        createTask({
          task_id: "task-done",
          chat_id: 5001,
          status: "done",
          result_text: "same"
        })
      ],
      nextSnapshot: [
        createTask({
          task_id: "task-queued",
          chat_id: 5001,
          status: "queued"
        }),
        createTask({
          task_id: "task-done",
          chat_id: 5001,
          status: "done",
          result_text: "same"
        }),
        createTask({
          task_id: "task-awaiting",
          chat_id: 5001,
          status: "awaiting_auth"
        }),
        createTask({
          task_id: "task-desktop",
          source: "desktop",
          status: "done"
        })
      ],
      mirrorTask
    });

    expect(mirrorTask).toHaveBeenCalledTimes(1);
    expect(mirrorTask).toHaveBeenCalledWith(
      expect.objectContaining({
        task_id: "task-awaiting",
        chat_id: 5001,
        status: "awaiting_auth"
      })
    );
  });
});
