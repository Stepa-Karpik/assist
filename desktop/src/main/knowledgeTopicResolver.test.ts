// @vitest-environment node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { resolveTopicPath } from "./knowledgeTopicResolver";

const tempRoots: string[] = [];

function createVaultRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "karpik-knowledge-resolver-"));
  tempRoots.push(root);
  return root;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("resolveTopicPath", () => {
  it("reuses an existing MCP note instead of creating a duplicate", () => {
    const vaultRoot = createVaultRoot();
    const notePath = path.join(vaultRoot, "user", "AI", "models", "MCP", "MCP.md");
    fs.mkdirSync(path.dirname(notePath), { recursive: true });
    fs.writeFileSync(notePath, "# MCP\n");

    const result = resolveTopicPath({
      vaultRoot,
      tree: "user",
      topicTrail: ["AI", "models", "MCP"],
      preferredLeaf: "MCP"
    });

    expect(result.mode).toBe("append");
    expect(result.relativePath).toBe("user/AI/models/MCP/MCP.md");
  });

  it("creates a human-readable note path when the topic is new", () => {
    const vaultRoot = createVaultRoot();

    const result = resolveTopicPath({
      vaultRoot,
      tree: "assist",
      topicTrail: ["docs", "papers", "FastAPI"],
      preferredLeaf: "FastAPI основы"
    });

    expect(result.mode).toBe("create");
    expect(result.relativePath).toBe("assist/docs/papers/FastAPI/FastAPI основы.md");
  });
});
