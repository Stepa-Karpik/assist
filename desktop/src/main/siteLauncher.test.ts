// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import { createSiteLauncher } from "./siteLauncher";

describe("createSiteLauncher", () => {
  it("opens a site through the injected external opener", async () => {
    const openExternal = vi.fn(async () => undefined);
    const launcher = createSiteLauncher({ openExternal });

    await launcher.open("https://youtube.com");

    expect(openExternal).toHaveBeenCalledWith("https://youtube.com");
  });
});
