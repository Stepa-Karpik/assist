import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createCodexRunner, type CodexRunRequest } from "./codexRunner";

export type CodexWritePreviewChange = {
  kind: "write" | "delete";
  relativePath: string;
  originalHash: string | null;
};

export type CodexWritePreviewDraft = {
  taskId: string;
  workspaceRoot: string;
  previewRoot: string;
  summaryText: string;
  previewText: string;
  changedFiles: string[];
  changes: CodexWritePreviewChange[];
};

export type CodexWritePreviewResult =
  | {
      kind: "no_changes";
      summaryText: string;
    }
  | {
      kind: "awaiting_local_approval";
      draft: CodexWritePreviewDraft;
    };

type PreviewBuilderRequest = {
  workspaceRoot: string;
  previewRoot: string;
  changes: CodexWritePreviewChange[];
};

type PreviewGeneratorOptions = {
  stateRoot?: string;
  runCodex?: (request: CodexRunRequest) => Promise<string>;
  buildPreviewText?: (request: PreviewBuilderRequest) => Promise<string> | string;
  now?: () => number;
};

type FileHashMap = Map<string, string>;

function toPosixPath(value: string): string {
  return value.split(path.sep).join(path.posix.sep);
}

async function walkFileHashes(root: string): Promise<FileHashMap> {
  const result = new Map<string, string>();

  async function visit(currentRoot: string): Promise<void> {
    const entries = await fs.readdir(currentRoot, { withFileTypes: true });

    for (const entry of entries) {
      const absolutePath = path.join(currentRoot, entry.name);

      if (entry.isDirectory()) {
        await visit(absolutePath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const relativePath = toPosixPath(path.relative(root, absolutePath));
      const contents = await fs.readFile(absolutePath);
      result.set(relativePath, crypto.createHash("sha256").update(contents).digest("hex"));
    }
  }

  await visit(root);
  return result;
}

async function buildDefaultPreviewText({
  workspaceRoot,
  previewRoot,
  changes
}: PreviewBuilderRequest): Promise<string> {
  const sections: string[] = [];

  for (const change of changes) {
    const originalPath = path.join(workspaceRoot, change.relativePath);
    const previewPath = path.join(previewRoot, change.relativePath);

    if (change.kind === "delete") {
      const originalText = await fs.readFile(originalPath, "utf8");
      sections.push(
        `--- ${change.relativePath}`,
        "+++ /dev/null",
        ...originalText.split(/\r?\n/).map((line) => `-${line}`)
      );
      continue;
    }

    const previewText = await fs.readFile(previewPath, "utf8");

    if (change.originalHash === null) {
      sections.push(
        "--- /dev/null",
        `+++ ${change.relativePath}`,
        ...previewText.split(/\r?\n/).map((line) => `+${line}`)
      );
      continue;
    }

    const originalText = await fs.readFile(originalPath, "utf8");
    sections.push(
      `--- ${change.relativePath}`,
      `+++ ${change.relativePath}`,
      ...originalText.split(/\r?\n/).map((line) => `-${line}`),
      ...previewText.split(/\r?\n/).map((line) => `+${line}`)
    );
  }

  return sections.join("\n");
}

async function createChangeList(
  workspaceRoot: string,
  previewRoot: string
): Promise<CodexWritePreviewChange[]> {
  const [workspaceFiles, previewFiles] = await Promise.all([
    walkFileHashes(workspaceRoot),
    walkFileHashes(previewRoot)
  ]);
  const allPaths = new Set<string>([...workspaceFiles.keys(), ...previewFiles.keys()]);
  const changes: CodexWritePreviewChange[] = [];

  for (const relativePath of [...allPaths].sort()) {
    const originalHash = workspaceFiles.get(relativePath) ?? null;
    const previewHash = previewFiles.get(relativePath) ?? null;

    if (originalHash === previewHash) {
      continue;
    }

    changes.push({
      kind: previewHash === null ? "delete" : "write",
      relativePath,
      originalHash
    });
  }

  return changes;
}

export function createCodexWritePreviewGenerator({
  stateRoot = path.join(os.tmpdir(), "karpik-codex-previews"),
  runCodex = createCodexRunner(),
  buildPreviewText = buildDefaultPreviewText,
  now = Date.now
}: PreviewGeneratorOptions = {}) {
  const previewsRoot = path.join(stateRoot, "codex-previews");

  return {
    async generatePreview({
      taskId,
      prompt,
      workspaceRoot
    }: {
      taskId: string;
      prompt: string;
      workspaceRoot: string;
    }): Promise<CodexWritePreviewResult> {
      await fs.mkdir(previewsRoot, { recursive: true });
      const previewRoot = path.join(previewsRoot, `${taskId}-${now()}`);
      await fs.cp(workspaceRoot, previewRoot, {
        recursive: true,
        force: true,
        errorOnExist: false
      });

      try {
        const summaryText = await runCodex({
          prompt,
          workspaceRoot: previewRoot,
          sandboxMode: "workspace-write"
        });
        const changes = await createChangeList(workspaceRoot, previewRoot);

        if (changes.length === 0) {
          await fs.rm(previewRoot, {
            recursive: true,
            force: true
          });
          return {
            kind: "no_changes",
            summaryText
          };
        }

        const previewText = await buildPreviewText({
          workspaceRoot,
          previewRoot,
          changes
        });

        return {
          kind: "awaiting_local_approval",
          draft: {
            taskId,
            workspaceRoot,
            previewRoot,
            summaryText,
            previewText,
            changedFiles: changes.map((change) => change.relativePath),
            changes
          }
        };
      } catch (error) {
        await fs.rm(previewRoot, {
          recursive: true,
          force: true
        });
        throw error;
      }
    }
  };
}
