// @vitest-environment node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { ensureKnowledgeVault } from "./knowledgeVaultBootstrap";

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

describe("ensureKnowledgeVault", () => {
  it("creates user assist and registry skeleton under vault root", () => {
    const vaultRoot = createVaultRoot();

    ensureKnowledgeVault(vaultRoot);

    expect(fs.existsSync(path.join(vaultRoot, "user"))).toBe(true);
    expect(fs.existsSync(path.join(vaultRoot, "assist"))).toBe(true);
    expect(fs.existsSync(path.join(vaultRoot, "assist", "docs", "registry", "Документации.md"))).toBe(true);
    expect(fs.existsSync(path.join(vaultRoot, "assist", "docs", "registry", "Доверенные сайты.md"))).toBe(true);
  });
});
