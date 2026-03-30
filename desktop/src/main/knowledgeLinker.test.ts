// @vitest-environment node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { KnowledgeLinker } from "./knowledgeLinker";
import { DOCS_REGISTRY_FILE_NAME, TRUSTED_SITES_FILE_NAME } from "./knowledgeVaultConstants";

const tempRoots: string[] = [];

function createVaultRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "karpik-knowledge-linker-"));
  tempRoots.push(root);
  return root;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("KnowledgeLinker", () => {
  it("updates trusted site registry and links source back to topic", async () => {
    const vaultRoot = createVaultRoot();
    const linker = new KnowledgeLinker({ vaultRoot });

    await linker.linkSourceToTopic({
      topicRelativePath: "user/AI/models/MCP/MCP.md",
      sourceUrl: "https://habr.com/ru/articles/899088/",
      sourceTitle: "Примеры MCP на Habr"
    });

    const trustedSitesFile = path.join(
      vaultRoot,
      "assist",
      "docs",
      "registry",
      TRUSTED_SITES_FILE_NAME
    );
    const websiteFile = path.join(vaultRoot, "assist", "docs", "websites", "habr.com.md");
    const docsRegistryFile = path.join(
      vaultRoot,
      "assist",
      "docs",
      "registry",
      DOCS_REGISTRY_FILE_NAME
    );
    const trustedSitesContent = fs.readFileSync(trustedSitesFile, "utf8");
    const websiteContent = fs.readFileSync(websiteFile, "utf8");
    const docsRegistryContent = fs.readFileSync(docsRegistryFile, "utf8");

    expect(trustedSitesContent).toContain("[[habr.com]]");
    expect(websiteContent).toContain("[[MCP]]");
    expect(docsRegistryContent).toContain("https://habr.com/ru/articles/899088/");
  });
});
