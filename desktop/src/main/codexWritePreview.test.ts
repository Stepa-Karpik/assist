// @vitest-environment node

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createCodexWritePreviewGenerator } from "./codexWritePreview";

const tempRoots: string[] = [];

function createTempRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "karpik-codex-preview-"));
  tempRoots.push(root);
  return root;
}

function hashText(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("createCodexWritePreviewGenerator", () => {
  it("creates a pending local approval draft when codex changes files", async () => {
    const workspaceRoot = path.join(createTempRoot(), "workspace");
    fs.mkdirSync(workspaceRoot, { recursive: true });
    fs.writeFileSync(path.join(workspaceRoot, "README.md"), "before");
    const runCodex = vi.fn(async ({ workspaceRoot: previewRoot }: { workspaceRoot: string }) => {
      fs.writeFileSync(path.join(previewRoot, "README.md"), "after");
      return "Updated README";
    });
    const buildPreviewText = vi.fn(async () => "diff preview");
    const generator = createCodexWritePreviewGenerator({
      stateRoot: path.join(createTempRoot(), "state"),
      runCodex,
      buildPreviewText
    });

    const result = await generator.generatePreview({
      taskId: "task-1",
      prompt: "update readme",
      workspaceRoot
    });

    expect(result.kind).toBe("awaiting_local_approval");
    if (result.kind !== "awaiting_local_approval") {
      throw new Error("Expected local approval result");
    }
    expect(runCodex).toHaveBeenCalledWith({
      prompt: "update readme",
      workspaceRoot: result.draft.previewRoot,
      sandboxMode: "workspace-write"
    });
    expect(result.draft.summaryText).toBe("Updated README");
    expect(result.draft.previewText).toBe("diff preview");
    expect(result.draft.changedFiles).toEqual(["README.md"]);
    expect(result.draft.changes).toEqual([
      {
        kind: "write",
        relativePath: "README.md",
        originalHash: hashText("before")
      }
    ]);
    expect(fs.existsSync(result.draft.previewRoot)).toBe(true);
  });

  it("returns an immediate success result when codex makes no file changes", async () => {
    const workspaceRoot = path.join(createTempRoot(), "workspace");
    fs.mkdirSync(workspaceRoot, { recursive: true });
    fs.writeFileSync(path.join(workspaceRoot, "README.md"), "before");
    const buildPreviewText = vi.fn(async () => "unused");
    const generator = createCodexWritePreviewGenerator({
      stateRoot: path.join(createTempRoot(), "state"),
      runCodex: async () => "No changes needed",
      buildPreviewText
    });

    const result = await generator.generatePreview({
      taskId: "task-2",
      prompt: "inspect readme",
      workspaceRoot
    });

    expect(result).toEqual({
      kind: "no_changes",
      summaryText: "No changes needed"
    });
    expect(buildPreviewText).not.toHaveBeenCalled();
  });
});
