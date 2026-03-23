import { Menu, Tray, nativeImage, type BrowserWindow } from "electron";

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

export function createAppTray({ mainWindow, quickPopup }: TrayWindows): Tray {
  const tray = new Tray(getTrayIcon());

  const showMainWindow = () => {
    mainWindow.show();
    mainWindow.focus();
  };

  tray.setToolTip("Karpik");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "Open Window",
        click: showMainWindow
      },
      {
        type: "separator"
      },
      {
        label: "Close",
        role: "quit"
      }
    ])
  );

  tray.on("click", () => {
    if (quickPopup.isVisible()) {
      quickPopup.hide();
      return;
    }

    quickPopup.show();
    quickPopup.focus();
  });

  return tray;
}
