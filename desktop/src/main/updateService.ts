type UpdatePhase = "disabled" | "idle" | "checking" | "downloading" | "downloaded" | "error";

export type UpdateState = {
  currentVersion: string;
  feedUrl: string | null;
  isSupported: boolean;
  phase: UpdatePhase;
  lastCheckedAt: string | null;
  availableReleaseName: string | null;
  message: string | null;
};

type UpdaterEventHandler = (...args: unknown[]) => void;

export type UpdaterAdapter = {
  setFeedURL: (options: { url: string }) => void;
  checkForUpdates: () => void | Promise<void>;
  quitAndInstall: () => void;
  on: (event: string, handler: UpdaterEventHandler) => void;
};

type CreateUpdateServiceOptions = {
  currentVersion: string;
  feedUrl: string | null;
  isPackaged: boolean;
  platform: NodeJS.Platform;
  updater: UpdaterAdapter;
  now?: () => Date;
};

function extractReleaseName(args: unknown[]): string | null {
  for (const candidate of args) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }

    if (candidate !== null && typeof candidate === "object") {
      const releaseName =
        "releaseName" in candidate && typeof candidate.releaseName === "string"
          ? candidate.releaseName
          : "version" in candidate && typeof candidate.version === "string"
            ? candidate.version
            : null;

      if (releaseName !== null && releaseName.trim().length > 0) {
        return releaseName.trim();
      }
    }
  }

  return null;
}

export function createUpdateService({
  currentVersion,
  feedUrl,
  isPackaged,
  platform,
  updater,
  now = () => new Date()
}: CreateUpdateServiceOptions) {
  const isSupported =
    platform === "win32" &&
    isPackaged &&
    typeof feedUrl === "string" &&
    feedUrl.trim().length > 0;
  let state: UpdateState = {
    currentVersion,
    feedUrl,
    isSupported,
    phase: isSupported ? "idle" : "disabled",
    lastCheckedAt: null,
    availableReleaseName: null,
    message: !isSupported
      ? feedUrl === null || feedUrl.trim().length === 0
        ? "Update feed is not configured."
        : platform !== "win32"
          ? "Desktop updater is supported only on Windows."
          : !isPackaged
            ? "Desktop updater is available only in the installed app."
            : "Desktop updater is unavailable."
      : null
  };

  function setState(nextState: Partial<UpdateState>): UpdateState {
    state = {
      ...state,
      ...nextState
    };
    return state;
  }

  if (isSupported && feedUrl !== null) {
    updater.setFeedURL({
      url: feedUrl
    });
    updater.on("checking-for-update", () => {
      setState({
        phase: "checking",
        lastCheckedAt: now().toISOString(),
        message: "Checking for updates..."
      });
    });
    updater.on("update-available", (...args: unknown[]) => {
      const releaseName = extractReleaseName(args);
      setState({
        phase: "downloading",
        availableReleaseName: releaseName,
        message:
          releaseName === null
            ? "Downloading update..."
            : `Downloading update ${releaseName}.`
      });
    });
    updater.on("update-not-available", () => {
      setState({
        phase: "idle",
        availableReleaseName: null,
        message: "No updates available."
      });
    });
    updater.on("update-downloaded", (...args: unknown[]) => {
      const releaseName = extractReleaseName(args) ?? state.availableReleaseName;
      setState({
        phase: "downloaded",
        availableReleaseName: releaseName,
        message:
          releaseName === null
            ? "Update is ready to install."
            : `Update ${releaseName} is ready to install.`
      });
    });
    updater.on("error", (...args: unknown[]) => {
      const message = args.find((candidate) => candidate instanceof Error);
      setState({
        phase: "error",
        message:
          message instanceof Error && message.message
            ? message.message
            : "Failed to check for updates."
      });
    });
  }

  return {
    getState(): UpdateState {
      return { ...state };
    },
    async checkForUpdates(): Promise<UpdateState> {
      if (!state.isSupported) {
        return { ...state };
      }

      if (state.phase === "downloaded") {
        return { ...state };
      }

      setState({
        phase: "checking",
        lastCheckedAt: now().toISOString(),
        message: "Checking for updates..."
      });

      try {
        await updater.checkForUpdates();
      } catch (error: unknown) {
        setState({
          phase: "error",
          message:
            error instanceof Error && error.message
              ? error.message
              : "Failed to check for updates."
        });
      }

      return { ...state };
    },
    installUpdate(): void {
      if (state.phase !== "downloaded") {
        throw new Error("Update is not ready to install.");
      }

      updater.quitAndInstall();
    }
  };
}
