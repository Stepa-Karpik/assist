import started from "electron-squirrel-startup";
import { app, autoUpdater, BrowserWindow, ipcMain, nativeTheme, Notification, Tray } from "electron";
import QRCode from "qrcode";

import { ActivityLogStore } from "./activityLogStore";
import { AppPreferencesStore, type AppPreferencesState } from "./appPreferencesStore";
import { type AuthConfigInput, AuthStore } from "./authStore";
import { ensureRuntimeFolders } from "./bootstrapFolders";
import {
  type CodexChatBindingInput,
  type CodexConfigInput,
  CodexSettingsStore
} from "./codexSettingsStore";
import { createCodexWritePreviewGenerator } from "./codexWritePreview";
import { createDevicePresenceTracker } from "./devicePresenceTracker";
import { getDataRoot } from "./dataRoot";
import { createKnowledgeStore } from "./knowledgeStore";
import { LocalApprovalStore } from "./localApprovalStore";
import { LocalChatStore } from "./localChatStore";
import { createLocalChatRuntime } from "./localChatRuntime";
import { PairingStore } from "./pairingStore";
import { createQuickAccessRuntime } from "./quickAccessRuntime";
import { mirrorRemoteTaskUpdates } from "./remoteTaskMirror";
import {
  type AuthEventListResponse,
  type DevicePresenceResponse,
  type PairingEventListResponse,
  type RemoteTaskRecord,
  createSyncClient
} from "./syncClient";
import { createTaskExecutor } from "./taskExecutor";
import { buildTaskNotification } from "./taskNotifications";
import { runTaskSyncCycle } from "./taskRuntime";
import { createAppTray } from "./tray";
import { createUpdateService, type UpdaterAdapter } from "./updateService";
import { createMainWindow, createQuickPopupWindow } from "./windows";

let mainWindow: BrowserWindow | null = null;
let quickPopup: BrowserWindow | null = null;
let tray: Tray | null = null;
let authPollInterval: NodeJS.Timeout | null = null;
let deviceHeartbeatInterval: NodeJS.Timeout | null = null;
let pairingPollInterval: NodeJS.Timeout | null = null;
let taskPollInterval: NodeJS.Timeout | null = null;
let taskPollInFlight = false;
let isAppQuitting = false;
let ipcHandlersRegistered = false;
let appPreferencesStore: AppPreferencesStore | null = null;
let authStore: AuthStore | null = null;
let codexSettingsStore: CodexSettingsStore | null = null;
let activityLogStore: ActivityLogStore | null = null;
let knowledgeStore: ReturnType<typeof createKnowledgeStore> | null = null;
let localApprovalStore: LocalApprovalStore | null = null;
let localChatStore: LocalChatStore | null = null;
let localChatRuntime: ReturnType<typeof createLocalChatRuntime> | null = null;
let quickAccessRuntime: ReturnType<typeof createQuickAccessRuntime> | null = null;
let taskExecutor: ReturnType<typeof createTaskExecutor> | null = null;
let updateService: ReturnType<typeof createUpdateService> | null = null;
let taskSnapshot: RemoteTaskRecord[] = [];
let taskActivityInitialized = false;
const taskRuntimeState = {
  activeExecutions: new Map()
};
const pairingStore = new PairingStore();
const authPollIntervalMs = 2_000;
const deviceHeartbeatIntervalMs = 15_000;
const pairingPollIntervalMs = 2_000;
const taskPollIntervalMs = 2_000;
const deviceId = process.env.KARPIK_DEVICE_ID ?? "desktop-local";
const serverUrl = process.env.KARPIK_SERVER_URL ?? "http://127.0.0.1:8000";
const updateFeedUrl = process.env.KARPIK_UPDATE_FEED_URL ?? null;
const syncClient = createSyncClient({
  serverUrl,
  deviceId
});
const devicePresenceTracker = createDevicePresenceTracker();

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

