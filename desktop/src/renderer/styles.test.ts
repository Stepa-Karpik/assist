import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("renderer stylesheet", () => {
  it("keeps scrolling enabled for the main window and disabled for the quick popup", () => {
    const cssPath = path.resolve(process.cwd(), "src", "renderer", "styles.css");
    const css = fs.readFileSync(cssPath, "utf8");

    expect(css).toContain('body[data-karpik-view="main"]');
    expect(css).toContain("overflow-y: auto");
    expect(css).toContain('body[data-karpik-view="quick-popup"]');
    expect(css).toContain("overflow: hidden");
  });

  it("restores a single-column layout for standalone onboarding screens after shell overrides", () => {
    const cssPath = path.resolve(process.cwd(), "src", "renderer", "styles.css");
    const css = fs.readFileSync(cssPath, "utf8");
    const shellLayoutOverrideIndex = css.lastIndexOf(".desktop-layout {\n  grid-template-columns: 88px minmax(0, 1fr);");
    const standaloneOverrideIndex = css.lastIndexOf(".desktop-layout.desktop-layout--standalone {");

    expect(shellLayoutOverrideIndex).toBeGreaterThan(-1);
    expect(standaloneOverrideIndex).toBeGreaterThan(shellLayoutOverrideIndex);
  });
});
