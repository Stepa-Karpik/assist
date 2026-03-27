// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import { AssistantProcessStore } from "./assistantProcessStore";

describe("AssistantProcessStore", () => {
  it("tracks active assistant-started processes and finds them by query", () => {
    const store = new AssistantProcessStore();
    const kill = vi.fn();

    store.register({
      taskId: "task-osu",
      appId: "app-osu",
      displayName: "osu! lazer",
      aliases: ["osu", "осу", "osu lazer"],
      pid: 4242,
      kill
    });

    expect(store.listActive()).toHaveLength(1);
    expect(store.findActiveByQuery("осу")?.taskId).toBe("task-osu");
    expect(store.findActiveByQuery("osu lazer")?.pid).toBe(4242);
  });

  it("drops exited processes from the active list", () => {
    const store = new AssistantProcessStore();

    store.register({
      taskId: "task-osu",
      appId: "app-osu",
      displayName: "osu! lazer",
      aliases: ["osu"],
      pid: 4242,
      kill: () => undefined
    });
    store.markExited("task-osu");

    expect(store.listActive()).toEqual([]);
    expect(store.findActiveByQuery("osu")).toBeNull();
  });
});
