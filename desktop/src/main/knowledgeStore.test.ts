// @vitest-environment node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createKnowledgeStore } from "./knowledgeStore";

const tempRoots: string[] = [];

function createRuntimeRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "karpik-knowledge-store-"));
  tempRoots.push(root);
  return root;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("createKnowledgeStore", () => {
  it("lists section entries from the allowlisted runtime roots", async () => {
    const runtimeRoot = createRuntimeRoot();
    const knowledgeRoot = path.join(runtimeRoot, "docs", "user", "knowledge");
    const notesRoot = path.join(runtimeRoot, "docs", "user", "docs", "notes");
    fs.mkdirSync(knowledgeRoot, { recursive: true });
    fs.mkdirSync(notesRoot, { recursive: true });
    fs.writeFileSync(path.join(knowledgeRoot, "review.md"), "review body");
    fs.writeFileSync(path.join(notesRoot, "daily.txt"), "daily body");

    const store = createKnowledgeStore({
      runtimeRoot
    });

    const sections = await store.listSections();

    expect(sections.find((section) => section.id === "knowledge")?.entries).toEqual([
      expect.objectContaining({
        relativePath: "review.md",
        displayName: "review.md"
      })
    ]);
    expect(sections.find((section) => section.id === "notes")?.entries).toEqual([
      expect.objectContaining({
        relativePath: "daily.txt",
        displayName: "daily.txt"
      })
    ]);
  });

  it("reads a file only inside the declared section root", async () => {
    const runtimeRoot = createRuntimeRoot();
    const knowledgeRoot = path.join(runtimeRoot, "docs", "user", "knowledge");
    fs.mkdirSync(knowledgeRoot, { recursive: true });
    fs.writeFileSync(path.join(knowledgeRoot, "review.md"), "review body");

    const store = createKnowledgeStore({
      runtimeRoot
    });

    expect(
      await store.readEntry({
        sectionId: "knowledge",
        relativePath: "review.md"
      })
    ).toEqual({
      sectionId: "knowledge",
      relativePath: "review.md",
      content: "review body"
    });
  });

  it("rejects traversal outside the section root", async () => {
    const runtimeRoot = createRuntimeRoot();
    const knowledgeRoot = path.join(runtimeRoot, "docs", "user", "knowledge");
    fs.mkdirSync(knowledgeRoot, { recursive: true });

    const store = createKnowledgeStore({
      runtimeRoot
    });

    await expect(
      store.readEntry({
        sectionId: "knowledge",
        relativePath: "..\\..\\secrets\\auth.json"
      })
    ).rejects.toThrow("Knowledge entry is outside the allowed section.");
  });
});
