// @vitest-environment node

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { LocalApprovalStore, type CodexWritePreviewDraft } from "./localApprovalStore";

const tempRoots: string[] = [];

function createTempRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "karpik-local-approval-"));
  tempRoots.push(root);
  return root;
}

function hashText(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function createDraft(
  taskId: string,
  workspaceRoot: string,
  previewRoot: string,
  options: {
    relativePath: string;
    originalText: string;
    previewText: string;
  }
): CodexWritePreviewDraft {
  const { relativePath, originalText, previewText } = options;
  fs.mkdirSync(path.dirname(path.join(workspaceRoot, relativePath)), { recursive: true });
  fs.mkdirSync(path.dirname(path.join(previewRoot, relativePath)), { recursive: true });
  fs.writeFileSync(path.join(workspaceRoot, relativePath), originalText);
  fs.writeFileSync(path.join(previewRoot, relativePath), previewText);

  return {
    taskId,
    workspaceRoot,
    previewRoot,
    summaryText: "Updated file",
    previewText: "--- preview ---",
    changedFiles: [relativePath],
    changes: [
      {
        kind: "write",
        relativePath,
        originalHash: hashText(originalText)
      }
    ]
  };
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("LocalApprovalStore", () => {
  it("persists local approval previews and applies them on approve", async () => {
    const root = createTempRoot();
    const workspaceRoot = path.join(root, "workspace");
    const previewRoot = path.join(root, "preview");
    const store = new LocalApprovalStore({
      stateRoot: path.join(root, "state")
    });
    const draft = createDraft("task-1", workspaceRoot, previewRoot, {
      relativePath: "README.md",
      originalText: "before",
      previewText: "after"
    });

    store.saveDraft("codex-write update the readme", draft);

    expect(store.list()).toEqual([
      expect.objectContaining({
        taskId: "task-1",
        intent: "codex-write update the readme",
        summaryText: "Updated file",
        changedFiles: ["README.md"],
        previewText: "--- preview ---"
      })
    ]);

    const result = await store.approve("task-1");

    expect(result.resultText).toContain("Applied locally.");
    expect(fs.readFileSync(path.join(workspaceRoot, "README.md"), "utf8")).toBe("after");
    expect(store.list()).toEqual([]);
    expect(fs.existsSync(previewRoot)).toBe(false);
  });

  it("drops pending previews on reject", async () => {
    const root = createTempRoot();
    const workspaceRoot = path.join(root, "workspace");
    const previewRoot = path.join(root, "preview");
    const store = new LocalApprovalStore({
      stateRoot: path.join(root, "state")
    });
    const draft = createDraft("task-2", workspaceRoot, previewRoot, {
      relativePath: "README.md",
      originalText: "before",
      previewText: "after"
    });

    store.saveDraft("codex-write update the readme", draft);

    const result = await store.reject("task-2");

    expect(result).toEqual({
      errorText: "Rejected locally."
    });
    expect(store.list()).toEqual([]);
    expect(fs.existsSync(previewRoot)).toBe(false);
    expect(fs.readFileSync(path.join(workspaceRoot, "README.md"), "utf8")).toBe("before");
  });

  it("refuses to apply a preview when the real workspace drifted", async () => {
    const root = createTempRoot();
    const workspaceRoot = path.join(root, "workspace");
    const previewRoot = path.join(root, "preview");
    const store = new LocalApprovalStore({
      stateRoot: path.join(root, "state")
    });
    const draft = createDraft("task-3", workspaceRoot, previewRoot, {
      relativePath: "README.md",
      originalText: "before",
      previewText: "after"
    });

    store.saveDraft("codex-write update the readme", draft);
    fs.writeFileSync(path.join(workspaceRoot, "README.md"), "changed by user");

    await expect(store.approve("task-3")).rejects.toThrow(
      "Workspace changed since preview generation."
    );
    expect(store.list()).toHaveLength(1);
  });
});
