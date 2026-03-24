// @vitest-environment node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

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

  it("lists files from the runtime user root", async () => {
    const userRoot = createUserRoot();
    const docsRoot = path.join(userRoot, "docs");
    fs.mkdirSync(docsRoot, { recursive: true });
    fs.writeFileSync(path.join(docsRoot, "note-a.txt"), "a");
    fs.writeFileSync(path.join(docsRoot, "note-b.txt"), "b");
    const executor = createTaskExecutor({
      deviceId: "desktop-local",
      userRoot
    });

    const result = await executor.execute({
      task_id: "task-list",
      intent: "list docs"
    });

    expect(result).toEqual({
      ok: true,
      resultText: "note-a.txt\nnote-b.txt"
    });
  });

  it("writes a note inside the runtime notes folder", async () => {
    const userRoot = createUserRoot();
    const executor = createTaskExecutor({
      deviceId: "desktop-local",
      userRoot
    });

    const result = await executor.execute({
      task_id: "task-write",
      intent: "write-note daily.txt :: hello world"
    });

    expect(result).toEqual({
      ok: true,
      resultText: "docs/notes/daily.txt"
    });
    expect(
      fs.readFileSync(path.join(userRoot, "docs", "notes", "daily.txt"), "utf8")
    ).toBe("hello world");
  });

  it("rejects invalid note names for write-note", async () => {
    const executor = createTaskExecutor({
      deviceId: "desktop-local",
      userRoot: createUserRoot()
    });

    const result = await executor.execute({
      task_id: "task-invalid-note",
      intent: "write-note ..\\escape.txt :: hello"
    });

    expect(result).toEqual({
      ok: false,
      errorText: "Invalid note name."
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

  it("runs codex prompts in the configured workspace", async () => {
    const workspaceRoot = createUserRoot();
    const runCodex = vi.fn(async () => "Codex summary");
    const executor = createTaskExecutor({
      deviceId: "desktop-local",
      userRoot: createUserRoot(),
      getCodexWorkspaceRoot: () => workspaceRoot,
      runCodex
    });

    const result = await executor.execute({
      task_id: "task-codex",
      intent: "codex summarize the latest notes"
    });

    expect(result).toEqual({
      ok: true,
      resultText: "Codex summary"
    });
    expect(runCodex).toHaveBeenCalledWith({
      prompt: "summarize the latest notes",
      workspaceRoot
    });
  });

  it("rejects empty codex prompts", async () => {
    const runCodex = vi.fn(async () => "unused");
    const executor = createTaskExecutor({
      deviceId: "desktop-local",
      userRoot: createUserRoot(),
      runCodex
    });

    const result = await executor.execute({
      task_id: "task-codex-empty",
      intent: "codex    "
    });

    expect(result).toEqual({
      ok: false,
      errorText: "Codex prompt is empty."
    });
    expect(runCodex).not.toHaveBeenCalled();
  });

  it("fails codex tasks when the configured workspace does not exist", async () => {
    const runCodex = vi.fn(async () => "unused");
    const executor = createTaskExecutor({
      deviceId: "desktop-local",
      userRoot: createUserRoot(),
      getCodexWorkspaceRoot: () => "D:\\Missing\\Workspace",
      runCodex
    });

    const result = await executor.execute({
      task_id: "task-codex-missing",
      intent: "codex inspect the workspace"
    });

    expect(result).toEqual({
      ok: false,
      errorText: "Codex workspace does not exist."
    });
    expect(runCodex).not.toHaveBeenCalled();
  });

  it("surfaces codex runner failures explicitly", async () => {
    const workspaceRoot = createUserRoot();
    const executor = createTaskExecutor({
      deviceId: "desktop-local",
      userRoot: createUserRoot(),
      getCodexWorkspaceRoot: () => workspaceRoot,
      runCodex: async () => {
        throw new Error("Codex CLI is unavailable.");
      }
    });

    const result = await executor.execute({
      task_id: "task-codex-error",
      intent: "codex inspect the workspace"
    });

    expect(result).toEqual({
      ok: false,
      errorText: "Codex CLI is unavailable."
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
