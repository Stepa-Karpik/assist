import started from "electron-squirrel-startup";
import { app, BrowserWindow, ipcMain, nativeTheme, Tray } from "electron";

import { ensureRuntimeFolders } from "./bootstrapFolders";
import { getDataRoot } from "./dataRoot";
import { PairingStore } from "./pairingStore";
import { type PairingEventListResponse, createSyncClient } from "./syncClient";
import { createAppTray } from "./tray";
import { createMainWindow, createQuickPopupWindow } from "./windows";

let mainWindow: BrowserWindow | null = null;
let quickPopup: BrowserWindow | null = null;
let tray: Tray | null = null;
let pairingPollInterval: NodeJS.Timeout | null = null;
let ipcHandlersRegistered = false;
const pairingStore = new PairingStore();
const pairingPollIntervalMs = 2_000;
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

  ipcMain.handle("pairing:get-state", () => pairingStore.getState());
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
  ensureRuntimeFolders(getDataRoot());
  registerIpcHandlers();

  mainWindow = createMainWindow();
  quickPopup = createQuickPopupWindow(mainWindow);
  tray = createAppTray({
    mainWindow,
    quickPopup
  });
  ensurePairingPolling();

  void syncClient.announceOnline().catch((error: unknown) => {
    console.error("Failed to announce device online", error);
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
  stopPairingPolling();

  if (pairingStore.getState().isActive) {
    void syncClient.closePairingSession().catch((error: unknown) => {
      console.error("Failed to close pairing session", error);
    });
    pairingStore.closePairingSession();
  }

  tray?.destroy();
});
