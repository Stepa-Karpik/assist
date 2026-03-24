// @vitest-environment node

import { describe, expect, it } from "vitest";

import { buildTaskNotification } from "./taskNotifications";

describe("buildTaskNotification", () => {
  it("builds a notification for awaiting local approval", () => {
    expect(
      buildTaskNotification({
        task_id: "task-1",
        intent: "codex-write update README",
        status: "awaiting_local_approval",
        result_text: "Waiting for local review. Files: README.md"
      })
    ).toEqual({
      title: "Local approval required",
      body: "codex-write update README\nWaiting for local review. Files: README.md"
    });
  });

  it("builds a notification for completed tasks", () => {
    expect(
      buildTaskNotification({
        task_id: "task-2",
        intent: "screenshot",
        status: "done",
        result_text: "Screenshot captured."
      })
    ).toEqual({
      title: "Task completed",
      body: "screenshot\nScreenshot captured."
    });
  });

  it("ignores low-signal statuses", () => {
    expect(
      buildTaskNotification({
        task_id: "task-3",
        intent: "status",
        status: "running"
      })
    ).toBeNull();
  });
});
