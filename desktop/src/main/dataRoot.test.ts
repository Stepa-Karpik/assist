// @vitest-environment node

import { describe, expect, it } from "vitest";
import { getDataRoot } from "./dataRoot";

describe("getDataRoot", () => {
  it("builds the Karpik runtime path", () => {
    expect(getDataRoot("C:\\Users\\TBG\\AppData\\Roaming")).toContain("Karpik");
  });
});
