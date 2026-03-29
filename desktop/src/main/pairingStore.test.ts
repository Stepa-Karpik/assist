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

  it("replaces trusted ids from server state instead of mutating them locally", () => {
    const store = new PairingStore({
      now: () => new Date("2026-03-24T01:00:00.000Z"),
      codeFactory: () => "PAIR-01"
    });

    store.applyRemoteState({
      code: null,
      expiresAt: null,
      isActive: false,
      trustedTelegramUserIds: [101]
    });
    store.openPairingSession();
    store.applyRemoteState({
      code: "PAIR-01",
      expiresAt: "2026-03-24T01:05:00.000Z",
      isActive: true,
      trustedTelegramUserIds: [101, 202]
    });

    expect(store.getState().trustedTelegramUserIds).toEqual([101, 202]);
  });

  it("clears stale active session from server state when pairing is consumed", () => {
    const store = new PairingStore({
      now: () => new Date("2026-03-24T01:00:00.000Z"),
      codeFactory: () => "PAIR-01"
    });
    store.openPairingSession();

    store.applyRemoteState({
      code: null,
      expiresAt: null,
      isActive: false,
      trustedTelegramUserIds: [101]
    });

    expect(store.getState()).toEqual({
      code: null,
      expiresAt: null,
      isActive: false,
      trustedTelegramUserIds: [101]
    });
  });
});
