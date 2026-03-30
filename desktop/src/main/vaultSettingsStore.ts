import fs from "node:fs";
import path from "node:path";

type VaultSettingsStoreOptions = {
  settingsRoot: string;
};

type StoredVaultSettings = {
  vaultRoot: string | null;
};

function normalizeVaultRoot(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export class VaultSettingsStore {
  private readonly filePath: string;

  private state: StoredVaultSettings;

  constructor({ settingsRoot }: VaultSettingsStoreOptions) {
    this.filePath = path.join(settingsRoot, "vault-settings.json");
    this.state = this.load();
    this.persist();
  }

  getVaultRoot(): string | null {
    return this.state.vaultRoot;
  }

  setVaultRoot(vaultRoot: string): string {
    const normalized = normalizeVaultRoot(vaultRoot);

    if (normalized === null) {
      throw new Error("Vault root is required.");
    }

    this.state.vaultRoot = normalized;
    this.persist();
    return normalized;
  }

  clearVaultRoot(): void {
    this.state.vaultRoot = null;
    this.persist();
  }

  private load(): StoredVaultSettings {
    if (!fs.existsSync(this.filePath)) {
      return {
        vaultRoot: null
      };
    }

    try {
      const raw = JSON.parse(fs.readFileSync(this.filePath, "utf8")) as {
        vaultRoot?: unknown;
      };

      return {
        vaultRoot: normalizeVaultRoot(raw.vaultRoot)
      };
    } catch {
      return {
        vaultRoot: null
      };
    }
  }

  private persist(): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(this.state, null, 2));
  }
}
