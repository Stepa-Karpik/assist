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
    const shellLayoutOverrideMatch = /\.desktop-layout\s*\{\s*grid-template-columns:\s*88px minmax\(0,\s*1fr\);/m.exec(css);
    const standaloneOverrideMatch = /\.desktop-layout\.desktop-layout--standalone\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\);/m.exec(css);
    const shellLayoutOverrideIndex = shellLayoutOverrideMatch?.index ?? -1;
    const standaloneOverrideIndex = standaloneOverrideMatch?.index ?? -1;

    expect(shellLayoutOverrideIndex).toBeGreaterThan(-1);
    expect(standaloneOverrideIndex).toBeGreaterThan(shellLayoutOverrideIndex);
  });

  it("keeps chat list, thread, and composer on independent scroll/layout tracks", () => {
    const cssPath = path.resolve(process.cwd(), "src", "renderer", "styles.css");
    const css = fs.readFileSync(cssPath, "utf8");

    expect(css).toContain(".reference-chat-page__sidebar-column");
    expect(css).toContain("grid-template-rows: auto minmax(0, 1fr)");
    expect(css).toContain(".reference-chat-list");
    expect(css).toContain("overflow-y: auto");
    expect(css).toContain(".reference-thread-shell");
    expect(css).toContain("overflow: hidden");
    expect(css).toContain(".reference-thread-shell__messages");
    expect(css).toContain("overflow-y: auto");
    expect(css).toContain(".reference-thread-shell__composer");
    expect(css).toContain("position: sticky");
  });
});
