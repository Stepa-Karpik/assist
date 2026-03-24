import started from "electron-squirrel-startup";
import { app, BrowserWindow, ipcMain, nativeTheme, Tray } from "electron";

import { type AuthConfigInput, AuthStore } from "./authStore";
import { ensureRuntimeFolders } from "./bootstrapFolders";
import { type CodexConfigInput, CodexSettingsStore } from "./codexSettingsStore";
import { createCodexWritePreviewGenerator } from "./codexWritePreview";
import { getDataRoot } from "./dataRoot";
import { LocalApprovalStore } from "./localApprovalStore";
import { PairingStore } from "./pairingStore";
import {
  type AuthEventListResponse,
  type PairingEventListResponse,
  type RemoteTaskRecord,
  createSyncClient
} from "./syncClient";
import { createTaskExecutor } from "./taskExecutor";
import { runTaskSyncCycle } from "./taskRuntime";
import { createAppTray } from "./tray";
import { createMainWindow, createQuickPopupWindow } from "./windows";

let mainWindow: BrowserWindow | null = null;
let quickPopup: BrowserWindow | null = null;
let tray: Tray | null = null;
let authPollInterval: NodeJS.Timeout | null = null;
let pairingPollInterval: NodeJS.Timeout | null = null;
let taskPollInterval: NodeJS.Timeout | null = null;
let taskPollInFlight = false;
let ipcHandlersRegistered = false;
let authStore: AuthStore | null = null;
let codexSettingsStore: CodexSettingsStore | null = null;
let localApprovalStore: LocalApprovalStore | null = null;
let taskExecutor: ReturnType<typeof createTaskExecutor> | null = null;
let taskSnapshot: RemoteTaskRecord[] = [];
const pairingStore = new PairingStore();
const authPollIntervalMs = 2_000;
const pairingPollIntervalMs = 2_000;
const taskPollIntervalMs = 2_000;
const syncClient = createSyncClient({
  serverUrl: process.env.KARPIK_SERVER_URL ?? "http://127.0.0.1:8000",
  deviceId: process.env.KARPIK_DEVICE_ID ?? "desktop-local"
});

if (started) {
  app.quit();
}

function logResponseError(action: string, response: Response) {
  console.error(`${action} failed`, response.status, response.statusText);
}

async function syncAuthConfigState() {
  if (authStore === null) {
    return;
  }

  const response = await syncClient.announceAuthConfigState(authStore.getConfigState());

  if (!response.ok) {
    logResponseError("Syncing auth config state", response);
  }
}

async function pollAuthEvents() {
  if (authStore === null) {
    return;
  }

  const response = await syncClient.fetchAuthEvents();

  if (!response.ok) {
    logResponseError("Fetching auth events", response);
    return;
  }

  const payload = (await response.json()) as AuthEventListResponse;

  for (const event of payload.items) {
    const accepted =
      event.step === "password"
        ? authStore.validatePassword(event.value)
        : authStore.validateTotp(event.value);

    const resolveResponse = await syncClient.resolveAuthEvent(event.event_id, {
      accepted
    });

    if (!resolveResponse.ok) {
      logResponseError("Resolving auth event", resolveResponse);
    }
  }
}

async function pollPairingEvents() {
  const response = await syncClient.fetchPairingEvents();

  if (!response.ok) {
    logResponseError("Fetching pairing events", response);
    return;
  }

  const payload = (await response.json()) as PairingEventListResponse;

  for (const event of payload.items) {
    const resolution = pairingStore.resolvePairAttempt({
      code: event.code,
      telegramUserId: event.telegram_user_id
    });

    const resolveResponse = await syncClient.resolvePairingEvent(event.event_id, {
      result: resolution.result,
      trustedTelegramUserId:
        resolution.result === "paired" ? event.telegram_user_id : undefined
    });

    if (!resolveResponse.ok) {
      logResponseError("Resolving pairing event", resolveResponse);
      continue;
    }

    if (resolution.result === "paired") {
      const closeResponse = await syncClient.closePairingSession();

      if (!closeResponse.ok) {
        logResponseError("Closing pairing session", closeResponse);
      }
    }
  }
}

async function pollTaskState() {
  if (taskExecutor === null || taskPollInFlight) {
    return;
  }

  taskPollInFlight = true;

  try {
    taskSnapshot = await runTaskSyncCycle({
      client: syncClient,
      executeTask: (task) => taskExecutor!.execute(task),
      persistLocalApproval: async (task, draft) => {
        localApprovalStore?.saveDraft(task.intent, draft);
      },
      discardLocalApproval: async (draft) => {
        await localApprovalStore?.discardDraft(draft);
      }
    });
  } finally {
    taskPollInFlight = false;
  }
}

async function refreshTaskSnapshot() {
  const response = await syncClient.fetchTaskHistory();

  if (!response.ok) {
    throw new Error(`Failed to refresh task snapshot: ${response.status}`);
  }

  const payload = (await response.json()) as { items: RemoteTaskRecord[] };
  taskSnapshot = payload.items;
}

function ensureAuthPolling() {
  if (authPollInterval !== null) {
    return;
  }

  void pollAuthEvents().catch((error: unknown) => {
    console.error("Failed to poll auth events", error);
  });

  authPollInterval = setInterval(() => {
    void pollAuthEvents().catch((error: unknown) => {
      console.error("Failed to poll auth events", error);
    });
  }, authPollIntervalMs);
}

