// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import type { AppRegistryItem } from "./appRegistryStore";
import { createAppLauncher } from "./appLauncher";

const app: AppRegistryItem = {
  appId: "app-osu",
  displayName: "osu! lazer",
  launchPath: "C:\\Games\\osu!\\osu!.exe",
  aliases: ["osu", "осу"],
  linked: true,
  source: "manual"
};

describe("createAppLauncher", () => {
  it("returns a deferred launch handle from the injected launcher", async () => {
    const kill = vi.fn();
    const waitForExit = vi.fn(async () => undefined);
    const start = vi.fn(async () => ({
      pid: 4242,
      waitForExit,
      kill
    }));
    const launcher = createAppLauncher({ start });

    const handle = await launcher.launch(app);
    await handle.waitForExit();
    await handle.kill?.();

    expect(start).toHaveBeenCalledWith(app);
    expect(handle.pid).toBe(4242);
    expect(waitForExit).toHaveBeenCalledTimes(1);
    expect(kill).toHaveBeenCalledTimes(1);
  });
});
