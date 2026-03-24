// @vitest-environment node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { AuthStore } from "./authStore";

function createSecretsRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "karpik-auth-store-"));
}

describe("AuthStore", () => {
  const cleanupPaths: string[] = [];

  afterEach(() => {
    for (const targetPath of cleanupPaths.splice(0)) {
      fs.rmSync(targetPath, { recursive: true, force: true });
    }
  });

  it("saves a password verifier without persisting raw plaintext", () => {
    const secretsRoot = createSecretsRoot();
    cleanupPaths.push(secretsRoot);
    const store = new AuthStore({
      secretsRoot,
      saltFactory: () => Buffer.from("00112233445566778899aabbccddeeff", "hex")
    });

    const state = store.saveConfig({ password: "secret-password" });
    const persisted = fs.readFileSync(path.join(secretsRoot, "auth.json"), "utf8");

    expect(state.passwordConfigured).toBe(true);
    expect(persisted).not.toContain("secret-password");
  });

  it("validates the configured password", () => {
    const secretsRoot = createSecretsRoot();
    cleanupPaths.push(secretsRoot);
    const store = new AuthStore({
      secretsRoot,
      saltFactory: () => Buffer.from("00112233445566778899aabbccddeeff", "hex")
    });
    store.saveConfig({ password: "secret-password" });

    expect(store.validatePassword("secret-password")).toBe(true);
  });

  it("rejects the wrong password", () => {
    const secretsRoot = createSecretsRoot();
    cleanupPaths.push(secretsRoot);
    const store = new AuthStore({
      secretsRoot,
      saltFactory: () => Buffer.from("00112233445566778899aabbccddeeff", "hex")
    });
    store.saveConfig({ password: "secret-password" });

    expect(store.validatePassword("wrong-password")).toBe(false);
  });

  it("validates the configured totp code for the current time window", () => {
    const secretsRoot = createSecretsRoot();
    cleanupPaths.push(secretsRoot);
    const store = new AuthStore({
      secretsRoot,
      now: () => new Date("1970-01-01T00:00:59.000Z")
    });
    store.saveConfig({
      totpSecret: "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"
    });

    expect(store.validateTotp("287082")).toBe(true);
  });

  it("exposes only capability flags through config state", () => {
    const secretsRoot = createSecretsRoot();
    cleanupPaths.push(secretsRoot);
    const store = new AuthStore({ secretsRoot });
    store.saveConfig({
      password: "secret-password",
      totpSecret: "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"
    });

    expect(store.getConfigState()).toEqual({
      passwordConfigured: true,
      totpConfigured: true
    });
  });
});
