// @vitest-environment node

import { describe, expect, it } from "vitest";

import { PairingStore } from "./pairingStore";

describe("PairingStore", () => {
  it("opens a pairing session with one active code and a five-minute expiry", () => {
    const store = new PairingStore({
      now: () => new Date("2026-03-24T01:00:00.000Z"),
      codeFactory: () => "PAIR-01"
    });

    const state = store.openPairingSession();

    expect(state.code).toBe("PAIR-01");
    expect(state.expiresAt).toBe("2026-03-24T01:05:00.000Z");
    expect(state.isActive).toBe(true);
  });

  it("invalidates the previous code when a new session is opened", () => {
    const codes = ["PAIR-01", "PAIR-02"];
    const store = new PairingStore({
      now: () => new Date("2026-03-24T01:00:00.000Z"),
      codeFactory: () => codes.shift() ?? "PAIR-99"
    });

    store.openPairingSession();
    const state = store.openPairingSession();

    expect(state.code).toBe("PAIR-02");
  });

  it("adds the telegram user to the trusted allowlist when the code is valid", () => {
    const store = new PairingStore({
      now: () => new Date("2026-03-24T01:00:00.000Z"),
      codeFactory: () => "PAIR-01"
    });
    store.openPairingSession();

    const result = store.resolvePairAttempt({
      code: "PAIR-01",
      telegramUserId: 101
    });

    expect(result.result).toBe("paired");
    expect(result.trustedTelegramUserIds).toEqual([101]);
    expect(store.getState().isActive).toBe(false);
  });

  it("does not trust the user when the code is invalid", () => {
    const store = new PairingStore({
      now: () => new Date("2026-03-24T01:00:00.000Z"),
      codeFactory: () => "PAIR-01"
    });
    store.openPairingSession();

    const result = store.resolvePairAttempt({
      code: "WRONG",
      telegramUserId: 101
    });

    expect(result.result).toBe("invalid_code");
    expect(result.trustedTelegramUserIds).toEqual([]);
    expect(store.getState().isActive).toBe(true);
  });
});
