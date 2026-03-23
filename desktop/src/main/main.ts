import started from "electron-squirrel-startup";
import { app, BrowserWindow, nativeTheme, Tray } from "electron";

import { ensureRuntimeFolders } from "./bootstrapFolders";
import { getDataRoot } from "./dataRoot";
import { createSyncClient } from "./syncClient";
import { createAppTray } from "./tray";
import { createMainWindow, createQuickPopupWindow } from "./windows";

let mainWindow: BrowserWindow | null = null;
let quickPopup: BrowserWindow | null = null;
let tray: Tray | null = null;
const syncClient = createSyncClient({
  serverUrl: process.env.KARPIK_SERVER_URL ?? "http://127.0.0.1:8000",
  deviceId: process.env.KARPIK_DEVICE_ID ?? "desktop-local"
});

if (started) {
  app.quit();
}

async function bootstrap() {
  nativeTheme.themeSource = "system";
  ensureRuntimeFolders(getDataRoot());

  mainWindow = createMainWindow();
  quickPopup = createQuickPopupWindow(mainWindow);
  tray = createAppTray({
    mainWindow,
    quickPopup
  });

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
  tray?.destroy();
});
