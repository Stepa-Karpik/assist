// @vitest-environment node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { OnboardingStateStore } from "./onboardingStateStore";

const tempRoots: string[] = [];

function createSettingsRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "karpik-onboarding-state-"));
  tempRoots.push(root);
  return root;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("OnboardingStateStore", () => {
  it("requires onboarding until the current installation fingerprint is completed", () => {
    const settingsRoot = createSettingsRoot();
    const firstStore = new OnboardingStateStore({
      settingsRoot,
      installationFingerprint: "install-a",
    });

    expect(firstStore.getState().requiresOnboarding).toBe(true);

    firstStore.markCompleted();

    expect(firstStore.getState().requiresOnboarding).toBe(false);

    const reloadedStore = new OnboardingStateStore({
      settingsRoot,
      installationFingerprint: "install-a",
    });
    expect(reloadedStore.getState().requiresOnboarding).toBe(false);

    const reinstallStore = new OnboardingStateStore({
      settingsRoot,
      installationFingerprint: "install-b",
    });
    expect(reinstallStore.getState().requiresOnboarding).toBe(true);
  });
});
