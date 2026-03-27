// @vitest-environment node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { AppRegistryStore } from "./appRegistryStore";

const tempRoots: string[] = [];

function createSettingsRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "karpik-app-registry-"));
  tempRoots.push(root);
  return root;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("AppRegistryStore", () => {
  it("saves a linked manual app with normalized aliases", () => {
    const store = new AppRegistryStore({
      settingsRoot: createSettingsRoot()
    });

    const state = store.saveApp({
      displayName: "osu! lazer",
      launchPath: "C:\\Games\\osu!\\osu!.exe",
      aliases: ["osu", "ОСУ", "osu", "осу лазер"],
      linked: true,
      source: "manual"
    });

    expect(state.items).toHaveLength(1);
    expect(state.items[0]).toEqual(
      expect.objectContaining({
        displayName: "osu! lazer",
        launchPath: "C:\\Games\\osu!\\osu!.exe",
        aliases: ["osu", "ОСУ", "осу лазер"],
        linked: true,
        source: "manual"
      })
    );
  });

  it("replaces discovered entries while keeping linked manual apps", () => {
    const store = new AppRegistryStore({
      settingsRoot: createSettingsRoot()
    });

    store.saveApp({
      displayName: "osu! lazer",
      launchPath: "C:\\Games\\osu!\\osu!.exe",
      aliases: ["osu"],
      linked: true,
      source: "manual"
    });

    store.replaceDiscoveredApps([
      {
        displayName: "Discord",
        launchPath: "C:\\Users\\TBG\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs\\Discord.lnk",
        aliases: ["discord", "дискорд"],
        source: "start_menu"
      }
    ]);

    const firstState = store.getState();
    expect(firstState.items.map((item) => item.displayName)).toEqual(["Discord", "osu! lazer"]);

    store.replaceDiscoveredApps([
      {
        displayName: "Google Chrome",
        launchPath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        aliases: ["chrome", "хром"],
        source: "program_files"
      }
    ]);

    const secondState = store.getState();
    expect(secondState.items.map((item) => item.displayName)).toEqual([
      "Google Chrome",
      "osu! lazer"
    ]);
  });

  it("persists and restores entries from disk", () => {
    const settingsRoot = createSettingsRoot();
    const firstStore = new AppRegistryStore({
      settingsRoot
    });

    const saved = firstStore.saveApp({
      displayName: "Visual Studio Code",
      launchPath: "C:\\Users\\TBG\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe",
      aliases: ["code", "код"],
      linked: true,
      source: "manual"
    });

    const restoredStore = new AppRegistryStore({
      settingsRoot
    });
    const restored = restoredStore.getState();

    expect(restored.items).toEqual(saved.items);
  });
});
