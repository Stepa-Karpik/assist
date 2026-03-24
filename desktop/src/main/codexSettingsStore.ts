import fs from "node:fs";
import path from "node:path";

type CodexSettingsStoreOptions = {
  settingsRoot: string;
  defaultWorkspaceRoot: string;
};

export type CodexConfigInput = {
  workspaceRoot?: string;
};

type PersistedCodexConfig = {
  workspaceRoot?: string;
};

export type CodexConfigState = {
  workspaceRoot: string;
};

function normalizeWorkspaceRoot(value: string | undefined): string | undefined {
  const trimmedValue = value?.trim();
  return trimmedValue ? trimmedValue : undefined;
}

export class CodexSettingsStore {
  private readonly filePath: string;

  private readonly defaultWorkspaceRoot: string;

  private config: PersistedCodexConfig;

  constructor({ settingsRoot, defaultWorkspaceRoot }: CodexSettingsStoreOptions) {
    this.filePath = path.join(settingsRoot, "codex.json");
    this.defaultWorkspaceRoot = defaultWorkspaceRoot;
    this.config = this.loadConfig();
  }

  getState(): CodexConfigState {
    return {
      workspaceRoot: this.config.workspaceRoot ?? this.defaultWorkspaceRoot
    };
  }

  saveConfig({ workspaceRoot }: CodexConfigInput): CodexConfigState {
    this.config = {
      workspaceRoot: normalizeWorkspaceRoot(workspaceRoot)
    };
    this.persistConfig();
    return this.getState();
  }

  private loadConfig(): PersistedCodexConfig {
    if (!fs.existsSync(this.filePath)) {
      return {};
    }

    const rawConfig = fs.readFileSync(this.filePath, "utf8");
    return JSON.parse(rawConfig) as PersistedCodexConfig;
  }

  private persistConfig(): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(this.config, null, 2));
  }
}
