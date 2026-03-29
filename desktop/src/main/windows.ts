import path from "node:path";

import { BrowserWindow, type Rectangle } from "electron";

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

export function resolvePreloadPath(buildRoot: string): string {
  return path.join(buildRoot, "index.js");
}

export function shouldStartWindowHidden(input: {
  argv: string[];
  startHiddenOnLaunch: boolean;
}): boolean {
  return input.startHiddenOnLaunch || input.argv.includes("--start-hidden");
}

export function shouldHideMainWindowOnClose(input: {
  isAppQuitting: boolean;
  closeToTrayOnClose: boolean;
}): boolean {
  return !input.isAppQuitting && input.closeToTrayOnClose;
}

export function calculateQuickPopupBounds(input: {
  trayBounds: Rectangle;
  workArea: Rectangle;
  popupWidth: number;
  popupHeight: number;
  gap?: number;
}): Rectangle {
  const { trayBounds, workArea, popupWidth, popupHeight, gap = 8 } = input;
  const minX = workArea.x + 8;
  const maxX = workArea.x + workArea.width - popupWidth - 8;
  const centeredX = trayBounds.x + Math.round((trayBounds.width - popupWidth) / 2);
  const x = Math.max(minX, Math.min(centeredX, maxX));
  const trayIsBottomHalf = trayBounds.y > workArea.y + workArea.height / 2;
  const preferredY = trayIsBottomHalf
    ? trayBounds.y - popupHeight - gap
    : trayBounds.y + trayBounds.height + gap;
  const minY = workArea.y + 8;
  const maxY = workArea.y + workArea.height - popupHeight - 8;
  const y = Math.max(minY, Math.min(preferredY, maxY));

  return {
    x,
    y,
    width: popupWidth,
    height: popupHeight
  };
}

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

export function createMainWindow({ startHidden = false }: { startHidden?: boolean } = {}): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1024,
    minHeight: 720,
    show: false,
    autoHideMenuBar: true,
    title: "Karpik",
    webPreferences: {
      preload: resolvePreloadPath(__dirname)
    }
  });

  window.once("ready-to-show", () => {
    if (!startHidden) {
      window.show();
    }
  });

  loadRenderer(window);
  return window;
}

export function createQuickPopupWindow(_mainWindow: BrowserWindow): BrowserWindow {
  const popup = new BrowserWindow({
    width: 380,
    height: 392,
    show: false,
    frame: false,
    resizable: false,
    movable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    title: "Karpik Quick Access",
    backgroundColor: "#07101d",
    webPreferences: {
      preload: resolvePreloadPath(__dirname)
    }
  });

  loadRenderer(popup, { view: "quick-popup" });
  return popup;
}
