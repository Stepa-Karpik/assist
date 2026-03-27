import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { AppRegistryItem } from "./appRegistryStore";

const execFileAsync = promisify(execFile);

export type AppLaunchHandle = {
  pid: number | null;
  waitForExit: () => Promise<void>;
  kill?: () => Promise<void>;
};

type StartAppLaunch = (app: AppRegistryItem) => Promise<AppLaunchHandle>;

type AppLauncherOptions = {
  start?: StartAppLaunch;
};

async function defaultStart(app: AppRegistryItem): Promise<AppLaunchHandle> {
  const escapedPath = app.launchPath.replace(/'/g, "''");
  const { stdout } = await execFileAsync("powershell.exe", [
    "-NoProfile",
    "-Command",
    `$p = Start-Process -FilePath '${escapedPath}' -PassThru; $p.Id`
  ]);
  const pidText = stdout.trim();
  const pid = /^\d+$/.test(pidText) ? Number(pidText) : null;

  return {
    pid,
    async waitForExit() {
      if (pid === null) {
        return;
      }

      await execFileAsync("powershell.exe", [
        "-NoProfile",
        "-Command",
        `Wait-Process -Id ${pid}`
      ]);
    },
    kill:
      pid === null
        ? undefined
        : async () => {
            await execFileAsync("powershell.exe", [
              "-NoProfile",
              "-Command",
              `Stop-Process -Id ${pid} -Force`
            ]);
          }
  };
}

export function createAppLauncher({
  start = defaultStart
}: AppLauncherOptions = {}) {
  return {
    launch(app: AppRegistryItem): Promise<AppLaunchHandle> {
      return start(app);
    }
  };
}
