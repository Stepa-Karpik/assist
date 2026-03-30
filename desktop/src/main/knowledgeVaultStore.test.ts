// @vitest-environment node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createKnowledgeVaultStore } from "./knowledgeVaultStore";

const tempRoots: string[] = [];

function createVaultRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "karpik-knowledge-vault-"));
  tempRoots.push(root);
  return root;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function findNodeByPath(
  nodes: Array<{ relativePath: string; children?: unknown[] }>,
  relativePath: string
): { relativePath: string; children?: unknown[] } | null {
  for (const node of nodes) {
    if (node.relativePath === relativePath) {
      return node;
    }

    if (Array.isArray(node.children)) {
      const nested = findNodeByPath(node.children as Array<{ relativePath: string; children?: unknown[] }>, relativePath);

      if (nested) {
        return nested;
      }
    }
  }

  return null;
}

describe("createKnowledgeVaultStore", () => {
  it("lists top-level user and assist roots from the vault", async () => {
    const vaultRoot = createVaultRoot();
    const userTopicRoot = path.join(vaultRoot, "user", "AI", "models", "MCP");
    const assistDocsRoot = path.join(vaultRoot, "assist", "docs", "websites");
    fs.mkdirSync(userTopicRoot, { recursive: true });
    fs.mkdirSync(assistDocsRoot, { recursive: true });
    fs.writeFileSync(path.join(userTopicRoot, "MCP.md"), "# MCP\n");
    fs.writeFileSync(path.join(assistDocsRoot, "habr.com.md"), "# Habr\n");

    const store = createKnowledgeVaultStore({ vaultRoot });

    const roots = await store.listRoots();

    expect(roots.map((root) => root.id)).toEqual(["user", "assist"]);
    expect(
      findNodeByPath(roots, "user/AI/models/MCP/MCP.md")
    ).toEqual(
      expect.objectContaining({
        kind: "note",
        title: "MCP"
      })
    );
    expect(
      findNodeByPath(roots, "assist/docs/websites/habr.com.md")
    ).toEqual(
      expect.objectContaining({
        kind: "note",
        title: "habr.com"
      })
    );
  });

  it("reads a note only inside the vault root", async () => {
    const vaultRoot = createVaultRoot();
    const notePath = path.join(vaultRoot, "user", "AI", "models", "MCP", "MCP.md");
    fs.mkdirSync(path.dirname(notePath), { recursive: true });
    fs.writeFileSync(notePath, "# MCP\n\nModel Context Protocol");

    const store = createKnowledgeVaultStore({ vaultRoot });

    await expect(store.readNote("user/AI/models/MCP/MCP.md")).resolves.toEqual({
      relativePath: "user/AI/models/MCP/MCP.md",
      title: "MCP",
      content: "# MCP\n\nModel Context Protocol"
    });
    await expect(store.readNote("../secrets/auth.json")).rejects.toThrow(
      "Knowledge note is outside the configured vault."
    );
  });
});
