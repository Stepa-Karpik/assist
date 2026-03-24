import fs from "node:fs/promises";
import path from "node:path";

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
  maxResultLength = 1500
}: TaskExecutorOptions) {
  const normalizedUserRoot = path.resolve(userRoot);
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
