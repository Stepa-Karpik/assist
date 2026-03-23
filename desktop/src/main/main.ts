import started from "electron-squirrel-startup";
import { app, BrowserWindow, nativeTheme, Tray } from "electron";

import { ensureRuntimeFolders } from "./bootstrapFolders";
import { getDataRoot } from "./dataRoot";
import { createAppTray } from "./tray";
import { createMainWindow, createQuickPopupWindow } from "./windows";

let mainWindow: BrowserWindow | null = null;
let quickPopup: BrowserWindow | null = null;
let tray: Tray | null = null;

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
