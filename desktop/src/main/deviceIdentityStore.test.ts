// @vitest-environment node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { DeviceIdentityStore } from "./deviceIdentityStore";

const tempRoots: string[] = [];

function createSettingsRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "karpik-device-identity-"));
  tempRoots.push(root);
  return root;
}

describe("DeviceIdentityStore", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    for (const root of tempRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("creates and persists a stable device identity", () => {
    const settingsRoot = createSettingsRoot();
    const firstStore = new DeviceIdentityStore({ settingsRoot });
    const firstState = firstStore.getState();
    const secondStore = new DeviceIdentityStore({ settingsRoot });
    const secondState = secondStore.getState();

    expect(firstState.deviceId).toMatch(/^device-[a-f0-9-]+$/);
    expect(secondState.deviceId).toBe(firstState.deviceId);
    expect(secondState.createdAt).toBe(firstState.createdAt);
  });

  it("uses the hostname as the default device label", () => {
    vi.spyOn(os, "hostname").mockReturnValue("ws-01");
    const settingsRoot = createSettingsRoot();
    const store = new DeviceIdentityStore({ settingsRoot });

    expect(store.getState().deviceLabel).toBe("ws-01");
  });
});
