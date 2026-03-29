// @vitest-environment node

import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import forgeConfig from "../../forge.config";

type SquirrelMakerConfig = {
  name?: string;
  config?: {
    setupIcon?: string;
    loadingGif?: string;
  };
};

describe("squirrel installer branding", () => {
  it("wires branded setup assets into the Squirrel maker", () => {
    const makers = (forgeConfig.makers ?? []) as SquirrelMakerConfig[];
    const squirrelMaker = makers.find((maker) => maker.name === "@electron-forge/maker-squirrel");

    expect(squirrelMaker).toBeDefined();
    expect(squirrelMaker?.config).toMatchObject({
      setupIcon: path.resolve(process.cwd(), "build", "setup.ico"),
      loadingGif: path.resolve(process.cwd(), "build", "loading.gif")
    });
    expect(fs.existsSync(path.resolve(process.cwd(), "build", "setup.ico"))).toBe(true);
    expect(fs.existsSync(path.resolve(process.cwd(), "build", "loading.gif"))).toBe(true);
  });
});
