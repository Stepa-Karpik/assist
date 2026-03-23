import path from "node:path";

import { BrowserWindow } from "electron";

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

function loadRenderer(browserWindow: BrowserWindow, query?: Record<string, string>): void {
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    const url = new URL(MAIN_WINDOW_VITE_DEV_SERVER_URL);

    if (query) {
      for (const [key, value] of Object.entries(query)) {
        url.searchParams.set(key, value);
      }
    }

    void browserWindow.loadURL(url.toString());
    return;
  }

  void browserWindow.loadFile(
    path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    query ? { query } : undefined
  );
}

export function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1024,
    minHeight: 720,
    show: false,
    autoHideMenuBar: true,
    title: "Karpik",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js")
    }
  });

  window.once("ready-to-show", () => {
    window.show();
  });

  loadRenderer(window);
  return window;
}

export function createQuickPopupWindow(mainWindow: BrowserWindow): BrowserWindow {
  const popup = new BrowserWindow({
    width: 380,
    height: 240,
    show: false,
    frame: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    parent: mainWindow,
    title: "Karpik Quick Access",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js")
    }
  });

  loadRenderer(popup, { view: "quick-popup" });
  return popup;
}
