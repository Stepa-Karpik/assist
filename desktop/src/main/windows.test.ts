import path from "node:path";

import { describe, expect, it } from "vitest";

import { calculateQuickPopupBounds, resolvePreloadPath } from "./windows";

describe("resolvePreloadPath", () => {
  it("points packaged windows to the generated vite preload bundle", () => {
    const buildRoot = path.join("C:", "app", ".vite", "build");

    expect(resolvePreloadPath(buildRoot)).toBe(path.join(buildRoot, "index.js"));
  });
});

describe("calculateQuickPopupBounds", () => {
  it("positions the popup above a bottom tray and keeps it within work area", () => {
    const bounds = calculateQuickPopupBounds({
      trayBounds: { x: 1800, y: 1040, width: 40, height: 40 },
      workArea: { x: 0, y: 0, width: 1920, height: 1080 },
      popupWidth: 420,
      popupHeight: 470
    });

    expect(bounds.y).toBeLessThan(1040);
    expect(bounds.x).toBeLessThanOrEqual(1920 - 420 - 8);
  });

  it("positions the popup below a top tray and clamps x to the visible work area", () => {
    const bounds = calculateQuickPopupBounds({
      trayBounds: { x: 4, y: 0, width: 32, height: 32 },
      workArea: { x: 0, y: 0, width: 1280, height: 720 },
      popupWidth: 420,
      popupHeight: 470
    });

    expect(bounds.y).toBeGreaterThanOrEqual(40);
    expect(bounds.x).toBe(8);
  });
});
