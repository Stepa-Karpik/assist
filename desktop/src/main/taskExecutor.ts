import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  createCodexRunner,
  type CodexExecutionHandle,
  type CodexRunRequest
} from "./codexRunner";
import {
  createCodexWritePreviewGenerator,
  type CodexWritePreviewHandle,
  type CodexWritePreviewDraft,
  type CodexWritePreviewResult
} from "./codexWritePreview";
import { resolveFileArtifact } from "./fileArtifactResolver";
import {
  createScreenshotCapture,
  type CapturedScreenshot,
  type ScreenshotTarget
} from "./screenshotCapture";
import type { TaskResultArtifact } from "./syncClient";

export type ExecutableTask = {
  task_id: string;
  intent: string;
  chat_id?: number | null;
  workspace_root?: string | null;
};

export type TaskExecutionResult =
  | {
      ok: true;
      resultText: string;
      artifact?: TaskResultArtifact;
      requiresLocalApproval?: false;
    }
  | {
      ok: false;
      errorText: string;
      requiresLocalApproval?: false;
    }
  | {
      ok: true;
      requiresLocalApproval: true;
      waitingText: string;
      draft: CodexWritePreviewDraft;
    };

export type TaskExecutionHandle = {
  kind: "immediate" | "deferred";
  result: Promise<TaskExecutionResult>;
  cancel?: () => Promise<void> | void;
};

type TaskExecutorOptions = {
  deviceId: string;
  userRoot: string;
  getCodexWorkspaceRoot?: () => string;
  resolveCodexWorkspace?: (task: ExecutableTask) => string;
  startCodexRun?: (request: CodexRunRequest) => CodexExecutionHandle;
  runCodex?: (request: CodexRunRequest) => Promise<string>;
  startCodexWritePreview?: (request: {
    taskId: string;
    prompt: string;
    workspaceRoot: string;
  }) => CodexWritePreviewHandle;
  generateCodexWritePreview?: (request: {
    taskId: string;
    prompt: string;
    workspaceRoot: string;
  }) => Promise<CodexWritePreviewResult>;
  captureScreenshot?: (target: ScreenshotTarget) => Promise<CapturedScreenshot>;
  maxResultLength?: number;
};

function isPathInsideRoot(root: string, candidate: string): boolean {
  return candidate === root || candidate.startsWith(`${root}${path.sep}`);
}

