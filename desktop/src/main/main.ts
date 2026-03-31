import fs from "node:fs";
import started from "electron-squirrel-startup";
import { app, autoUpdater, BrowserWindow, ipcMain, nativeTheme, Notification, Tray } from "electron";
import QRCode from "qrcode";

import { ActivityLogStore } from "./activityLogStore";
import { AppRegistryStore, type AppRegistryInput } from "./appRegistryStore";
import { AppPreferencesStore, type AppPreferencesState } from "./appPreferencesStore";
import { AssistantProcessStore } from "./assistantProcessStore";
import { type AuthConfigInput, AuthStore } from "./authStore";
import { discoverApps } from "./appDiscovery";
import { ensureRuntimeFolders } from "./bootstrapFolders";
import {
  type CodexChatBindingInput,
  type CodexConfigInput,
  CodexSettingsStore
} from "./codexSettingsStore";
import { createCodexWritePreviewGenerator } from "./codexWritePreview";
import { createDevicePresenceTracker } from "./devicePresenceTracker";
import { createDeepSeekChatResponder } from "./deepseekChatResponder";
import { createChatKnowledgeRetriever } from "./chatKnowledgeRetriever";
import { createChatRunStore } from "./chatRunStore";
import { getDataRoot } from "./dataRoot";
import { DeviceIdentityStore } from "./deviceIdentityStore";
import { createKnowledgeBackgroundWriter } from "./knowledgeBackgroundWriter";
import { ensureKnowledgeVault } from "./knowledgeVaultBootstrap";
import { createKnowledgeVaultStore } from "./knowledgeVaultStore";
import { VaultSettingsStore } from "./vaultSettingsStore";
import { LocalApprovalStore } from "./localApprovalStore";
import { LocalChatStore } from "./localChatStore";
import { createLocalConversationRouter } from "./localConversationRouter";
import { createLocalChatRuntime } from "./localChatRuntime";
import { OnboardingStateStore } from "./onboardingStateStore";
import {
  OwnerProfileStore,
  buildOwnerProfileContext,
  type OwnerProfileInput
} from "./ownerProfileStore";
import { PairingStore } from "./pairingStore";
import { createQuickAccessRuntime } from "./quickAccessRuntime";
import { mirrorRemoteTaskUpdates } from "./remoteTaskMirror";
import {
  type AuthEventListResponse,
  type ConversationMemoryEventListResponse,
  type DevicePresenceResponse,
  type PairingStateResponse,
  type RemoteConversationMemoryEvent,
  type RemoteTaskRecord,
  type RemoteAppCatalogItem,
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
let appRegistryStore: AppRegistryStore | null = null;
let authStore: AuthStore | null = null;
let codexSettingsStore: CodexSettingsStore | null = null;
let activityLogStore: ActivityLogStore | null = null;
let knowledgeStore: ReturnType<typeof createKnowledgeVaultStore> | null = null;
let localApprovalStore: LocalApprovalStore | null = null;
let localChatStore: LocalChatStore | null = null;
let localChatRuntime: ReturnType<typeof createLocalChatRuntime> | null = null;
let chatRunStore: ReturnType<typeof createChatRunStore> | null = null;
let knowledgeBackgroundWriter: ReturnType<typeof createKnowledgeBackgroundWriter> | null = null;
let onboardingStateStore: OnboardingStateStore | null = null;
let ownerProfileStore: OwnerProfileStore | null = null;
let vaultSettingsStore: VaultSettingsStore | null = null;
let quickAccessRuntime: ReturnType<typeof createQuickAccessRuntime> | null = null;
let taskExecutor: ReturnType<typeof createTaskExecutor> | null = null;
let updateService: ReturnType<typeof createUpdateService> | null = null;
let taskSnapshot: RemoteTaskRecord[] = [];
let taskActivityInitialized = false;
const assistantProcessStore = new AssistantProcessStore();
const taskRuntimeState = {
  activeExecutions: new Map()
};
const pairingStore = new PairingStore();
const authPollIntervalMs = 2_000;
const deviceHeartbeatIntervalMs = 15_000;
const pairingPollIntervalMs = 2_000;
const taskPollIntervalMs = 2_000;
const backgroundTaskSnapshotLimit = 25;
const manualTaskHistoryLimit = 100;
let deviceId = process.env.KARPIK_DEVICE_ID?.trim() ?? "";
const serverUrl = process.env.KARPIK_SERVER_URL ?? "http://127.0.0.1:8000";
const updateFeedUrl = process.env.KARPIK_UPDATE_FEED_URL ?? null;
let syncClient!: ReturnType<typeof createSyncClient>;
const devicePresenceTracker = createDevicePresenceTracker();

function emitLocalChatUpdated(detail: ReturnType<LocalChatStore["getChat"]> extends infer T ? NonNullable<T> : never) {
  mainWindow?.webContents.send("chats:updated", {
    chatId: detail.chatId,
    detail
  });
}

function emitLocalChatRunUpdated(chatId: string, run: ReturnType<ReturnType<typeof createChatRunStore>["getRun"]>) {
  mainWindow?.webContents.send("chats:run-updated", {
    chatId,
    run
  });
}

if (started) {
  app.quit();
}

function logResponseError(action: string, response: Response) {
  console.error(`${action} failed`, response.status, response.statusText);
}

function getVaultSettingsState() {
  const vaultRoot = vaultSettingsStore?.getVaultRoot() ?? null;

  return {
    vaultRoot,
    isConfigured: vaultRoot !== null
  };
}

function buildInstallationFingerprint(): string {
  const executablePath = app.getPath("exe");

  try {
    const executableStat = fs.statSync(executablePath);
    return `${app.getVersion()}::${executablePath}::${Math.trunc(executableStat.mtimeMs)}`;
  } catch {
    return `${app.getVersion()}::${executablePath}`;
  }
}

function shouldPollAuth(snapshot: RemoteTaskRecord[]): boolean {
  return snapshot.some((task) => task.status === "awaiting_auth");
}

function isArtifactMetadataComplete(task: RemoteTaskRecord): boolean {
  return (
    (task.artifact_kind === "image_base64" || task.artifact_kind === "file_base64") &&
    task.artifact_mime_type !== null &&
    task.artifact_mime_type !== undefined &&
    task.artifact_file_name !== null &&
    task.artifact_file_name !== undefined
  );
}

function canReuseArtifactPayload(previousTask: RemoteTaskRecord | undefined, nextTask: RemoteTaskRecord): boolean {
  return Boolean(
    previousTask !== undefined &&
      previousTask.artifact_kind === nextTask.artifact_kind &&
      previousTask.artifact_mime_type === nextTask.artifact_mime_type &&
      previousTask.artifact_file_name === nextTask.artifact_file_name &&
      previousTask.artifact_base64
  );
}

function buildRemoteTaskArtifact(task: RemoteTaskRecord):
  | {
      kind: "image_base64" | "file_base64";
      mimeType: string;
      fileName: string;
      contentBase64: string;
    }
  | undefined {
  if (
    !isArtifactMetadataComplete(task) ||
    task.artifact_base64 === null ||
    task.artifact_base64 === undefined
  ) {
    return undefined;
  }

  return {
    kind: task.artifact_kind!,
    mimeType: task.artifact_mime_type!,
    fileName: task.artifact_file_name!,
    contentBase64: task.artifact_base64
  };
}

function buildRemoteAppCatalogItems(): RemoteAppCatalogItem[] {
  if (appRegistryStore === null) {
    return [];
  }

  return appRegistryStore.getState().items.map((item) => ({
    appId: item.appId,
    displayName: item.displayName,
    aliases: [...item.aliases],
    linked: item.linked,
    source: item.source
  }));
}

async function syncAppCatalogState() {
  const response = await syncClient.syncAppCatalog(buildRemoteAppCatalogItems());

  if (!response.ok) {
    logResponseError("Syncing app catalog", response);
  }
}

async function refreshDiscoveredApps() {
  if (appRegistryStore === null) {
    return appRegistryStore;
  }

  const discoveredApps = await discoverApps();
  appRegistryStore.replaceDiscoveredApps(discoveredApps);
  await syncAppCatalogState();
  return appRegistryStore.getState();
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

async function syncOwnerProfileState() {
  if (ownerProfileStore === null) {
    return;
  }

  const response = await syncClient.syncOwnerProfile(ownerProfileStore.getState());

  if (!response.ok) {
    logResponseError("Syncing owner profile state", response);
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

function applyRemotePairingState(payload: PairingStateResponse) {
  return pairingStore.syncFromServerState({
    trustedTelegramUserIds: payload.trusted_telegram_user_ids,
    session:
      payload.session === null
        ? null
        : {
            code: payload.session.code,
            expiresAt: payload.session.expires_at,
            status: payload.session.status,
          }
  });
}

async function refreshPairingState() {
  const response = await syncClient.fetchPairingState();

  if (!response.ok) {
    throw new Error(`Failed to fetch pairing state: ${response.status}`);
  }

  const payload = (await response.json()) as PairingStateResponse;
  return applyRemotePairingState(payload);
}

async function pollPairingEvents() {
  if (!pairingStore.getState().isActive) {
    stopPairingPolling();
    return;
  }

  try {
    await refreshPairingState();
  } catch (error: unknown) {
    console.error("Failed to refresh pairing state", error);
    return;
  }

  if (!pairingStore.getState().isActive) {
    stopPairingPolling();
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
      recordKnowledgeInteraction: async (input) => {
        await knowledgeBackgroundWriter?.recordInteraction(input);
      },
      persistLocalApproval: async (task, draft) => {
        localApprovalStore?.saveDraft(task.intent, draft);
      },
      discardLocalApproval: async (draft) => {
        await localApprovalStore?.discardDraft(draft);
      },
      runtimeState: taskRuntimeState
    });
    updateTaskSnapshot(await hydrateTaskSnapshot(nextSnapshot));
    await pollConversationMemoryEvents();
  } finally {
    taskPollInFlight = false;
  }
}

async function applyKnowledgeInteraction(input: {
  origin: "local-chat" | "telegram-chat" | "remote-task";
  prompt: string;
  answer: string;
  sourceUrls?: string[];
  memoryWrites?: Array<{
    target: "assist/profile" | "assist/preferences" | "assist/docs/websites" | "assist/docs/papers";
    key: string;
    value: string;
  }>;
}) {
  const profilePatch: OwnerProfileInput = {};

  for (const write of input.memoryWrites ?? []) {
    if (write.target !== "assist/profile") {
      continue;
    }

    if (write.key === "full_name") {
      profilePatch.fullName = write.value;
    } else if (write.key === "occupation") {
      profilePatch.occupation = write.value;
    }
  }

  if (ownerProfileStore !== null && Object.keys(profilePatch).length > 0) {
    ownerProfileStore.save(profilePatch);
    await syncOwnerProfileState().catch((error: unknown) => {
      console.error("Failed to sync owner profile state", error);
    });
  }

  await knowledgeBackgroundWriter?.recordInteraction(input);
}

async function pollConversationMemoryEvents() {
  if (vaultSettingsStore?.getVaultRoot() === null) {
    return;
  }

  const response = await syncClient.fetchConversationMemoryEvents();

  if (!response.ok) {
    logResponseError("Fetching conversation memory events", response);
    return;
  }

  const payload = (await response.json()) as ConversationMemoryEventListResponse;

  for (const event of payload.items) {
    await applyConversationMemoryEvent(event);
  }
}

async function applyConversationMemoryEvent(event: RemoteConversationMemoryEvent) {
  if (knowledgeBackgroundWriter === null) {
    return;
  }

  try {
    await applyKnowledgeInteraction({
      origin: "telegram-chat",
      prompt: event.prompt,
      answer: event.answer,
      sourceUrls: event.source_urls,
      memoryWrites: event.memory_writes
    });
  } catch (error) {
    console.error("Failed to apply conversation memory event", error);
    return;
  }

  const ackResponse = await syncClient.ackConversationMemoryEvent(event.event_id);
  if (!ackResponse.ok) {
    logResponseError("Acknowledging conversation memory event", ackResponse);
  }
}

async function refreshTaskSnapshot() {
  const response = await syncClient.fetchTaskHistory({ limit: manualTaskHistoryLimit });

  if (!response.ok) {
    throw new Error(`Failed to refresh task snapshot: ${response.status}`);
  }

  const payload = (await response.json()) as { items: RemoteTaskRecord[] };
  updateTaskSnapshot(await hydrateTaskSnapshot(payload.items));
}

async function hydrateTaskSnapshot(nextSnapshot: RemoteTaskRecord[]): Promise<RemoteTaskRecord[]> {
  const previousByTaskId = new Map(taskSnapshot.map((task) => [task.task_id, task]));

  return Promise.all(
    nextSnapshot.map(async (task) => {
      if (!isArtifactMetadataComplete(task)) {
        return task;
      }

      if (task.artifact_base64 !== null && task.artifact_base64 !== undefined) {
        return task;
      }

      const previousTask = previousByTaskId.get(task.task_id);
      if (canReuseArtifactPayload(previousTask, task)) {
        return {
          ...task,
          artifact_base64: previousTask!.artifact_base64
        };
      }

      const detailResponse = await syncClient.fetchTask(task.task_id);

      if (!detailResponse.ok) {
        logResponseError("Fetching task detail", detailResponse);
        return task;
      }

      return (await detailResponse.json()) as RemoteTaskRecord;
    })
  );
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
            artifact: buildRemoteTaskArtifact(task)
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

  if (shouldPollAuth(nextSnapshot)) {
    ensureAuthPolling();
  } else {
    stopAuthPolling();
  }
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
  if (pairingPollInterval !== null || !pairingStore.getState().isActive) {
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
  ipcMain.handle("vault:get-settings", () => getVaultSettingsState());
  ipcMain.handle("onboarding:get-state", () => onboardingStateStore?.getState() ?? null);
  ipcMain.handle("onboarding:complete", () => {
    if (onboardingStateStore === null) {
      throw new Error("Onboarding state store is not initialized");
    }

    return onboardingStateStore.markCompleted();
  });
  ipcMain.handle("profile:get-state", () => ownerProfileStore?.getState());
  ipcMain.handle("apps:get-state", () => appRegistryStore?.getState() ?? { items: [] });
  ipcMain.handle("apps:get-active-processes", () => assistantProcessStore.listActive());
  ipcMain.handle("activity-log:get", () => activityLogStore?.list() ?? []);
  ipcMain.handle("codex:get-config-state", () => codexSettingsStore?.getState());
  ipcMain.handle("chats:get-local", () => localChatStore?.list() ?? []);
  ipcMain.handle("chats:get-detail", (_event, chatId: string) => localChatStore?.getChat(chatId) ?? null);
  ipcMain.handle("chats:get-run-state", (_event, chatId: string) => chatRunStore?.getRun(chatId) ?? null);
  ipcMain.handle("knowledge:get-state", () => knowledgeStore?.listRoots() ?? []);
  ipcMain.handle("vault:set-root", (_event, vaultRoot: string) => {
    if (vaultSettingsStore === null) {
      throw new Error("Vault settings store is not initialized");
    }

    const normalizedVaultRoot = vaultSettingsStore.setVaultRoot(vaultRoot);
    ensureKnowledgeVault(normalizedVaultRoot);
    knowledgeStore = createKnowledgeVaultStore({
      vaultRoot: normalizedVaultRoot
    });
    return getVaultSettingsState();
  });
  ipcMain.handle(
    "apps:save",
    async (_event, payload: AppRegistryInput) => {
      if (appRegistryStore === null) {
        throw new Error("App registry is not initialized");
      }

      const state = appRegistryStore.saveApp(payload);
      await syncAppCatalogState();
      return state;
    }
  );
  ipcMain.handle(
    "apps:remove",
    async (_event, appId: string) => {
      if (appRegistryStore === null) {
        throw new Error("App registry is not initialized");
      }

      const state = appRegistryStore.removeApp(appId);
      await syncAppCatalogState();
      return state;
    }
  );
  ipcMain.handle(
    "apps:refresh-discovered",
    async () => {
      const state = await refreshDiscoveredApps();
      return state ?? { items: [] };
    }
  );
  ipcMain.handle(
    "knowledge:read-entry",
    (_event, payload: { relativePath: string }) => knowledgeStore?.readNote(payload.relativePath) ?? null
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
  ipcMain.handle("profile:save", async (_event, payload: OwnerProfileInput) => {
    if (ownerProfileStore === null) {
      throw new Error("Owner profile store is not initialized");
    }

    const state = ownerProfileStore.save(payload);
    await syncOwnerProfileState();
    return state;
  });
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
  ipcMain.handle("chats:cancel-run", (_event, chatId: string) => {
    if (localChatRuntime === null) {
      throw new Error("Local chat runtime is not initialized");
    }

    return localChatRuntime.cancelRun(chatId);
  });
  ipcMain.handle(
    "quick-access:submit-request",
    async (_event, payload: { chatId?: string; text: string }) => {
      if (quickAccessRuntime === null) {
        throw new Error("Quick access runtime is not initialized");
      }

      return quickAccessRuntime.submitRequest(payload);
    }
  );
  ipcMain.handle("pairing:get-state", async () => {
    try {
      return await refreshPairingState();
    } catch {
      return pairingStore.getState();
    }
  });
  ipcMain.handle("tasks:get-snapshot", () => taskSnapshot);
  ipcMain.handle("tasks:approve-local-approval", async (_event, taskId: string) => {
    if (localApprovalStore === null) {
      throw new Error("Local approval store is not initialized");
    }

    const approval = localApprovalStore.getSummary(taskId);
    const result = await localApprovalStore.approve(taskId);

    if (approval?.kind === "assist_skill") {
      return;
    }

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

    const approval = localApprovalStore.getSummary(taskId);

    if (approval?.kind === "assist_skill") {
      await localApprovalStore.reject(taskId);
      return;
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

    if (state.expiresAt === null || state.code === null) {
      return state;
    }

    const response = await syncClient.openPairingSession(state.code, state.expiresAt);

    if (!response.ok) {
      pairingStore.closePairingSession();
      throw new Error(`Failed to open pairing session: ${response.status}`);
    }

    ensurePairingPolling();
    return refreshPairingState().catch(() => pairingStore.getState());
  });

  ipcHandlersRegistered = true;
}

async function bootstrap() {
  nativeTheme.themeSource = "system";
  const runtimeFolders = ensureRuntimeFolders(getDataRoot());
  if (deviceId.length === 0) {
    const deviceIdentityStore = new DeviceIdentityStore({
      identityRoot: runtimeFolders.root
    });
    deviceId = deviceIdentityStore.getState().deviceId;
  }
  syncClient = createSyncClient({
    serverUrl,
    deviceId
  });
  appPreferencesStore = new AppPreferencesStore({
    settingsRoot: runtimeFolders.settings
  });
  vaultSettingsStore = new VaultSettingsStore({
    settingsRoot: runtimeFolders.settings
  });
  onboardingStateStore = new OnboardingStateStore({
    settingsRoot: runtimeFolders.settings,
    installationFingerprint: buildInstallationFingerprint()
  });
  ownerProfileStore = new OwnerProfileStore({
    settingsRoot: runtimeFolders.settings
  });
  appRegistryStore = new AppRegistryStore({
    settingsRoot: runtimeFolders.settings
  });
  appPreferencesStore.applyLoginItemSettings(app);
  const configuredVaultRoot = vaultSettingsStore.getVaultRoot();
  if (configuredVaultRoot !== null) {
    ensureKnowledgeVault(configuredVaultRoot);
    knowledgeStore = createKnowledgeVaultStore({
      vaultRoot: configuredVaultRoot
    });
  }
  authStore = new AuthStore({
    secretsRoot: runtimeFolders.secrets,
    totpAccountName: deviceId
  });
  activityLogStore = new ActivityLogStore({
    stateRoot: runtimeFolders.state
  });
  localApprovalStore = new LocalApprovalStore({
    stateRoot: runtimeFolders.state
  });
  knowledgeBackgroundWriter = createKnowledgeBackgroundWriter({
    getVaultRoot: () => vaultSettingsStore?.getVaultRoot() ?? null,
    persistSkillApprovalDraft: async (draft) => {
      localApprovalStore?.saveSkillDraft(draft.intent, draft);
    }
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
    deviceId,
    userRoot: runtimeFolders.userRoot,
    resolveCodexWorkspace: (task) =>
      codexSettingsStore?.getWorkspaceForChat(task.chat_id).rootPath ??
      runtimeFolders.userRoot,
    generateCodexWritePreview: createCodexWritePreviewGenerator({
      stateRoot: runtimeFolders.state
    }).generatePreview,
    getRegisteredApp: (appId) => appRegistryStore?.getApp(appId) ?? null,
    findAssistantProcessByQuery: (query) => assistantProcessStore.findActiveByQuery(query),
    registerAssistantProcess: (record) => assistantProcessStore.register(record),
    markAssistantProcessExited: (taskId) => assistantProcessStore.markExited(taskId),
    markAssistantProcessCancelled: (taskId) => assistantProcessStore.markCancelled(taskId),
  });
  const localChatResponder =
    process.env.DEEPSEEK_API_KEY && process.env.DEEPSEEK_API_KEY.trim().length > 0
      ? createDeepSeekChatResponder({
          apiKey: process.env.DEEPSEEK_API_KEY
        })
      : null;
  const chatKnowledgeRetriever = createChatKnowledgeRetriever({
    getVaultRoot: () => vaultSettingsStore?.getVaultRoot() ?? null
  });
  chatRunStore = createChatRunStore();
  localChatRuntime = createLocalChatRuntime({
    chatStore: localChatStore,
    chatRunStore,
    executeTask: (task) => taskExecutor!.execute(task),
    replyToConversation: async ({ prompt, historyContext }) => {
      const knowledgeLookup = await chatKnowledgeRetriever.lookup(prompt);

      if (localChatResponder !== null) {
        const text = await localChatResponder.reply(prompt, {
          ownerProfileContext:
            ownerProfileStore === null
              ? null
              : buildOwnerProfileContext(ownerProfileStore.getState()) || null,
          knowledgeContext: knowledgeLookup.context,
          historyContext
        });

        return {
          text,
          sourceUrls: knowledgeLookup.sourceUrls
        };
      }

      const response = await syncClient.createConversationReply({
        prompt,
        knowledgeContext: knowledgeLookup.context,
        historyContext,
        includeExternalDocs: true
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch server conversation reply: ${response.status}`);
      }

      const payload = (await response.json()) as import("./syncClient").ConversationReplyResponse;
      return {
        text: payload.text,
        sourceUrls: [...knowledgeLookup.sourceUrls, ...payload.source_urls]
      };
    },
    onChatUpdated: (detail) => {
      emitLocalChatUpdated(detail);
    },
    onRunUpdated: ({ chatId, run }) => {
      emitLocalChatRunUpdated(chatId, run);
    },
    recordKnowledgeInteraction: async (input) => {
      await applyKnowledgeInteraction(input);
    },
    persistLocalApproval: async (intent, draft) => {
      localApprovalStore?.saveDraft(intent, draft);
    },
    getWorkspaceRootForChat: getWorkspaceRootForLocalChat,
    resolveInput: createLocalConversationRouter({
      chatResponder: localChatResponder,
      getOwnerProfileContext: () => {
        if (ownerProfileStore === null) {
          return null;
        }

        const context = buildOwnerProfileContext(ownerProfileStore.getState());
        return context.length > 0 ? context : null;
      }
    }).resolve,
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
  await refreshDiscoveredApps().catch((error: unknown) => {
    console.error("Failed to discover apps", error);
  });

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
  ensureDeviceHeartbeatPolling();
  ensureTaskPolling();

  void syncAuthConfigState().catch((error: unknown) => {
    console.error("Failed to sync auth config state", error);
  });
  void syncOwnerProfileState().catch((error: unknown) => {
    console.error("Failed to sync owner profile state", error);
  });
  void refreshPairingState().catch((error: unknown) => {
    console.error("Failed to sync pairing state", error);
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

  tray?.destroy();
});