async function syncDevicePresenceHeartbeat() {
  try {
    const response = await syncClient.announceOnline();

    if (!response.ok) {
      devicePresenceTracker.markFailure();
      logResponseError("Announcing device online", response);
      return;
    }

    const payload = (await response.json()) as DevicePresenceResponse;
    devicePresenceTracker.markSuccess(payload);
  } catch (error: unknown) {
    devicePresenceTracker.markFailure();
    throw error;
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
    const nextSnapshot = await runTaskSyncCycle({
      client: syncClient,
      startTaskExecution: (task) => taskExecutor!.start(task),
      persistLocalApproval: async (task, draft) => {
        localApprovalStore?.saveDraft(task.intent, draft);
      },
      discardLocalApproval: async (draft) => {
        await localApprovalStore?.discardDraft(draft);
      },
      runtimeState: taskRuntimeState
    });
    updateTaskSnapshot(nextSnapshot);
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
  updateTaskSnapshot(payload.items);
}

function buildTaskActivityStatus(task: RemoteTaskRecord): "info" | "success" | "warning" | "error" {
  if (task.status === "done") {
    return "success";
  }

  if (task.status === "failed" || task.status === "blocked") {
    return "error";
  }

  if (task.status === "awaiting_auth" || task.status === "awaiting_local_approval" || task.status === "stalled") {
    return "warning";
  }

  return "info";
}

function buildTaskActivityTitle(task: RemoteTaskRecord): string {
  return `Remote task ${task.task_id}`;
}

function buildTaskActivityDetail(task: RemoteTaskRecord): string {
  const suffix = task.result_text ?? task.error_text ?? "";
  return suffix ? `${task.intent} -> ${task.status}: ${suffix}` : `${task.intent} -> ${task.status}`;
}

function buildTaskSignature(task: RemoteTaskRecord): string {
  return JSON.stringify([
    task.status,
    task.result_text ?? null,
    task.error_text ?? null,
    task.started_at ?? null,
    task.finished_at ?? null
  ]);
}

function updateTaskSnapshot(nextSnapshot: RemoteTaskRecord[]): void {
  if (taskActivityInitialized) {
    if (localChatStore !== null) {
      mirrorRemoteTaskUpdates({
        previousSnapshot: taskSnapshot,
        nextSnapshot,
        mirrorTask: (task) => {
          localChatStore?.mirrorRemoteTaskUpdate({
            telegramChatId: task.chat_id!,
            taskId: task.task_id,
            intent: task.intent,
            status: task.status,
            resultText: task.result_text,
            errorText: task.error_text,
            artifact:
              (task.artifact_kind === "image_base64" || task.artifact_kind === "file_base64") &&
              task.artifact_mime_type !== null &&
              task.artifact_mime_type !== undefined &&
              task.artifact_file_name !== null &&
              task.artifact_file_name !== undefined &&
              task.artifact_base64 !== null &&
              task.artifact_base64 !== undefined
                ? {
                    kind: task.artifact_kind,
                    mimeType: task.artifact_mime_type,
                    fileName: task.artifact_file_name,
                    contentBase64: task.artifact_base64
                  }
                : undefined
          });
        }
      });
    }

    if (activityLogStore !== null) {
      const previousSignatures = new Map(
        taskSnapshot.map((task) => [task.task_id, buildTaskSignature(task)])
      );

      for (const task of nextSnapshot) {
        const nextSignature = buildTaskSignature(task);

        if (previousSignatures.get(task.task_id) === nextSignature) {
          continue;
        }

        activityLogStore.append({
          kind: "remote_task",
          status: buildTaskActivityStatus(task),
          title: buildTaskActivityTitle(task),
          detail: buildTaskActivityDetail(task),
          taskId: task.task_id
        });

        if (appPreferencesStore?.getState().notificationsEnabled) {
          const notification = buildTaskNotification(task);

          if (notification !== null) {
            new Notification({
              title: notification.title,
              body: notification.body
            }).show();
          }
        }
      }
    }
  }

  taskSnapshot = nextSnapshot;
  taskActivityInitialized = true;
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

function ensureDeviceHeartbeatPolling() {
  if (deviceHeartbeatInterval !== null) {
    return;
  }

  void syncDevicePresenceHeartbeat().catch((error: unknown) => {
    console.error("Failed to sync device heartbeat", error);
  });

  deviceHeartbeatInterval = setInterval(() => {
    void syncDevicePresenceHeartbeat().catch((error: unknown) => {
      console.error("Failed to sync device heartbeat", error);
    });
  }, deviceHeartbeatIntervalMs);
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

function stopDeviceHeartbeatPolling() {
  if (deviceHeartbeatInterval === null) {
    return;
  }

  clearInterval(deviceHeartbeatInterval);
  deviceHeartbeatInterval = null;
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
  ipcMain.handle("auth:create-totp-enrollment", async () => {
    if (authStore === null) {
      throw new Error("Auth store is not initialized");
    }

    const enrollment = authStore.createTotpEnrollment();
    const qrDataUrl = await QRCode.toDataURL(enrollment.otpAuthUri, {
      margin: 1,
      width: 256
    });

    return {
      ...enrollment,
      qrDataUrl
    };
  });
  ipcMain.handle("auth:confirm-totp-enrollment", async (_event, payload: { code: string }) => {
    if (authStore === null) {
      throw new Error("Auth store is not initialized");
    }

    const state = authStore.confirmTotpEnrollment(payload.code);
    const response = await syncClient.announceAuthConfigState(state);

    if (!response.ok) {
      throw new Error(`Failed to sync auth config state: ${response.status}`);
    }

    return state;
  });
  ipcMain.handle("app-preferences:get", () => appPreferencesStore?.getState());
  ipcMain.handle("activity-log:get", () => activityLogStore?.list() ?? []);
  ipcMain.handle("codex:get-config-state", () => codexSettingsStore?.getState());
  ipcMain.handle("chats:get-local", () => localChatStore?.list() ?? []);
  ipcMain.handle("chats:get-detail", (_event, chatId: string) => localChatStore?.getChat(chatId) ?? null);
  ipcMain.handle("knowledge:get-state", () => knowledgeStore?.listSections() ?? []);
  ipcMain.handle(
    "knowledge:read-entry",
    (_event, payload: { sectionId: "master_info" | "knowledge" | "notes" | "websites"; relativePath: string }) =>
      knowledgeStore?.readEntry(payload) ?? null
  );
  ipcMain.handle("quick-access:get-state", () => quickAccessRuntime?.getState());
  ipcMain.handle("runtime:get-status", () => {
    const pairingState = pairingStore.getState();
    const authConfigState = authStore?.getConfigState();
    const codexConfigState = codexSettingsStore?.getState();
    const localChats = localChatStore?.list() ?? [];
    const defaultWorkspace =
      codexConfigState?.workspaces.find(
        (workspace) => workspace.id === codexConfigState.defaultWorkspaceId
      ) ?? codexConfigState?.workspaces[0];
    const devicePresence = devicePresenceTracker.getSnapshot();

    return {
      deviceId,
      serverUrl,
      serverHeartbeatState: devicePresence.state,
      serverHeartbeatReachable: devicePresence.reachable,
      serverHeartbeatAt: devicePresence.lastSeenAt,
      pairingActive: pairingState.isActive,
      trustedTelegramUserCount: pairingState.trustedTelegramUserIds.length,
      passwordConfigured: authConfigState?.passwordConfigured ?? false,
      totpConfigured: authConfigState?.totpConfigured ?? false,
      workspaceCount: codexConfigState?.workspaces.length ?? 0,
      defaultWorkspaceName: defaultWorkspace?.name ?? "Default",
      defaultWorkspaceRoot: defaultWorkspace?.rootPath ?? "",
      localChatCount: localChats.length,
      lastActiveChatTitle: localChats[0]?.title ?? null,
      activityLogCount: activityLogStore?.count() ?? 0,
      pendingTaskCount: taskSnapshot.filter((task) => task.status === "queued" || task.status === "running").length,
      blockedTaskCount: taskSnapshot.filter((task) => task.status === "blocked" || task.status === "failed").length
    };
  });
  ipcMain.handle("updates:get-state", () => updateService?.getState() ?? null);
  ipcMain.handle("updates:check", async () => {
    if (updateService === null) {
      throw new Error("Update service is not initialized");
    }

    return updateService.checkForUpdates();
  });
  ipcMain.handle("updates:install", async () => {
    if (updateService === null) {
      throw new Error("Update service is not initialized");
    }

    updateService.installUpdate();
  });
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
  ipcMain.handle(
    "app-preferences:save",
    (_event, payload: Partial<AppPreferencesState>) => {
      if (appPreferencesStore === null) {
        throw new Error("App preferences store is not initialized");
      }

      const state = appPreferencesStore.save(payload);
      appPreferencesStore.applyLoginItemSettings(app);
      return state;
    }
  );
  ipcMain.handle("codex:save-config", (_event, payload: CodexConfigInput) => {
    if (codexSettingsStore === null) {
      throw new Error("Codex settings store is not initialized");
    }

    return codexSettingsStore.saveConfig(payload);
  });
  ipcMain.handle("codex:save-chat-binding", (_event, payload: CodexChatBindingInput) => {
    if (codexSettingsStore === null) {
      throw new Error("Codex settings store is not initialized");
    }

    return codexSettingsStore.saveChatBinding(payload);
  });
  ipcMain.handle(
    "chats:create-desktop",
    (_event, payload: { title?: string; workspaceId?: string | null } | undefined) => {
      if (localChatStore === null) {
        throw new Error("Local chat store is not initialized");
      }

      return localChatStore.createDesktopChat(payload);
    }
  );
  ipcMain.handle(
    "chats:create-continuation",
    (
      _event,
      payload: {
        telegramChatId: number;
        title?: string;
        workspaceId?: string | null;
      }
    ) => {
      if (localChatStore === null) {
        throw new Error("Local chat store is not initialized");
      }

      return localChatStore.createContinuationChat(payload);
    }
  );
  ipcMain.handle(
    "chats:send-message",
    async (_event, payload: { chatId: string; text: string }) => {
      if (localChatRuntime === null) {
        throw new Error("Local chat runtime is not initialized");
      }

      return localChatRuntime.sendMessage(payload);
    }
  );
  ipcMain.handle(
    "quick-access:submit-request",
    async (_event, payload: { chatId?: string; text: string }) => {
      if (quickAccessRuntime === null) {
        throw new Error("Quick access runtime is not initialized");
      }

      return quickAccessRuntime.submitRequest(payload);
    }
  );
  ipcMain.handle("pairing:get-state", () => pairingStore.getState());
  ipcMain.handle("tasks:get-snapshot", () => taskSnapshot);
  ipcMain.handle("tasks:approve-local-approval", async (_event, taskId: string) => {
    if (localApprovalStore === null) {
      throw new Error("Local approval store is not initialized");
    }

    const result = await localApprovalStore.approve(taskId);
    const response = await syncClient.completeTask(taskId, {
      resultText: result.resultText
    });

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
  ipcMain.handle("tasks:retry", async (_event, taskId: string) => {
    const response = await syncClient.retryTask(taskId);

    if (!response.ok) {
      throw new Error(`Failed to retry task: ${response.status}`);
    }

    await refreshTaskSnapshot();
  });
  ipcMain.handle("tasks:cancel", async (_event, taskId: string) => {
    const response = await syncClient.cancelTask(taskId);

    if (!response.ok) {
      throw new Error(`Failed to cancel task: ${response.status}`);
    }

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
  appPreferencesStore = new AppPreferencesStore({
    settingsRoot: runtimeFolders.settings
  });
  appPreferencesStore.applyLoginItemSettings(app);
  authStore = new AuthStore({
    secretsRoot: runtimeFolders.secrets,
    totpAccountName: deviceId
  });
  knowledgeStore = createKnowledgeStore({
    runtimeRoot: runtimeFolders.root
  });
  activityLogStore = new ActivityLogStore({
    stateRoot: runtimeFolders.state
  });
  localApprovalStore = new LocalApprovalStore({
    stateRoot: runtimeFolders.state
  });
  localChatStore = new LocalChatStore({
    stateRoot: runtimeFolders.state
  });
  codexSettingsStore = new CodexSettingsStore({
    settingsRoot: runtimeFolders.settings,
    defaultWorkspaceRoot: runtimeFolders.userRoot
  });
  const getWorkspaceRootForLocalChat = (chatId: string): string => {
    const defaultWorkspaceRoot =
      codexSettingsStore?.getWorkspaceForChat(null).rootPath ?? runtimeFolders.userRoot;
    const workspaceId = localChatStore?.getChat(chatId)?.workspaceId;

    if (!workspaceId || codexSettingsStore === null) {
      return defaultWorkspaceRoot;
    }

    return (
      codexSettingsStore.getState().workspaces.find((workspace) => workspace.id === workspaceId)
        ?.rootPath ?? defaultWorkspaceRoot
    );
  };
  taskExecutor = createTaskExecutor({
    deviceId: process.env.KARPIK_DEVICE_ID ?? "desktop-local",
    userRoot: runtimeFolders.userRoot,
    resolveCodexWorkspace: (task) =>
      codexSettingsStore?.getWorkspaceForChat(task.chat_id).rootPath ??
      runtimeFolders.userRoot,
    generateCodexWritePreview: createCodexWritePreviewGenerator({
      stateRoot: runtimeFolders.state
    }).generatePreview
  });
  localChatRuntime = createLocalChatRuntime({
    chatStore: localChatStore,
    executeTask: (task) => taskExecutor!.execute(task),
    persistLocalApproval: async (intent, draft) => {
      localApprovalStore?.saveDraft(intent, draft);
    },
    getWorkspaceRootForChat: getWorkspaceRootForLocalChat,
    logActivity: (input) => {
      activityLogStore?.append(input);
    }
  });
  quickAccessRuntime = createQuickAccessRuntime({
    chatStore: localChatStore,
    activityLogStore,
    sendMessage: (payload) => localChatRuntime!.sendMessage(payload)
  });
  updateService = createUpdateService({
    currentVersion: app.getVersion(),
    feedUrl: updateFeedUrl,
    isPackaged: app.isPackaged,
    platform: process.platform,
    updater: autoUpdater as unknown as UpdaterAdapter
  });
  registerIpcHandlers();

  const startHidden = process.argv.includes("--start-hidden");
  mainWindow = createMainWindow({
    startHidden
  });
  quickPopup = createQuickPopupWindow(mainWindow);
  mainWindow.on("close", (event) => {
    if (
      !isAppQuitting &&
      appPreferencesStore?.getState().closeToTrayOnClose
    ) {
      event.preventDefault();
      quickPopup?.hide();
      mainWindow?.hide();
    }
  });
  tray = createAppTray({
    mainWindow,
    quickPopup
  });
  ensureAuthPolling();
  ensureDeviceHeartbeatPolling();
  ensurePairingPolling();
  ensureTaskPolling();

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
  isAppQuitting = true;
  stopAuthPolling();
  stopDeviceHeartbeatPolling();
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
