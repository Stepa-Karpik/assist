// @vitest-environment node

import { EventEmitter } from "node:events";

import { describe, expect, it, vi } from "vitest";

import { createCodexConversationRunner } from "./codexConversationRunner";

class MockReadable extends EventEmitter {
  override on(event: string, listener: (...args: any[]) => void): this {
    return super.on(event, listener);
  }
}

class MockChildProcess extends EventEmitter {
  readonly stdout = new MockReadable();

  readonly stderr = new MockReadable();

  readonly kill = vi.fn(() => {
    this.emit("close", null);
  });
}

describe("createCodexConversationRunner", () => {
  it("starts a persistent codex session for the first message", async () => {
    const child = new MockChildProcess();
    const spawnProcess = vi.fn(() => child);
    const runner = createCodexConversationRunner({
      codexExecutable: "codex",
      spawnProcess
    });
    const chunks: string[] = [];

    const handle = runner.start({
      prompt: "Explain FastAPI updates",
      workspaceRoot: "D:\\Projects\\assist",
      onDelta: (chunk) => {
        chunks.push(chunk);
      }
    });

    child.stdout.emit(
      "data",
      [
        JSON.stringify({
          type: "thread.started",
          thread_id: "session-new-1"
        }),
        JSON.stringify({
          type: "response.output_text.delta",
          delta: "FastAPI "
        }),
        JSON.stringify({
          type: "response.output_text.delta",
          delta: "updates"
        }),
        JSON.stringify({
          type: "item.completed",
          item: {
            type: "agent_message",
            text: "FastAPI updates"
          }
        })
      ].join("\n")
    );
    child.emit("close", 0);

    await expect(handle.result).resolves.toEqual({
      sessionId: "session-new-1",
      text: "FastAPI updates",
      partialText: "FastAPI updates",
      cancelled: false
    });
    expect(chunks).toEqual(["FastAPI ", "updates"]);
    expect(spawnProcess).toHaveBeenCalledWith(
      "codex",
      [
        "exec",
        "--json",
        "--skip-git-repo-check",
        "--full-auto",
        "--sandbox",
        "workspace-write",
        "Explain FastAPI updates"
      ],
      expect.objectContaining({
        cwd: "D:\\Projects\\assist"
      })
    );
  });

  it("resumes an existing codex session for follow-up messages", async () => {
    const child = new MockChildProcess();
    const spawnProcess = vi.fn(() => child);
    const runner = createCodexConversationRunner({
      codexExecutable: "codex",
      spawnProcess
    });

    const handle = runner.start({
      sessionId: "session-existing-1",
      prompt: "And what changed in pydantic?",
      workspaceRoot: "D:\\Projects\\assist"
    });

    child.stdout.emit(
      "data",
      JSON.stringify({
        type: "item.completed",
        item: {
          type: "agent_message",
          text: "Pydantic changes are ..."
        }
      })
    );
    child.emit("close", 0);

    await expect(handle.result).resolves.toEqual({
      sessionId: "session-existing-1",
      text: "Pydantic changes are ...",
      partialText: "Pydantic changes are ...",
      cancelled: false
    });
    expect(spawnProcess).toHaveBeenCalledWith(
      "codex",
      [
        "exec",
        "resume",
        "--json",
        "--skip-git-repo-check",
        "--full-auto",
        "session-existing-1",
        "And what changed in pydantic?"
      ],
      expect.objectContaining({
        cwd: "D:\\Projects\\assist"
      })
    );
  });

  it("cancels an active run and keeps the partial text", async () => {
    const child = new MockChildProcess();
    const spawnProcess = vi.fn(() => child);
    const runner = createCodexConversationRunner({
      codexExecutable: "codex",
      spawnProcess
    });

    const handle = runner.start({
      prompt: "Tell me a long story",
      workspaceRoot: "D:\\Projects\\assist"
    });

    child.stdout.emit(
      "data",
      [
        JSON.stringify({
          type: "thread.started",
          thread_id: "session-cancel-1"
        }),
        JSON.stringify({
          type: "response.output_text.delta",
          delta: "Partial answer"
        })
      ].join("\n")
    );

    handle.cancel();

    await expect(handle.result).resolves.toEqual({
      sessionId: "session-cancel-1",
      text: "Partial answer",
      partialText: "Partial answer",
      cancelled: true
    });
    expect(child.kill).toHaveBeenCalledTimes(1);
  });
});
