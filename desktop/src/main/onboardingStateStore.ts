// @vitest-environment node

import fs from "node:fs";
import path from "node:path";

export type OnboardingState = {
  installationFingerprint: string;
  completedInstallationFingerprint: string | null;
  requiresOnboarding: boolean;
};

type StoredOnboardingState = {
  completedInstallationFingerprint: string | null;
};

type OnboardingStateStoreOptions = {
  settingsRoot: string;
  installationFingerprint: string;
};

function normalizeCompletedInstallationFingerprint(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export class OnboardingStateStore {
  private readonly filePath: string;

  private readonly installationFingerprint: string;

  private state: StoredOnboardingState;

  constructor({ settingsRoot, installationFingerprint }: OnboardingStateStoreOptions) {
    this.filePath = path.join(settingsRoot, "onboarding.json");
    this.installationFingerprint = installationFingerprint;
    this.state = this.load();
    this.persist();
  }

  getState(): OnboardingState {
    return {
      installationFingerprint: this.installationFingerprint,
      completedInstallationFingerprint: this.state.completedInstallationFingerprint,
      requiresOnboarding:
        this.state.completedInstallationFingerprint !== this.installationFingerprint,
    };
  }

  markCompleted(): OnboardingState {
    this.state.completedInstallationFingerprint = this.installationFingerprint;
    this.persist();
    return this.getState();
  }

  private load(): StoredOnboardingState {
    if (!fs.existsSync(this.filePath)) {
      return {
        completedInstallationFingerprint: null,
      };
    }

    try {
      const raw = JSON.parse(fs.readFileSync(this.filePath, "utf8")) as {
        completedInstallationFingerprint?: unknown;
      };
      return {
        completedInstallationFingerprint: normalizeCompletedInstallationFingerprint(
          raw.completedInstallationFingerprint
        ),
      };
    } catch {
      return {
        completedInstallationFingerprint: null,
      };
    }
  }

  private persist(): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(this.state, null, 2));
  }
}
