import fs from "node:fs";
import path from "node:path";

export type AppPreferencesState = {
  launchAtLogin: boolean;
  startHiddenOnLaunch: boolean;
  closeToTrayOnClose: boolean;
};

type AppPreferencesStoreOptions = {
  settingsRoot: string;
};

type LoginItemSettingsTarget = {
  setLoginItemSettings: (settings: { openAtLogin: boolean; args?: string[] }) => void;
};

const defaultState: AppPreferencesState = {
  launchAtLogin: false,
  startHiddenOnLaunch: true,
  closeToTrayOnClose: true
};

export class AppPreferencesStore {
  private readonly filePath: string;

  private state: AppPreferencesState;

  constructor({ settingsRoot }: AppPreferencesStoreOptions) {
    this.filePath = path.join(settingsRoot, "app-preferences.json");
    this.state = this.load();
  }

  getState(): AppPreferencesState {
    return { ...this.state };
  }

  save(nextState: Partial<AppPreferencesState>): AppPreferencesState {
    this.state = {
      ...this.state,
      ...nextState
    };
    this.persist();
    return this.getState();
  }

  applyLoginItemSettings(target: LoginItemSettingsTarget): void {
    target.setLoginItemSettings({
      openAtLogin: this.state.launchAtLogin,
      args:
        this.state.launchAtLogin && this.state.startHiddenOnLaunch
          ? ["--start-hidden"]
          : []
    });
  }

  private load(): AppPreferencesState {
    if (!fs.existsSync(this.filePath)) {
      return { ...defaultState };
    }

    const raw = JSON.parse(fs.readFileSync(this.filePath, "utf8")) as Partial<AppPreferencesState>;

    return {
      launchAtLogin: raw.launchAtLogin ?? defaultState.launchAtLogin,
      startHiddenOnLaunch: raw.startHiddenOnLaunch ?? defaultState.startHiddenOnLaunch,
      closeToTrayOnClose: raw.closeToTrayOnClose ?? defaultState.closeToTrayOnClose
    };
  }

  private persist(): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(this.state, null, 2));
  }
}