function ensurePairingPolling() {
  if (pairingPollInterval !== null) {
    return;
  }

  void pollPairingEvents().catch((error: unknown) => {
    console.error("Failed to poll pairing events", error);
  });

  pairingPollInterval = setInterval(() => {
    void pollPairingEvents().catch((error: unknown) => {
      console.error("Failed to poll pairing events", error);
    });
  }, pairingPollIntervalMs);
}

function ensureTaskPolling() {
  if (taskPollInterval !== null) {
    return;
  }

  void pollTaskState().catch((error: unknown) => {
    console.error("Failed to poll task state", error);
  });

  taskPollInterval = setInterval(() => {
    void pollTaskState().catch((error: unknown) => {
      console.error("Failed to poll task state", error);
    });
  }, taskPollIntervalMs);
}

function stopAuthPolling() {
  if (authPollInterval === null) {
    return;
  }

  clearInterval(authPollInterval);
  authPollInterval = null;
}

function stopTaskPolling() {
  if (taskPollInterval === null) {
    return;
  }

  clearInterval(taskPollInterval);
  taskPollInterval = null;
}

function stopPairingPolling() {
  if (pairingPollInterval === null) {
    return;
  }

  clearInterval(pairingPollInterval);
  pairingPollInterval = null;
}

function registerIpcHandlers() {
  if (ipcHandlersRegistered) {
    return;
  }

  ipcMain.handle("auth:get-config-state", () => authStore?.getConfigState());
  ipcMain.handle("codex:get-config-state", () => codexSettingsStore?.getState());
  ipcMain.handle("tasks:get-local-approvals", () => localApprovalStore?.list() ?? []);
  ipcMain.handle("auth:save-config", async (_event, payload: AuthConfigInput) => {
    if (authStore === null) {
      throw new Error("Auth store is not initialized");
    }

    const state = authStore.saveConfig(payload);
    const response = await syncClient.announceAuthConfigState(state);

    if (!response.ok) {
      throw new Error(`Failed to sync auth config state: ${response.status}`);
    }

    return state;
  });
  ipcMain.handle("codex:save-config", (_event, payload: CodexConfigInput) => {
    if (codexSettingsStore === null) {
      throw new Error("Codex settings store is not initialized");
    }

    return codexSettingsStore.saveConfig(payload);
  });
  ipcMain.handle("pairing:get-state", () => pairingStore.getState());
  ipcMain.handle("tasks:get-snapshot", () => taskSnapshot);
  ipcMain.handle("tasks:approve-local-approval", async (_event, taskId: string) => {
    if (localApprovalStore === null) {
      throw new Error("Local approval store is not initialized");
    }

    const result = await localApprovalStore.approve(taskId);
    const response = await syncClient.completeTask(taskId, result.resultText);

    if (!response.ok) {
      throw new Error(`Failed to complete task after local approval: ${response.status}`);
    }

    await refreshTaskSnapshot();
  });
  ipcMain.handle("tasks:reject-local-approval", async (_event, taskId: string) => {
    if (localApprovalStore === null) {
      throw new Error("Local approval store is not initialized");
    }

    const response = await syncClient.blockTask(taskId, "Rejected locally.");

    if (!response.ok) {
      throw new Error(`Failed to block task after local rejection: ${response.status}`);
    }

    await localApprovalStore.reject(taskId);
    await refreshTaskSnapshot();
  });
  ipcMain.handle("pairing:open-session", async () => {
    const state = pairingStore.openPairingSession();

    if (state.expiresAt === null) {
      return state;
    }

    const response = await syncClient.openPairingSession(state.expiresAt);

    if (!response.ok) {
      pairingStore.closePairingSession();
      throw new Error(`Failed to open pairing session: ${response.status}`);
    }

    return pairingStore.getState();
  });

  ipcHandlersRegistered = true;
}

async function bootstrap() {
  nativeTheme.themeSource = "system";
  const runtimeFolders = ensureRuntimeFolders(getDataRoot());
  authStore = new AuthStore({
    secretsRoot: runtimeFolders.secrets
  });
  localApprovalStore = new LocalApprovalStore({
    stateRoot: runtimeFolders.state
  });
  codexSettingsStore = new CodexSettingsStore({
    settingsRoot: runtimeFolders.settings,
    defaultWorkspaceRoot: runtimeFolders.userRoot
  });
  taskExecutor = createTaskExecutor({
    deviceId: process.env.KARPIK_DEVICE_ID ?? "desktop-local",
    userRoot: runtimeFolders.userRoot,
    getCodexWorkspaceRoot: () => codexSettingsStore?.getState().workspaceRoot ?? runtimeFolders.userRoot,
    generateCodexWritePreview: createCodexWritePreviewGenerator({
      stateRoot: runtimeFolders.state
    }).generatePreview
  });
  registerIpcHandlers();

  mainWindow = createMainWindow();
  quickPopup = createQuickPopupWindow(mainWindow);
  tray = createAppTray({
    mainWindow,
    quickPopup
  });
  ensureAuthPolling();
  ensurePairingPolling();
  ensureTaskPolling();

  void syncClient.announceOnline().catch((error: unknown) => {
    console.error("Failed to announce device online", error);
  });
  void syncAuthConfigState().catch((error: unknown) => {
    console.error("Failed to sync auth config state", error);
  });
}

app.whenReady().then(bootstrap);

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void bootstrap();
    return;
  }

  mainWindow?.show();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  stopAuthPolling();
  stopTaskPolling();
  stopPairingPolling();

  if (pairingStore.getState().isActive) {
    void syncClient.closePairingSession().catch((error: unknown) => {
      console.error("Failed to close pairing session", error);
    });
    pairingStore.closePairingSession();
  }

  tray?.destroy();
});
