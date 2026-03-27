// @vitest-environment node

import { describe, expect, it } from "vitest";

describe("desktop runtime dependencies", () => {
  it("has qrcode installed for the main-process TOTP flow", () => {
    expect(() => require.resolve("qrcode")).not.toThrow();
  });
});
