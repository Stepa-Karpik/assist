// @vitest-environment node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createTaskExecutor } from "./taskExecutor";

const tempRoots: string[] = [];

function createUserRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "karpik-task-executor-"));
  const userRoot = path.join(root, "docs", "user");
  fs.mkdirSync(userRoot, { recursive: true });
  tempRoots.push(root);
  return userRoot;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("createTaskExecutor", () => {
  it("returns a device status reply for the status intent", async () => {
    const executor = createTaskExecutor({
      deviceId: "desktop-local",
      userRoot: createUserRoot()
    });

    const result = await executor.execute({
      task_id: "task-1",
      intent: "status"
    });

    expect(result).toEqual({
      ok: true,
      resultText: "desktop-local is online"
    });
  });

  it("reads a file from the runtime user root", async () => {
    const userRoot = createUserRoot();
    const targetFile = path.join(userRoot, "docs", "note.txt");
    fs.mkdirSync(path.dirname(targetFile), { recursive: true });
    fs.writeFileSync(targetFile, "latest note");
    const executor = createTaskExecutor({
      deviceId: "desktop-local",
      userRoot
    });

    const result = await executor.execute({
      task_id: "task-2",
      intent: "read docs/note.txt"
    });

    expect(result).toEqual({
      ok: true,
      resultText: "latest note"
    });
  });

  it("rejects path traversal outside the runtime user root", async () => {
    const executor = createTaskExecutor({
      deviceId: "desktop-local",
      userRoot: createUserRoot()
    });

    const result = await executor.execute({
      task_id: "task-3",
      intent: "read ..\\..\\Windows\\win.ini"
    });

    expect(result).toEqual({
      ok: false,
      errorText: "Path is outside the allowed runtime area."
    });
  });

  it("fails unsupported task intents explicitly", async () => {
    const executor = createTaskExecutor({
      deviceId: "desktop-local",
      userRoot: createUserRoot()
    });

    const result = await executor.execute({
      task_id: "task-4",
      intent: "screenshot primary"
    });

    expect(result).toEqual({
      ok: false,
      errorText: "Unsupported task intent."
    });
  });
});
