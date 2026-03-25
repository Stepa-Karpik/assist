import path from "node:path";

import { describe, expect, it } from "vitest";

import { resolvePreloadPath } from "./windows";

describe("resolvePreloadPath", () => {
  it("points packaged windows to the generated vite preload bundle", () => {
    const buildRoot = path.join("C:", "app", ".vite", "build");

    expect(resolvePreloadPath(buildRoot)).toBe(path.join(buildRoot, "index.js"));
  });
});
