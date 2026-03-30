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
  it("returns snippets from user and assist notes for known topics", async () => {
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
    fs.writeFileSync(
      userNote,
      "# FastAPI\n\n## Практическая выжимка\n\nFastAPI хорошо подходит для типизированных API."
    );
    fs.writeFileSync(
      assistNote,
      "# FastAPI\n\n## Внутренние выводы\n\nПолезно смотреть changelog и docs перед ответом."
    );

    const retriever = createChatKnowledgeRetriever({
      getVaultRoot: () => vaultRoot
    });

    const lookup = await retriever.lookup("что нового в FastAPI?");

    expect(lookup.context).toContain("user:");
    expect(lookup.context).toContain("assist:");
    expect(lookup.context).toContain("FastAPI хорошо подходит");
    expect(lookup.context).toContain("Полезно смотреть changelog");
    expect(lookup.sourceUrls).toEqual([]);
  });

  it("returns an empty lookup result when no matching vault context exists", async () => {
    const retriever = createChatKnowledgeRetriever({
      getVaultRoot: () => null,
      fetchImpl: async () => new Response("", { status: 404 })
    });

    await expect(retriever.lookup("что нового в FastAPI?")).resolves.toEqual({
      context: null,
      sourceUrls: []
    });
  });

  it("falls back to external docs when local vault context is missing", async () => {
    const retriever = createChatKnowledgeRetriever({
      getVaultRoot: () => createVaultRoot(),
      fetchImpl: async () =>
        new Response(
          "<html><body><h1>FastAPI Release Notes</h1><p>FastAPI 0.120 improved dependency handling and form models.</p></body></html>",
          { status: 200 }
        )
    });

    const lookup = await retriever.lookup("что нового в FastAPI?");

    expect(lookup.context).toContain("External docs");
    expect(lookup.context).toContain("FastAPI Release Notes");
    expect(lookup.sourceUrls).toContain("https://fastapi.tiangolo.com/release-notes/");
  });
});
