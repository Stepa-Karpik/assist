import { Menu, Tray, nativeImage, screen, type BrowserWindow } from "electron";

import { calculateQuickPopupBounds } from "./windows";

function getTrayIcon() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <rect width="32" height="32" rx="9" fill="#22c55e" />
      <path d="M10 8h4v7.5L20.5 8H25l-7.2 9.1L25 24h-4.6L15 17.6V24h-5z" fill="#09111f" />
    </svg>
  `.trim();
  const icon = nativeImage.createFromDataURL(
    `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`
  );

  return icon.resize({ width: 16, height: 16 });
}

type TrayWindows = {
  mainWindow: BrowserWindow;
  quickPopup: BrowserWindow;
};

function placeQuickPopup(tray: Tray, quickPopup: BrowserWindow) {
  const trayBounds = tray.getBounds();
  const popupBounds = quickPopup.getBounds();
  const display = screen.getDisplayNearestPoint({
    x: trayBounds.x + Math.round(trayBounds.width / 2),
    y: trayBounds.y + Math.round(trayBounds.height / 2)
  });

  quickPopup.setBounds(
    calculateQuickPopupBounds({
      trayBounds,
      workArea: display.workArea,
      popupWidth: popupBounds.width,
      popupHeight: popupBounds.height
    })
  );
}

export function createAppTray({ mainWindow, quickPopup }: TrayWindows): Tray {
  const tray = new Tray(getTrayIcon());

  const showMainWindow = () => {
    quickPopup.hide();
    mainWindow.show();
    mainWindow.focus();
  };

  tray.setToolTip("Karpik");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "Открыть окно",
        click: showMainWindow
      },
      {
        type: "separator"
      },
      {
        label: "Выход",
        role: "quit"
      }
    ])
  );

  quickPopup.on("blur", () => {
    if (quickPopup.isVisible()) {
      quickPopup.hide();
    }
  });

  tray.on("click", () => {
    if (quickPopup.isVisible()) {
      quickPopup.hide();
      return;
    }

    placeQuickPopup(tray, quickPopup);
    quickPopup.show();
    quickPopup.focus();
  });

  return tray;
}
