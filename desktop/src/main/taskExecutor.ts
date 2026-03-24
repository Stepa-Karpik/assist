import fs from "node:fs/promises";
import path from "node:path";

import { createCodexRunner, type CodexRunRequest } from "./codexRunner";

type ExecutableTask = {
  task_id: string;
  intent: string;
};

export type TaskExecutionResult =
  | {
      ok: true;
      resultText: string;
    }
  | {
      ok: false;
      errorText: string;
    };

type TaskExecutorOptions = {
  deviceId: string;
  userRoot: string;
  getCodexWorkspaceRoot?: () => string;
  runCodex?: (request: CodexRunRequest) => Promise<string>;
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

function isSafeNoteName(value: string): boolean {
  return /^[a-zA-Z0-9._-]+$/.test(value);
}

export function createTaskExecutor({
  deviceId,
  userRoot,
  getCodexWorkspaceRoot,
  runCodex = createCodexRunner(),
  maxResultLength = 1500
}: TaskExecutorOptions) {
  const normalizedUserRoot = path.resolve(userRoot);
  const resolveCodexWorkspaceRoot = getCodexWorkspaceRoot ?? (() => normalizedUserRoot);
  const notesRoot = path.join(normalizedUserRoot, "docs", "notes");

  return {
    async execute(task: ExecutableTask): Promise<TaskExecutionResult> {
      const normalizedIntent = task.intent.trim();

      if (normalizedIntent.toLowerCase() === "status") {
        return {
          ok: true,
          resultText: `${deviceId} is online`
        };
      }

      const codexMatch = /^codex(?:\s+([\s\S]+))?$/i.exec(normalizedIntent);

      if (codexMatch !== null) {
        const prompt = codexMatch[1]?.trim();

        if (!prompt) {
          return {
            ok: false,
            errorText: "Codex prompt is empty."
          };
        }

        const workspaceRoot = path.resolve(resolveCodexWorkspaceRoot().trim());

        try {
          const workspaceStat = await fs.stat(workspaceRoot);

          if (!workspaceStat.isDirectory()) {
            return {
              ok: false,
              errorText: "Codex workspace does not exist."
            };
          }
        } catch {
          return {
            ok: false,
            errorText: "Codex workspace does not exist."
          };
        }

        try {
          const resultText = await runCodex({
            prompt,
            workspaceRoot
          });

          return {
            ok: true,
            resultText: trimResultText(resultText, maxResultLength)
          };
        } catch (error: unknown) {
          return {
            ok: false,
            errorText:
              error instanceof Error && error.message
                ? error.message
                : "Codex execution failed."
          };
        }
      }

      const readMatch = /^read\s+(.+)$/i.exec(normalizedIntent);

      if (readMatch !== null) {
        const targetPath = normalizeTarget(normalizedUserRoot, readMatch[1]);

        if (targetPath === null) {
          return {
            ok: false,
            errorText: "Path is outside the allowed runtime area."
          };
        }

        try {
          const contents = await fs.readFile(targetPath, "utf8");
          return {
            ok: true,
            resultText: trimResultText(contents, maxResultLength)
          };
        } catch (error: unknown) {
          if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            return {
              ok: false,
              errorText: "File not found."
            };
          }

          return {
            ok: false,
            errorText: "Unable to read file."
          };
        }
      }

      const listMatch = /^list\s+(.+)$/i.exec(normalizedIntent);

      if (listMatch !== null) {
        const targetPath = normalizeTarget(normalizedUserRoot, listMatch[1]);

        if (targetPath === null) {
          return {
            ok: false,
            errorText: "Path is outside the allowed runtime area."
          };
        }

        try {
          const items = (await fs.readdir(targetPath)).sort();
          return {
            ok: true,
            resultText: trimResultText(items.join("\n"), maxResultLength)
          };
        } catch (error: unknown) {
          if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            return {
              ok: false,
              errorText: "Directory not found."
            };
          }

          return {
            ok: false,
            errorText: "Unable to list directory."
          };
        }
      }

      const writeNoteMatch = /^write-note\s+([^:]+?)\s*::\s*([\s\S]+)$/i.exec(normalizedIntent);

      if (writeNoteMatch !== null) {
        const noteName = writeNoteMatch[1].trim();

        if (!isSafeNoteName(noteName)) {
          return {
            ok: false,
            errorText: "Invalid note name."
          };
        }

        await fs.mkdir(notesRoot, { recursive: true });
        await fs.writeFile(path.join(notesRoot, noteName), writeNoteMatch[2], "utf8");

        return {
          ok: true,
          resultText: path.posix.join("docs", "notes", noteName)
        };
      }

      return {
        ok: false,
        errorText: "Unsupported task intent."
      };
    }
  };
}
