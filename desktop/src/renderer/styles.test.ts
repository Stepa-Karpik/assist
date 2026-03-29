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
});
