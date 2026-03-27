import { shell } from "electron";

type SiteLauncherOptions = {
  openExternal?: (url: string) => Promise<void>;
};

export function createSiteLauncher({
  openExternal = (url: string) => shell.openExternal(url).then(() => undefined)
}: SiteLauncherOptions = {}) {
  return {
    open(url: string): Promise<void> {
      return openExternal(url);
    }
  };
}
