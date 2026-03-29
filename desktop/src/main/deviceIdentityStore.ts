// @vitest-environment node

import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export type DeviceIdentityState = {
  deviceId: string;
};

type DeviceIdentityStoreOptions = {
  identityRoot: string;
};

function normalizeDeviceId(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function createDeviceId(): string {
  return `device-${randomUUID()}`;
}

export class DeviceIdentityStore {
  private readonly filePath: string;

  private state: DeviceIdentityState;

  constructor({ identityRoot }: DeviceIdentityStoreOptions) {
    this.filePath = path.join(identityRoot, "identity", "device-identity.json");
    this.state = this.load();
    this.persist();
  }

  getState(): DeviceIdentityState {
    return {
      ...this.state
    };
  }

  private load(): DeviceIdentityState {
    if (!fs.existsSync(this.filePath)) {
      return {
        deviceId: createDeviceId()
      };
    }

    try {
      const raw = JSON.parse(fs.readFileSync(this.filePath, "utf8")) as {
        deviceId?: unknown;
      };
      const deviceId = normalizeDeviceId(raw.deviceId);

      if (deviceId !== null) {
        return { deviceId };
      }
    } catch {
      // Ignore malformed files and regenerate a stable identity once.
    }

    return {
      deviceId: createDeviceId()
    };
  }

  private persist(): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(this.state, null, 2));
  }
}
