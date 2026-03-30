// @vitest-environment node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { VaultSettingsStore } from "./vaultSettingsStore";

const tempRoots: string[] = [];

function createSettingsRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "karpik-vault-settings-"));
  tempRoots.push(root);
  return root;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("VaultSettingsStore", () => {
  it("persists vault root under settings and returns null by default", () => {
    const settingsRoot = createSettingsRoot();
    const store = new VaultSettingsStore({ settingsRoot });

    expect(store.getVaultRoot()).toBeNull();

    store.setVaultRoot("D:\\KarpikVault");
    expect(store.getVaultRoot()).toBe("D:\\KarpikVault");

    const reloadedStore = new VaultSettingsStore({ settingsRoot });
    expect(reloadedStore.getVaultRoot()).toBe("D:\\KarpikVault");
  });
});
