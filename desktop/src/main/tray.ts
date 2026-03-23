import { Menu, Tray, nativeImage, type BrowserWindow } from "electron";

function getTrayIcon() {
  return nativeImage.createEmpty();
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
