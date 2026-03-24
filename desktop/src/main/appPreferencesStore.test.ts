// @vitest-environment node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { AppPreferencesStore } from "./appPreferencesStore";

const tempRoots: string[] = [];

function createSettingsRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "karpik-app-preferences-"));
  tempRoots.push(root);
  return root;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("AppPreferencesStore", () => {
  it("returns default operator preferences", () => {
    const store = new AppPreferencesStore({
      settingsRoot: createSettingsRoot()
    });

    expect(store.getState()).toEqual({
      launchAtLogin: false,
      startHiddenOnLaunch: true,
      closeToTrayOnClose: true
    });
  });

  it("persists saved preferences to disk", () => {
    const settingsRoot = createSettingsRoot();
    const store = new AppPreferencesStore({
      settingsRoot
    });

    store.save({
      launchAtLogin: true,
      startHiddenOnLaunch: false,
      closeToTrayOnClose: false
    });

    const reloadedStore = new AppPreferencesStore({
      settingsRoot
    });

    expect(reloadedStore.getState()).toEqual({
      launchAtLogin: true,
      startHiddenOnLaunch: false,
      closeToTrayOnClose: false
    });
  });

  it("applies login item settings with start-hidden args when launch at login is enabled", () => {
    const setLoginItemSettings = vi.fn();
    const store = new AppPreferencesStore({
      settingsRoot: createSettingsRoot()
    });

    store.save({
      launchAtLogin: true,
      startHiddenOnLaunch: true,
      closeToTrayOnClose: true
    });
    store.applyLoginItemSettings({
      setLoginItemSettings
    });

    expect(setLoginItemSettings).toHaveBeenCalledWith({
      openAtLogin: true,
      args: ["--start-hidden"]
    });
  });
});
