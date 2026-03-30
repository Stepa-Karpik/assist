// @vitest-environment node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createChatKnowledgeRetriever } from "./chatKnowledgeRetriever";

const tempRoots: string[] = [];

function createVaultRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "karpik-chat-knowledge-"));
  tempRoots.push(root);
  return root;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("createChatKnowledgeRetriever", () => {
  it("returns snippets from user and assist notes for known topics", () => {
    const vaultRoot = createVaultRoot();
    const userNote = path.join(vaultRoot, "user", "Backend", "Python", "FastAPI", "FastAPI.md");
    const assistNote = path.join(
      vaultRoot,
      "assist",
      "Backend",
      "Python",
      "FastAPI",
      "FastAPI.md"
    );

    fs.mkdirSync(path.dirname(userNote), { recursive: true });
    fs.mkdirSync(path.dirname(assistNote), { recursive: true });
    fs.writeFileSync(userNote, "# FastAPI\n\n## Практическая выжимка\n\nFastAPI хорошо подходит для типизированных API.");
    fs.writeFileSync(
      assistNote,
      "# FastAPI\n\n## Внутренние выводы\n\nПолезно смотреть changelog и docs перед ответом."
    );

    const retriever = createChatKnowledgeRetriever({
      getVaultRoot: () => vaultRoot
    });

    const snippet = retriever.lookup("что нового в FastAPI?");

    expect(snippet).toContain("user:");
    expect(snippet).toContain("assist:");
    expect(snippet).toContain("FastAPI хорошо подходит");
    expect(snippet).toContain("Полезно смотреть changelog");
  });

  it("returns null when no matching vault context exists", () => {
    const retriever = createChatKnowledgeRetriever({
      getVaultRoot: () => null
    });

    expect(retriever.lookup("что нового в FastAPI?")).toBeNull();
  });
});
