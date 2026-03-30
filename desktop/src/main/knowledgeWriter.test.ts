// @vitest-environment node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { KnowledgeLinker } from "./knowledgeLinker";
import { TRUSTED_SITES_FILE_NAME } from "./knowledgeVaultConstants";
import { KnowledgeWriter } from "./knowledgeWriter";

const tempRoots: string[] = [];

function createVaultRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "karpik-knowledge-writer-"));
  tempRoots.push(root);
  return root;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("KnowledgeWriter", () => {
  it("appends a new section into an existing user note", async () => {
    const vaultRoot = createVaultRoot();
    const notePath = path.join(vaultRoot, "user", "AI", "models", "MCP", "MCP.md");
    fs.mkdirSync(path.dirname(notePath), { recursive: true });
    fs.writeFileSync(notePath, "# MCP\n\n## Основы\n\nБазовое описание.\n");
    const writer = new KnowledgeWriter({ vaultRoot });

    const result = await writer.writeUserTopic({
      topicTrail: ["AI", "models", "MCP"],
      preferredLeaf: "MCP",
      sectionTitle: "Подводные камни",
      body: "Не злоупотребляй tool calls без причины."
    });

    const noteContent = fs.readFileSync(notePath, "utf8");
    expect(result.relativePath).toBe("user/AI/models/MCP/MCP.md");
    expect(noteContent).toContain("## Подводные камни");
    expect(noteContent).toContain("Не злоупотребляй tool calls без причины.");
  });

  it("creates a new assist note with a heading and section body", async () => {
    const vaultRoot = createVaultRoot();
    const writer = new KnowledgeWriter({ vaultRoot });

    const result = await writer.writeAssistTopic({
      topicTrail: ["docs", "papers", "FastAPI"],
      preferredLeaf: "FastAPI принципы",
      sectionTitle: "Ключевые идеи",
      body: "FastAPI опирается на type hints и Pydantic."
    });

    const notePath = path.join(
      vaultRoot,
      "assist",
      "docs",
      "papers",
      "FastAPI",
      "FastAPI принципы.md"
    );
    const noteContent = fs.readFileSync(notePath, "utf8");

    expect(result.relativePath).toBe("assist/docs/papers/FastAPI/FastAPI принципы.md");
    expect(noteContent).toContain("# FastAPI принципы");
    expect(noteContent).toContain("## Ключевые идеи");
    expect(noteContent).toContain("FastAPI опирается на type hints и Pydantic.");
  });

  it("passes source urls into the linker when writing an assist topic", async () => {
    const vaultRoot = createVaultRoot();
    const writer = new KnowledgeWriter({
      vaultRoot,
      linker: new KnowledgeLinker({ vaultRoot })
    });

    await writer.writeAssistTopic({
      topicTrail: ["AI", "models", "MCP"],
      preferredLeaf: "MCP",
      sectionTitle: "Источники",
      body: "Выжимка по статье.",
      sourceUrls: ["https://habr.com/ru/articles/899088/"]
    });

    const trustedSitesFile = path.join(
      vaultRoot,
      "assist",
      "docs",
      "registry",
      TRUSTED_SITES_FILE_NAME
    );
    expect(fs.readFileSync(trustedSitesFile, "utf8")).toContain("[[habr.com]]");
  });
});
