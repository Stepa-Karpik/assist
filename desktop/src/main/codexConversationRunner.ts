import { spawn, type SpawnOptionsWithoutStdio } from "node:child_process";
import path from "node:path";

type SandboxMode = "read-only" | "workspace-write" | "danger-full-access";

type CodexConversationRunnerOptions = {
  codexExecutable?: string;
  spawnProcess?: (
    command: string,
    args: string[],
    options: SpawnOptionsWithoutStdio
  ) => SpawnedConversationProcess;
};

type StartConversationInput = {
  prompt: string;
  workspaceRoot: string;
  sessionId?: string;
  sandboxMode?: SandboxMode;
  onDelta?: (chunk: string) => void;
};

type ConversationRunResult = {
  sessionId: string;
  text: string;
  partialText: string;
  cancelled: boolean;
};

type SpawnedConversationProcess = {
  stdin?: {
    write: (chunk: string) => unknown;
    end: () => unknown;
  };
  stdout: {
    on: (event: "data", listener: (chunk: unknown) => void) => unknown;
  };
  stderr: {
    on: (event: "data", listener: (chunk: unknown) => void) => unknown;
  };
  kill: () => void;
  on: (event: "error" | "close", listener: (...args: unknown[]) => void) => unknown;
};

export type CodexConversationHandle = {
  result: Promise<ConversationRunResult>;
  cancel: () => void;
};

type JsonEvent = {
  type?: string;
  thread_id?: string;
  session_id?: string;
  delta?: string;
  message?: string;
  item?: {
    type?: string;
    text?: string;
    message?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  };
};

function getDefaultCodexExecutable(): string {
  if (process.env.KARPIK_CODEX_EXECUTABLE) {
    return process.env.KARPIK_CODEX_EXECUTABLE;
  }

  if (process.platform === "win32" && process.env.APPDATA) {
    return path.join(process.env.APPDATA, "npm", "codex.cmd");
  }

  return "codex";
}

function parseJsonLines(rawChunk: string): JsonEvent[] {
  return rawChunk
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as JsonEvent];
      } catch {
        return [];
      }
    });
}

function getItemText(item: JsonEvent["item"]): string | null {
  if (!item) {
    return null;
  }

  if (typeof item.text === "string" && item.text.trim().length > 0) {
    return item.text;
  }

  if (typeof item.message === "string" && item.message.trim().length > 0) {
    return item.message;
  }

  const contentText = item.content
    ?.filter((part) => part.type === "output_text" && typeof part.text === "string" && part.text.length > 0)
    .map((part) => part.text)
    .join("");

  return contentText && contentText.trim().length > 0 ? contentText : null;
}

function normalizeText(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

export function createCodexConversationRunner({
  codexExecutable = getDefaultCodexExecutable(),
  spawnProcess = spawn
}: CodexConversationRunnerOptions = {}) {
  return {
    start({
      prompt,
      workspaceRoot,
      sessionId,
      sandboxMode = "workspace-write",
      onDelta
    }: StartConversationInput): CodexConversationHandle {
      let cancelCommand: () => void = () => {};

      const result = new Promise<ConversationRunResult>((resolve, reject) => {
        const args =
          sessionId === undefined
            ? ["exec", "--json", "--skip-git-repo-check", "--full-auto", "--sandbox", sandboxMode, "-"]
            : ["exec", "resume", "--json", "--skip-git-repo-check", "--full-auto", sessionId, "-"];
        const child = spawnProcess(codexExecutable, args, {
          cwd: workspaceRoot,
          shell: process.platform === "win32",
          windowsHide: true
        });

        child.stdin?.write(prompt);
        child.stdin?.end();

        let resolved = false;
        let seenSessionId = sessionId ?? null;
        let partialText = "";
        let finalText: string | null = null;
        let cancelled = false;
        let lastError: string | null = null;

        function finishWithError(error: Error) {
          if (resolved) {
            return;
          }

          resolved = true;
          reject(error);
        }

        child.stdout.on("data", (chunk) => {
          const events = parseJsonLines(String(chunk));

          for (const event of events) {
            if (event.type === "thread.started") {
              seenSessionId = event.thread_id ?? seenSessionId;
              continue;
            }

            if (typeof event.session_id === "string" && event.session_id.length > 0) {
              seenSessionId = event.session_id;
            }

            if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
              partialText += event.delta;
              onDelta?.(event.delta);
              continue;
            }

            if (event.type === "error") {
              lastError = normalizeText(event.message) ?? lastError;
              continue;
            }

            if (event.type === "item.completed") {
              const itemText = getItemText(event.item);

              if (itemText !== null) {
                finalText = itemText;
              }
            }
          }
        });

        child.stderr.on("data", (chunk) => {
          const text = normalizeText(String(chunk));

          if (text !== null) {
            lastError = text;
          }
        });

        child.on("error", (error) => {
          const runtimeError = error instanceof Error ? error : new Error(String(error));
          const nodeError = runtimeError as NodeJS.ErrnoException;

          if (nodeError.code === "ENOENT") {
            finishWithError(new Error("Codex CLI is unavailable."));
            return;
          }

          finishWithError(runtimeError);
        });

        child.on("close", (exitCode) => {
          if (resolved) {
            return;
          }

          const effectiveSessionId = seenSessionId;
          const effectiveText = normalizeText(finalText) ?? normalizeText(partialText);

          if (cancelled) {
            if (effectiveSessionId === null) {
              reject(new Error("Codex conversation was cancelled before a session started."));
              return;
            }

            resolved = true;
            resolve({
              sessionId: effectiveSessionId,
              text: effectiveText ?? "",
              partialText: effectiveText ?? "",
              cancelled: true
            });
            return;
          }

          if (exitCode !== 0) {
            reject(new Error(lastError ?? "Codex conversation failed."));
            return;
          }

          if (effectiveSessionId === null) {
            reject(new Error("Codex conversation did not return a session id."));
            return;
          }

          if (effectiveText === null) {
            reject(new Error("Codex conversation returned an empty response."));
            return;
          }

          resolved = true;
          resolve({
            sessionId: effectiveSessionId,
            text: effectiveText,
            partialText: normalizeText(partialText) ?? effectiveText,
            cancelled: false
          });
        });

        cancelCommand = () => {
          cancelled = true;
          child.kill();
        };
      });

      return {
        result,
        cancel: () => {
          cancelCommand();
        }
      };
    }
  };
}
