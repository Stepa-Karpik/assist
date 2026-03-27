// @vitest-environment node

import { EventEmitter } from "node:events";

import { describe, expect, it, vi } from "vitest";

import { createUpdateService } from "./updateService";

class FakeUpdater extends EventEmitter {
  readonly setFeedURL = vi.fn();

  readonly checkForUpdates = vi.fn();

  readonly quitAndInstall = vi.fn();
}

describe("createUpdateService", () => {
  it("starts disabled when no feed URL is configured", () => {
    const updater = new FakeUpdater();
    const service = createUpdateService({
      currentVersion: "0.1.0",
      feedUrl: null,
      isPackaged: true,
      platform: "win32",
      updater
    });

    expect(service.getState()).toEqual({
      currentVersion: "0.1.0",
      feedUrl: null,
      isSupported: false,
      phase: "disabled",
      lastCheckedAt: null,
      availableReleaseName: null,
      message: "Update feed is not configured."
    });
    expect(updater.setFeedURL).not.toHaveBeenCalled();
  });

  it("tracks checking, download and install-ready transitions", async () => {
    const updater = new FakeUpdater();
    const service = createUpdateService({
      currentVersion: "0.1.0",
      feedUrl: "https://karpik.example.com/desktop-updates/win32/x64",
      isPackaged: true,
      platform: "win32",
      updater,
      now: () => new Date("2026-03-24T18:40:00.000Z")
    });

    await service.checkForUpdates();
    expect(service.getState().phase).toBe("checking");
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1);

    updater.emit("update-available", {}, "", "0.2.0");
    expect(service.getState()).toEqual({
      currentVersion: "0.1.0",
      feedUrl: "https://karpik.example.com/desktop-updates/win32/x64",
      isSupported: true,
      phase: "downloading",
      lastCheckedAt: "2026-03-24T18:40:00.000Z",
      availableReleaseName: "0.2.0",
      message: "Downloading update 0.2.0."
    });

    updater.emit("update-downloaded", {}, "", "0.2.0");
    expect(service.getState()).toEqual({
      currentVersion: "0.1.0",
      feedUrl: "https://karpik.example.com/desktop-updates/win32/x64",
      isSupported: true,
      phase: "downloaded",
      lastCheckedAt: "2026-03-24T18:40:00.000Z",
      availableReleaseName: "0.2.0",
      message: "Update 0.2.0 is ready to install."
    });

    service.installUpdate();
    expect(updater.quitAndInstall).toHaveBeenCalledTimes(1);
  });

  it("returns to idle when no update is available", async () => {
    const updater = new FakeUpdater();
    const service = createUpdateService({
      currentVersion: "0.1.0",
      feedUrl: "https://karpik.example.com/desktop-updates/win32/x64",
      isPackaged: true,
      platform: "win32",
      updater,
      now: () => new Date("2026-03-24T18:41:00.000Z")
    });

    await service.checkForUpdates();
    updater.emit("update-not-available");

    expect(service.getState()).toEqual({
      currentVersion: "0.1.0",
      feedUrl: "https://karpik.example.com/desktop-updates/win32/x64",
      isSupported: true,
      phase: "idle",
      lastCheckedAt: "2026-03-24T18:41:00.000Z",
      availableReleaseName: null,
      message: "No updates available."
    });
  });

  it("keeps a downloaded update install-ready on repeated checks", async () => {
    const updater = new FakeUpdater();
    const service = createUpdateService({
      currentVersion: "0.1.0",
      feedUrl: "https://karpik.example.com/desktop-updates/win32/x64",
      isPackaged: true,
      platform: "win32",
      updater,
      now: () => new Date("2026-03-24T18:42:00.000Z")
    });

    await service.checkForUpdates();
    updater.emit("update-downloaded", {}, "", "0.2.0");
    updater.checkForUpdates.mockClear();

    await service.checkForUpdates();

    expect(service.getState()).toEqual({
      currentVersion: "0.1.0",
      feedUrl: "https://karpik.example.com/desktop-updates/win32/x64",
      isSupported: true,
      phase: "downloaded",
      lastCheckedAt: "2026-03-24T18:42:00.000Z",
      availableReleaseName: "0.2.0",
      message: "Update 0.2.0 is ready to install."
    });
    expect(updater.checkForUpdates).not.toHaveBeenCalled();
  });
});
