import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export type DeviceIdentityState = {
  deviceId: string;
  deviceLabel: string;
  createdAt: string;
};

type DeviceIdentityStoreOptions = {
  settingsRoot: string;
  legacyDeviceId?: string | null;
};

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function createDefaultState(legacyDeviceId?: string | null): DeviceIdentityState {
  const deviceId = normalizeText(legacyDeviceId) ?? `device-${randomUUID()}`;
  const deviceLabel = normalizeText(os.hostname()) ?? "desktop";

  return {
    deviceId,
    deviceLabel,
    createdAt: new Date().toISOString()
  };
}

function normalizeState(
  value: Partial<DeviceIdentityState> | undefined,
  legacyDeviceId?: string | null
): DeviceIdentityState {
  const fallback = createDefaultState(legacyDeviceId);

  return {
    deviceId: normalizeText(value?.deviceId) ?? fallback.deviceId,
    deviceLabel: normalizeText(value?.deviceLabel) ?? fallback.deviceLabel,
    createdAt: normalizeText(value?.createdAt) ?? fallback.createdAt
  };
}

export class DeviceIdentityStore {
  private readonly filePath: string;

  private readonly legacyDeviceId: string | null;

  private state: DeviceIdentityState;

  constructor({ settingsRoot, legacyDeviceId = null }: DeviceIdentityStoreOptions) {
    this.filePath = path.join(settingsRoot, "device-identity.json");
    this.legacyDeviceId = legacyDeviceId;
    this.state = this.load();
    this.persist();
  }

  getState(): DeviceIdentityState {
    return { ...this.state };
  }

  saveDeviceLabel(deviceLabel: string): DeviceIdentityState {
    this.state = normalizeState(
      {
        ...this.state,
        deviceLabel
      },
      this.legacyDeviceId
    );
    this.persist();
    return this.getState();
  }

  private load(): DeviceIdentityState {
    if (!fs.existsSync(this.filePath)) {
      return createDefaultState(this.legacyDeviceId);
    }

    try {
      const raw = JSON.parse(fs.readFileSync(this.filePath, "utf8")) as Partial<DeviceIdentityState>;
      return normalizeState(raw, this.legacyDeviceId);
    } catch {
      return createDefaultState(this.legacyDeviceId);
    }
  }

  private persist(): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(this.state, null, 2));
  }
}