function trimResultText(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1)}...`;
}

function normalizeTarget(root: string, relativeTarget: string): string | null {
  const targetPath = path.resolve(root, relativeTarget.trim());

  if (!isPathInsideRoot(root, targetPath)) {
    return null;
  }

  return targetPath;
}

function normalizeSystemTarget(relativeTarget: string): string | null {
  const trimmed = relativeTarget.trim().replaceAll("/", path.sep);
  const lower = trimmed.toLowerCase();
  const homeRoot = os.homedir();
  const trimLeadingSeparators = (value: string) => value.replace(/^[\\/]+/, "");

  if (lower === "desktop" || lower.startsWith(`desktop${path.sep}`)) {
    return normalizeTarget(
      path.join(homeRoot, "Desktop"),
      trimLeadingSeparators(trimmed.slice("desktop".length))
    );
  }

  if (lower === "documents" || lower.startsWith(`documents${path.sep}`)) {
    return normalizeTarget(
      path.join(homeRoot, "Documents"),
      trimLeadingSeparators(trimmed.slice("documents".length))
    );
  }

  if (lower === "downloads" || lower.startsWith(`downloads${path.sep}`)) {
    return normalizeTarget(
      path.join(homeRoot, "Downloads"),
      trimLeadingSeparators(trimmed.slice("downloads".length))
    );
  }

  return null;
}

function isSafeNoteName(value: string): boolean {
  return /^[a-zA-Z0-9._-]+$/.test(value);
}

function buildLocalApprovalWaitingText(changedFiles: string[]): string {
  return `Waiting for local review. Files: ${changedFiles.join(", ")}`;
}

function resolveReadListTarget(defaultRoot: string, relativeTarget: string): string | null {
  return normalizeSystemTarget(relativeTarget) ?? normalizeTarget(defaultRoot, relativeTarget);
}

function parseScreenshotTarget(intent: string): ScreenshotTarget {
  return /screen-2/i.test(intent) ? "screen-2" : "screen-1";
}

function createImmediateHandle(result: TaskExecutionResult | Promise<TaskExecutionResult>): TaskExecutionHandle {
  return {
    kind: "immediate",
    result: Promise.resolve(result),
    cancel: () => undefined
  };
}

async function workspaceExists(workspaceRoot: string): Promise<boolean> {
  try {
    const workspaceStat = await fs.stat(workspaceRoot);
    return workspaceStat.isDirectory();
  } catch {
    return false;
  }
}

export function createTaskExecutor({
  deviceId,
  userRoot,
  getCodexWorkspaceRoot,
  resolveCodexWorkspace,
  startCodexRun,
  runCodex,
  startCodexWritePreview,
  generateCodexWritePreview,
  captureScreenshot = createScreenshotCapture(deviceId),
  maxResultLength = 1500
}: TaskExecutorOptions) {
  const normalizedUserRoot = path.resolve(userRoot);
  const runCodexImpl = runCodex ?? createCodexRunner();
  const startCodexRunImpl =
    startCodexRun ??
    ((request: CodexRunRequest) => ({
      result: runCodexImpl(request),
      cancel: () => undefined
    }));
  const codexWritePreviewGenerator = createCodexWritePreviewGenerator({
    stateRoot: path.join(os.tmpdir(), "karpik-codex-previews"),
    startCodexRun: startCodexRunImpl,
    runCodex: runCodexImpl
  });
  const startCodexWritePreviewImpl =
    startCodexWritePreview ??
    ((request: { taskId: string; prompt: string; workspaceRoot: string }) =>
      generateCodexWritePreview === undefined
        ? codexWritePreviewGenerator.startPreview(request)
        : {
            result: generateCodexWritePreview(request),
            cancel: () => undefined
          });
  const resolveCodexWorkspaceRoot =
    resolveCodexWorkspace ??
    (() => getCodexWorkspaceRoot?.() ?? normalizedUserRoot);
  const notesRoot = path.join(normalizedUserRoot, "docs", "notes");

  function getWorkspaceRoot(task: ExecutableTask): string {
    if (typeof task.workspace_root === "string" && task.workspace_root.trim().length > 0) {
      return path.resolve(task.workspace_root.trim());
    }

    return path.resolve(resolveCodexWorkspaceRoot(task).trim());
  }

  return {
    start(task: ExecutableTask): TaskExecutionHandle {
      const normalizedIntent = task.intent.trim();

      if (normalizedIntent.toLowerCase() === "status") {
        return createImmediateHandle({
          ok: true,
          resultText: `${deviceId} is online`
        });
      }

      if (/^screenshot(?:\s+.+)?$/i.test(normalizedIntent)) {
        return createImmediateHandle(
          captureScreenshot(parseScreenshotTarget(normalizedIntent))
            .then((screenshot) => ({
              ok: true as const,
              resultText: "Screenshot captured.",
              artifact: {
                kind: "image_base64" as const,
                mimeType: screenshot.mimeType,
                fileName: screenshot.fileName,
                contentBase64: screenshot.contentBase64
              }
            }))
            .catch((error: unknown) => ({
              ok: false as const,
              errorText:
                error instanceof Error && error.message
                  ? error.message
                  : "Unable to capture screenshot."
            }))
        );
      }

      const sendFileMatch = /^send-file\s+(.+)$/i.exec(normalizedIntent);

      if (sendFileMatch !== null) {
        const workspaceRoot = getWorkspaceRoot(task);
        return createImmediateHandle(
          resolveFileArtifact({
            query: sendFileMatch[1],
            userHome: os.homedir(),
            additionalRoots: [normalizedUserRoot, workspaceRoot]
          }).then((artifact) => {
            if (artifact === null) {
              return {
                ok: false as const,
                errorText: "File not found."
              };
            }

            return {
              ok: true as const,
              resultText: `Prepared file: ${artifact.fileName}`,
              artifact: {
                kind: "file_base64" as const,
                mimeType: artifact.mimeType,
                fileName: artifact.fileName,
                contentBase64: artifact.contentBase64
              }
            };
          })
        );
      }

      const codexWriteMatch = /^codex-write(?:\s+([\s\S]+))?$/i.exec(normalizedIntent);

      if (codexWriteMatch !== null) {
        const prompt = codexWriteMatch[1]?.trim();

        if (!prompt) {
          return createImmediateHandle({
            ok: false,
            errorText: "Codex prompt is empty."
          });
        }

        const workspaceRoot = getWorkspaceRoot(task);
        let cancelled = false;
        let previewHandle: CodexWritePreviewHandle | null = null;

        return {
          kind: "deferred",
          result: (async () => {
            if (!(await workspaceExists(workspaceRoot))) {
              return {
                ok: false as const,
                errorText: "Codex workspace does not exist."
              };
            }

            if (cancelled) {
              return {
                ok: false as const,
                errorText: "Cancelled by operator."
              };
            }

            previewHandle = startCodexWritePreviewImpl({
              taskId: task.task_id,
              prompt,
              workspaceRoot
            });

            return previewHandle.result.then((previewResult) => {
              if (previewResult.kind === "no_changes") {
                return {
                  ok: true as const,
                  resultText: trimResultText(previewResult.summaryText, maxResultLength)
                };
              }

              return {
                ok: true as const,
                requiresLocalApproval: true as const,
                waitingText: buildLocalApprovalWaitingText(previewResult.draft.changedFiles),
                draft: previewResult.draft
              };
            });
          })().catch((error: unknown) => ({
              ok: false as const,
              errorText:
                error instanceof Error && error.message
                  ? error.message
                  : "Codex execution failed."
            })),
          cancel: () => {
            cancelled = true;
            previewHandle?.cancel();
          }
        };
      }

      const codexMatch = /^codex(?:\s+([\s\S]+))?$/i.exec(normalizedIntent);

      if (codexMatch !== null) {
        const prompt = codexMatch[1]?.trim();

        if (!prompt) {
          return createImmediateHandle({
            ok: false,
            errorText: "Codex prompt is empty."
          });
        }

        const workspaceRoot = getWorkspaceRoot(task);
        let cancelled = false;
        let codexHandle: CodexExecutionHandle | null = null;

        return {
          kind: "deferred",
          result: (async () => {
            if (!(await workspaceExists(workspaceRoot))) {
              return {
                ok: false as const,
                errorText: "Codex workspace does not exist."
              };
            }

            if (cancelled) {
              return {
                ok: false as const,
                errorText: "Cancelled by operator."
              };
            }

            codexHandle = startCodexRunImpl({
              prompt,
              workspaceRoot
            });

            return codexHandle.result.then((resultText) => ({
              ok: true as const,
              resultText: trimResultText(resultText, maxResultLength)
            }));
          })().catch((error: unknown) => ({
              ok: false as const,
              errorText:
                error instanceof Error && error.message
                  ? error.message
                  : "Codex execution failed."
            })),
          cancel: () => {
            cancelled = true;
            codexHandle?.cancel();
          }
        };
      }

      const readMatch = /^read\s+(.+)$/i.exec(normalizedIntent);

      if (readMatch !== null) {
        const targetPath = resolveReadListTarget(normalizedUserRoot, readMatch[1]);

        if (targetPath === null) {
          return createImmediateHandle({
            ok: false,
            errorText: "Path is outside the allowed runtime area."
          });
        }

        return createImmediateHandle(
          fs.readFile(targetPath, "utf8")
            .then((contents) => ({
              ok: true as const,
              resultText: trimResultText(contents, maxResultLength)
            }))
            .catch((error: unknown) => {
              if ((error as NodeJS.ErrnoException).code === "ENOENT") {
                return {
                  ok: false as const,
                  errorText: "File not found."
                };
              }

              return {
                ok: false as const,
                errorText: "Unable to read file."
              };
            })
        );
      }

      const listMatch = /^list\s+(.+)$/i.exec(normalizedIntent);

      if (listMatch !== null) {
        const targetPath = resolveReadListTarget(normalizedUserRoot, listMatch[1]);

        if (targetPath === null) {
          return createImmediateHandle({
            ok: false,
            errorText: "Path is outside the allowed runtime area."
          });
        }

        return createImmediateHandle(
          fs.readdir(targetPath)
            .then((items) => ({
              ok: true as const,
              resultText: trimResultText(items.sort().join("\n"), maxResultLength)
            }))
            .catch((error: unknown) => {
              if ((error as NodeJS.ErrnoException).code === "ENOENT") {
                return {
                  ok: false as const,
                  errorText: "Directory not found."
                };
              }

              return {
                ok: false as const,
                errorText: "Unable to list directory."
              };
            })
        );
      }

      const writeNoteMatch = /^write-note\s+([^:]+?)\s*::\s*([\s\S]+)$/i.exec(normalizedIntent);

      if (writeNoteMatch !== null) {
        const noteName = writeNoteMatch[1].trim();

        if (!isSafeNoteName(noteName)) {
          return createImmediateHandle({
            ok: false,
            errorText: "Invalid note name."
          });
        }

        return createImmediateHandle(
          fs.mkdir(notesRoot, { recursive: true })
            .then(() => fs.writeFile(path.join(notesRoot, noteName), writeNoteMatch[2], "utf8"))
            .then(() => ({
              ok: true as const,
              resultText: path.posix.join("docs", "notes", noteName)
            }))
        );
      }

      return createImmediateHandle({
        ok: false,
        errorText: "Unsupported task intent."
      });
    },

    async execute(task: ExecutableTask): Promise<TaskExecutionResult> {
      return this.start(task).result;
    }
  };
}
