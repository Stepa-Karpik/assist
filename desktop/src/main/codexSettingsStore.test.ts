// @vitest-environment node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { CodexSettingsStore } from "./codexSettingsStore";

const tempRoots: string[] = [];

function createSettingsRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "karpik-codex-settings-"));
  tempRoots.push(root);
  return root;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("CodexSettingsStore", () => {
  it("returns the default workspace when no config exists", () => {
    const store = new CodexSettingsStore({
      settingsRoot: createSettingsRoot(),
      defaultWorkspaceRoot: "C:\\Users\\TBG\\AppData\\Roaming\\Karpik\\docs\\user"
    });

    expect(store.getState()).toEqual({
      workspaceRoot: "C:\\Users\\TBG\\AppData\\Roaming\\Karpik\\docs\\user"
    });
  });

  it("persists and reloads the configured workspace path", () => {
    const settingsRoot = createSettingsRoot();
    const firstStore = new CodexSettingsStore({
      settingsRoot,
      defaultWorkspaceRoot: "C:\\default"
    });

    const saved = firstStore.saveConfig({
      workspaceRoot: "D:\\Projects\\assist"
    });
    const secondStore = new CodexSettingsStore({
      settingsRoot,
      defaultWorkspaceRoot: "C:\\default"
    });

    expect(saved).toEqual({
      workspaceRoot: "D:\\Projects\\assist"
    });
    expect(secondStore.getState()).toEqual({
      workspaceRoot: "D:\\Projects\\assist"
    });
  });

  it("falls back to the default workspace when saving a blank value", () => {
    const store = new CodexSettingsStore({
      settingsRoot: createSettingsRoot(),
      defaultWorkspaceRoot: "C:\\default"
    });

    expect(
      store.saveConfig({
        workspaceRoot: "   "
      })
    ).toEqual({
      workspaceRoot: "C:\\default"
    });
  });
});
