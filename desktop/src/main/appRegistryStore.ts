import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export type AppRegistrySource =
  | "manual"
  | "shortcut"
  | "start_menu"
  | "program_files"
  | "discovered";

export type AppRegistryItem = {
  appId: string;
  displayName: string;
  launchPath: string;
  aliases: string[];
  linked: boolean;
  source: AppRegistrySource;
};

export type AppRegistryState = {
  items: AppRegistryItem[];
};

export type AppRegistryInput = {
  appId?: string;
  displayName: string;
  launchPath: string;
  aliases?: string[];
  linked?: boolean;
  source?: AppRegistrySource;
};

export type DiscoveredAppInput = {
  displayName: string;
  launchPath: string;
  aliases?: string[];
  source?: Exclude<AppRegistrySource, "manual">;
};

type PersistedAppRegistryState = {
  items?: Array<Partial<AppRegistryItem>>;
};

type AppRegistryStoreOptions = {
  settingsRoot: string;
};

function normalizeText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function dedupeAliases(aliases: string[] | undefined): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const alias of aliases ?? []) {
    const normalized = normalizeText(alias);
    if (normalized === undefined) {
      continue;
    }

    const compareKey = normalized.toLowerCase();
    if (seen.has(compareKey)) {
      continue;
    }

    seen.add(compareKey);
    result.push(normalized);
  }

  return result;
}

function createAppId(launchPath: string): string {
  return `app-${crypto.createHash("sha1").update(launchPath.toLowerCase()).digest("hex").slice(0, 12)}`;
}

function normalizeItem(input: Partial<AppRegistryItem> | AppRegistryInput): AppRegistryItem | null {
  const displayName = normalizeText(input.displayName);
  const launchPath = normalizeText(input.launchPath);

  if (displayName === undefined || launchPath === undefined) {
    return null;
  }

  return {
    appId: normalizeText(input.appId) ?? createAppId(launchPath),
    displayName,
    launchPath,
    aliases: dedupeAliases(input.aliases),
    linked: input.linked ?? true,
    source: input.source ?? "manual"
  };
}

function sortItems(items: AppRegistryItem[]): AppRegistryItem[] {
  return [...items].sort((left, right) => left.displayName.localeCompare(right.displayName, "ru"));
}

function normalizeState(value: PersistedAppRegistryState | undefined): AppRegistryState {
  const items = Array.isArray(value?.items)
    ? value.items
        .map((item) => normalizeItem(item))
        .filter((item): item is AppRegistryItem => item !== null)
    : [];

  return {
    items: sortItems(items)
  };
}

export class AppRegistryStore {
  private readonly filePath: string;

  private state: AppRegistryState;

  constructor({ settingsRoot }: AppRegistryStoreOptions) {
    this.filePath = path.join(settingsRoot, "app-registry.json");
    this.state = this.load();
    this.persist();
  }

  getState(): AppRegistryState {
    return {
      items: this.state.items.map((item) => ({
        ...item,
        aliases: [...item.aliases]
      }))
    };
  }

  saveApp(input: AppRegistryInput): AppRegistryState {
    const normalized = normalizeItem(input);

    if (normalized === null) {
      return this.getState();
    }

    const items = this.state.items.filter((item) => item.appId !== normalized.appId);
    items.push(normalized);
    this.state = { items: sortItems(items) };
    this.persist();
    return this.getState();
  }

  removeApp(appId: string): AppRegistryState {
    this.state = {
      items: this.state.items.filter((item) => item.appId !== appId)
    };
    this.persist();
    return this.getState();
  }

  replaceDiscoveredApps(discoveredApps: DiscoveredAppInput[]): AppRegistryState {
    const linkedItems = this.state.items.filter((item) => item.linked || item.source === "manual");
    const nextDiscoveredItems = discoveredApps
      .map((item) =>
        normalizeItem({
          displayName: item.displayName,
          launchPath: item.launchPath,
          aliases: item.aliases,
          linked: false,
          source: item.source ?? "discovered"
        })
      )
      .filter((item): item is AppRegistryItem => item !== null);

    const byId = new Map<string, AppRegistryItem>();
    for (const item of [...linkedItems, ...nextDiscoveredItems]) {
      byId.set(item.appId, item);
    }

    this.state = {
      items: sortItems([...byId.values()])
    };
    this.persist();
    return this.getState();
  }

  getApp(appId: string): AppRegistryItem | null {
    return this.state.items.find((item) => item.appId === appId) ?? null;
  }

  private load(): AppRegistryState {
    if (!fs.existsSync(this.filePath)) {
      return { items: [] };
    }

    try {
      const raw = JSON.parse(fs.readFileSync(this.filePath, "utf8")) as PersistedAppRegistryState;
      return normalizeState(raw);
    } catch {
      return { items: [] };
    }
  }

  private persist(): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(this.state, null, 2));
  }
}
