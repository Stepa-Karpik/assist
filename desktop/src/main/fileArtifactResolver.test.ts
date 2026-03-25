// @vitest-environment node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { resolveFileArtifact } from "./fileArtifactResolver";

const tempRoots: string[] = [];

function createTempRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "karpik-file-artifact-"));
  tempRoots.push(root);
  return root;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("resolveFileArtifact", () => {
  it("finds a desktop file by explicit file name", async () => {
    const root = createTempRoot();
    const desktopRoot = path.join(root, "Desktop");
    fs.mkdirSync(desktopRoot, { recursive: true });
    fs.writeFileSync(path.join(desktopRoot, "hack.pptx"), "slides");

    const result = await resolveFileArtifact({
      query: "desktop::hack.pptx",
      userHome: root,
      additionalRoots: []
    });

    expect(result?.fileName).toBe("hack.pptx");
    expect(result?.mimeType).toBe(
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    );
  });

  it("matches a presentation request to a pptx file using fuzzy tokens", async () => {
    const root = createTempRoot();
    const desktopRoot = path.join(root, "Desktop");
    fs.mkdirSync(desktopRoot, { recursive: true });
    fs.writeFileSync(path.join(desktopRoot, "hack.pptx"), "slides");

    const result = await resolveFileArtifact({
      query: "презентацию хак",
      userHome: root,
      additionalRoots: []
    });

    expect(result?.fileName).toBe("hack.pptx");
  });
});
