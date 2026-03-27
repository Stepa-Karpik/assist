// @vitest-environment node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { ActivityLogStore } from "./activityLogStore";

const tempRoots: string[] = [];

function createStateRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "karpik-activity-log-store-"));
  tempRoots.push(root);
  return root;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("ActivityLogStore", () => {
  it("appends entries newest first and reloads them from disk", () => {
    const stateRoot = createStateRoot();
    const firstStore = new ActivityLogStore({
      stateRoot,
      now: () => new Date("2026-03-24T16:00:00.000Z"),
      generateEntryId: () => "entry-1"
    });

    const firstEntry = firstStore.append({
      kind: "local_request",
      status: "info",
      title: "Local request",
      detail: "status",
      chatId: "local-chat-1"
    });

    expect(firstEntry).toEqual({
      entryId: "entry-1",
      kind: "local_request",
      status: "info",
      title: "Local request",
      detail: "status",
      chatId: "local-chat-1",
      taskId: null,
      createdAt: "2026-03-24T16:00:00.000Z"
    });

    const secondStore = new ActivityLogStore({
      stateRoot,
      generateEntryId: () => "unused"
    });

    expect(secondStore.list()).toEqual([firstEntry]);
  });

  it("trims old entries when the max size is reached", () => {
    const stateRoot = createStateRoot();
    let entryCounter = 0;
    const store = new ActivityLogStore({
      stateRoot,
      maxEntries: 2,
      now: () => new Date(`2026-03-24T16:00:0${entryCounter}.000Z`),
      generateEntryId: () => {
        entryCounter += 1;
        return `entry-${entryCounter}`;
      }
    });

    store.append({
      kind: "local_request",
      status: "info",
      title: "Request 1"
    });
    store.append({
      kind: "local_result",
      status: "success",
      title: "Result 2"
    });
    store.append({
      kind: "remote_task",
      status: "warning",
      title: "Task 3"
    });

    expect(store.list().map((entry) => entry.entryId)).toEqual(["entry-3", "entry-2"]);
  });
});
