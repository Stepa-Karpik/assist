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
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1)}…`;
}

export function createTaskExecutor({
  deviceId,
  userRoot,
  maxResultLength = 1500
}: TaskExecutorOptions) {
  const normalizedUserRoot = path.resolve(userRoot);

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

      if (readMatch === null) {
        return {
          ok: false,
          errorText: "Unsupported task intent."
        };
      }

      const targetPath = path.resolve(normalizedUserRoot, readMatch[1].trim());

      if (!isPathInsideRoot(normalizedUserRoot, targetPath)) {
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
  };
}
