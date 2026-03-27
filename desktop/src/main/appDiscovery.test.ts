// @vitest-environment node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { discoverApps } from "./appDiscovery";

const tempRoots: string[] = [];

function createTempRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "karpik-app-discovery-"));
  tempRoots.push(root);
  return root;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("discoverApps", () => {
  it("collects shortcuts and executables from desktop, start menu and program files", async () => {
    const root = createTempRoot();
    const desktopRoot = path.join(root, "Desktop");
    const startMenuRoot = path.join(root, "StartMenu");
    const programFilesRoot = path.join(root, "Program Files");

    fs.mkdirSync(desktopRoot, { recursive: true });
    fs.mkdirSync(path.join(startMenuRoot, "Games"), { recursive: true });
    fs.mkdirSync(path.join(programFilesRoot, "osu!", "bin"), { recursive: true });

    fs.writeFileSync(path.join(desktopRoot, "Visual Studio Code.lnk"), "");
    fs.writeFileSync(path.join(startMenuRoot, "Games", "GitHub Desktop.lnk"), "");
    fs.writeFileSync(path.join(programFilesRoot, "osu!", "bin", "osu!.exe"), "");

    const items = await discoverApps({
      desktopRoot,
      startMenuRoots: [startMenuRoot],
      programFilesRoots: [programFilesRoot],
      maxProgramFilesDepth: 4
    });

    expect(items.map((item) => item.displayName)).toEqual([
      "GitHub Desktop",
      "osu!",
      "Visual Studio Code"
    ]);
    expect(items.find((item) => item.displayName === "Visual Studio Code")?.source).toBe("shortcut");
    expect(items.find((item) => item.displayName === "GitHub Desktop")?.source).toBe("start_menu");
    expect(items.find((item) => item.displayName === "osu!")?.source).toBe("program_files");
    expect(items.find((item) => item.displayName === "osu!")?.aliases).toContain("osu");
  });
});
