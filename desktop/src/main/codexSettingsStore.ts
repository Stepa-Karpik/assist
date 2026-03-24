import fs from "node:fs";
import path from "node:path";

type CodexSettingsStoreOptions = {
  settingsRoot: string;
  defaultWorkspaceRoot: string;
};

export type CodexWorkspace = {
  id: string;
  name: string;
  rootPath: string;
};

export type CodexConfigInput = {
  workspaces?: Array<Partial<CodexWorkspace>>;
  defaultWorkspaceId?: string;
  workspaceRoot?: string;
};

export type CodexChatBindingInput = {
  chatId: number;
  workspaceId: string;
};

type PersistedCodexConfig = {
  workspaces?: Array<Partial<CodexWorkspace>>;
  defaultWorkspaceId?: string;
  chatBindings?: Record<string, string>;
  workspaceRoot?: string;
};

export type CodexConfigState = {
  workspaces: CodexWorkspace[];
  defaultWorkspaceId: string;
  chatBindings: Record<string, string>;
};

const defaultWorkspaceId = "default-workspace";
const defaultWorkspaceName = "Default";

function normalizeText(value: string | undefined): string | undefined {
  const trimmedValue = value?.trim();
  return trimmedValue ? trimmedValue : undefined;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function createWorkspaceId(
  name: string,
  rootPath: string,
  usedIds: Set<string>
): string {
  const baseId =
    slugify(name) ||
    slugify(path.basename(rootPath)) ||
    slugify(rootPath) ||
    "workspace";

  let candidate = baseId;
  let suffix = 2;

  while (usedIds.has(candidate)) {
    candidate = `${baseId}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

function createDefaultWorkspace(rootPath: string): CodexWorkspace {
  return {
    id: defaultWorkspaceId,
    name: defaultWorkspaceName,
    rootPath
  };
}

function normalizeWorkspaces(
  workspaces: Array<Partial<CodexWorkspace>> | undefined,
  fallbackWorkspaceRoot: string
): CodexWorkspace[] {
  if (!Array.isArray(workspaces) || workspaces.length === 0) {
    return [createDefaultWorkspace(fallbackWorkspaceRoot)];
  }

  const usedIds = new Set<string>();
  const normalized = workspaces.flatMap((workspace) => {
    const rootPath = normalizeText(workspace.rootPath);
    const name = normalizeText(workspace.name);

    if (rootPath === undefined) {
      return [];
    }

    const normalizedName =
      name ??
      (normalizeText(workspace.id) === defaultWorkspaceId
        ? defaultWorkspaceName
        : path.basename(rootPath) || defaultWorkspaceName);
    const requestedId = normalizeText(workspace.id);
    const normalizedId =
      requestedId && !usedIds.has(requestedId)
        ? requestedId
        : createWorkspaceId(normalizedName, rootPath, usedIds);

    usedIds.add(normalizedId);

    return [
      {
        id: normalizedId,
        name: normalizedName,
        rootPath
      }
    ];
  });

  return normalized.length > 0
    ? normalized
    : [createDefaultWorkspace(fallbackWorkspaceRoot)];
}

function normalizeDefaultWorkspaceId(
  requestedDefaultWorkspaceId: string | undefined,
  workspaces: CodexWorkspace[]
): string {
  const normalizedRequestedId = normalizeText(requestedDefaultWorkspaceId);

  if (
    normalizedRequestedId !== undefined &&
    workspaces.some((workspace) => workspace.id === normalizedRequestedId)
  ) {
    return normalizedRequestedId;
  }

  return workspaces[0].id;
}

function normalizeChatBindings(
  chatBindings: Record<string, string> | undefined,
  workspaces: CodexWorkspace[]
): Record<string, string> {
  if (chatBindings === undefined) {
    return {};
  }

  const workspaceIds = new Set(workspaces.map((workspace) => workspace.id));

  return Object.fromEntries(
    Object.entries(chatBindings).filter((entry) => workspaceIds.has(entry[1]))
  );
}

function normalizeConfig(
  config: PersistedCodexConfig | undefined,
  fallbackWorkspaceRoot: string
): CodexConfigState {
  const legacyWorkspaceRoot = normalizeText(config?.workspaceRoot);
  const workspaceInput =
    Array.isArray(config?.workspaces) && config.workspaces.length > 0
      ? config.workspaces
      : legacyWorkspaceRoot !== undefined
        ? [createDefaultWorkspace(legacyWorkspaceRoot)]
        : undefined;
  const workspaces = normalizeWorkspaces(workspaceInput, fallbackWorkspaceRoot);
  const normalizedDefaultWorkspaceId = normalizeDefaultWorkspaceId(
    config?.defaultWorkspaceId,
    workspaces
  );

  return {
    workspaces,
    defaultWorkspaceId: normalizedDefaultWorkspaceId,
    chatBindings: normalizeChatBindings(config?.chatBindings, workspaces)
  };
}

export class CodexSettingsStore {
  private readonly filePath: string;

  private readonly defaultWorkspaceRoot: string;

  private config: CodexConfigState;

  constructor({ settingsRoot, defaultWorkspaceRoot }: CodexSettingsStoreOptions) {
    this.filePath = path.join(settingsRoot, "codex.json");
    this.defaultWorkspaceRoot = defaultWorkspaceRoot;
    this.config = this.loadConfig();
    this.persistConfig();
  }

  getState(): CodexConfigState {
    return {
      workspaces: this.config.workspaces.map((workspace) => ({ ...workspace })),
      defaultWorkspaceId: this.config.defaultWorkspaceId,
      chatBindings: { ...this.config.chatBindings }
    };
  }

  saveConfig(input: CodexConfigInput): CodexConfigState {
    this.config = normalizeConfig(
      {
        workspaces: input.workspaces,
        defaultWorkspaceId: input.defaultWorkspaceId,
        chatBindings: this.config.chatBindings,
        workspaceRoot: input.workspaceRoot
      },
      this.defaultWorkspaceRoot
    );
    this.persistConfig();
    return this.getState();
  }

  saveChatBinding({ chatId, workspaceId }: CodexChatBindingInput): CodexConfigState {
    const nextChatBindings = { ...this.config.chatBindings };

    if (this.config.workspaces.some((workspace) => workspace.id === workspaceId)) {
      nextChatBindings[String(chatId)] = workspaceId;
    } else {
      delete nextChatBindings[String(chatId)];
    }

    this.config = normalizeConfig(
      {
        ...this.config,
        chatBindings: nextChatBindings
      },
      this.defaultWorkspaceRoot
    );
    this.persistConfig();
    return this.getState();
  }

  getWorkspaceForChat(chatId: number | null | undefined): CodexWorkspace {
    const workspaceId =
      chatId === null || chatId === undefined
        ? this.config.defaultWorkspaceId
        : this.config.chatBindings[String(chatId)] ?? this.config.defaultWorkspaceId;

    return (
      this.config.workspaces.find((workspace) => workspace.id === workspaceId) ??
      this.config.workspaces[0]
    );
  }

  private loadConfig(): CodexConfigState {
    if (!fs.existsSync(this.filePath)) {
      return normalizeConfig(undefined, this.defaultWorkspaceRoot);
    }

    try {
      const rawConfig = fs.readFileSync(this.filePath, "utf8");
      return normalizeConfig(
        JSON.parse(rawConfig) as PersistedCodexConfig,
        this.defaultWorkspaceRoot
      );
    } catch {
      return normalizeConfig(undefined, this.defaultWorkspaceRoot);
    }
  }

  private persistConfig(): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(this.config, null, 2));
  }
}
