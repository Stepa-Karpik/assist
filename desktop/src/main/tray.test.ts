// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import { buildTrayMenuTemplate } from "./tray";

describe("buildTrayMenuTemplate", () => {
  it("includes an explicit quit action in the tray menu", () => {
    const onOpen = vi.fn();

    const template = buildTrayMenuTemplate(onOpen);

    expect(template[0]).toMatchObject({
      label: "Открыть окно",
      click: onOpen
    });
    expect(template.at(-1)).toMatchObject({
      label: "Выход",
      role: "quit"
    });
  });
});
