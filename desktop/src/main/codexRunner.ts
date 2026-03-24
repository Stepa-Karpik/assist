import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export type CodexRunRequest = {
  prompt: string;
  workspaceRoot: string;
  sandboxMode?: "read-only" | "workspace-write";
};

type CodexRunnerOptions = {
  codexExecutable?: string;
  timeoutMs?: number;
  tempRoot?: string;
};

type SpawnResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
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

function normalizeText(value: string): string | null {
  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : null;
}

function runCommand(
  codexExecutable: string,
  args: string[],
  timeoutMs: number
): Promise<SpawnResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(codexExecutable, args, {
      shell: process.platform === "win32",
      windowsHide: true
    });
    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdoutChunks.push(String(chunk));
    });
    child.stderr.on("data", (chunk) => {
      stderrChunks.push(String(chunk));
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        reject(new Error("Codex CLI is unavailable."));
        return;
      }

      reject(error);
    });
    child.on("close", (exitCode) => {
      clearTimeout(timeout);
      resolve({
        exitCode,
        stdout: stdoutChunks.join(""),
        stderr: stderrChunks.join(""),
        timedOut
      });
    });
  });
}

export function createCodexRunner({
  codexExecutable = getDefaultCodexExecutable(),
  timeoutMs = 120_000,
  tempRoot = os.tmpdir()
}: CodexRunnerOptions = {}) {
  return async function runCodex({
    prompt,
    workspaceRoot,
    sandboxMode = "read-only"
  }: CodexRunRequest): Promise<string> {
    const tempDirectory = await fs.mkdtemp(path.join(tempRoot, "karpik-codex-"));
    const outputPath = path.join(tempDirectory, "last-message.txt");

    try {
      const result = await runCommand(
        codexExecutable,
        [
          "exec",
          "--ephemeral",
          "--skip-git-repo-check",
          "--sandbox",
          sandboxMode,
          "--full-auto",
          "-C",
          workspaceRoot,
          "-o",
          outputPath,
          prompt
        ],
        timeoutMs
      );

      if (result.timedOut) {
        throw new Error("Codex execution timed out.");
      }

      if (result.exitCode !== 0) {
        throw new Error(
          normalizeText(result.stderr) ??
            normalizeText(result.stdout) ??
            "Codex execution failed."
        );
      }

      const outputText = normalizeText(await fs.readFile(outputPath, "utf8"));

      if (outputText === null) {
        throw new Error("Codex returned an empty response.");
      }

      return outputText;
    } finally {
      await fs.rm(tempDirectory, {
        recursive: true,
        force: true
      });
    }
  };
}
