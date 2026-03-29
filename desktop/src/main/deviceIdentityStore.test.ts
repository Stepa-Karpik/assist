// @vitest-environment node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { DeviceIdentityStore } from "./deviceIdentityStore";

const tempRoots: string[] = [];

function createIdentityRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "karpik-device-identity-"));
  tempRoots.push(root);
  return root;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("DeviceIdentityStore", () => {
  it("creates a stable non-empty device id and persists it across reloads", () => {
    const identityRoot = createIdentityRoot();

    const firstStore = new DeviceIdentityStore({
      identityRoot
    });
    const firstIdentity = firstStore.getState();

    expect(firstIdentity.deviceId).toMatch(/^device-[a-z0-9-]+$/);

    const secondStore = new DeviceIdentityStore({
      identityRoot
    });
    const secondIdentity = secondStore.getState();

    expect(secondIdentity).toEqual(firstIdentity);
  });
});
