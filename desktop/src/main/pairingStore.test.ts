// @vitest-environment node

import { describe, expect, it } from "vitest";

import { PairingStore } from "./pairingStore";

describe("PairingStore", () => {
  it("creates a draft pairing session with one active code and a five-minute expiry", () => {
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

  it("replaces the local draft with server-owned session state and trusted users", () => {
    const store = new PairingStore();

    const state = store.syncFromServerState({
      trustedTelegramUserIds: [101, 42],
      session: {
        code: "PAIR-77",
        expiresAt: "2030-03-24T01:05:00.000Z",
        status: "active"
      }
    });

    expect(state).toEqual({
      code: "PAIR-77",
      expiresAt: "2030-03-24T01:05:00.000Z",
      isActive: true,
      trustedTelegramUserIds: [42, 101]
    });
  });

  it("clears the active session when the server reports no active session", () => {
    const store = new PairingStore({
      now: () => new Date("2026-03-24T01:00:00.000Z"),
      codeFactory: () => "PAIR-01"
    });
    store.openPairingSession();

    const state = store.syncFromServerState({
      trustedTelegramUserIds: [101],
      session: null
    });

    expect(state).toEqual({
      code: null,
      expiresAt: null,
      isActive: false,
      trustedTelegramUserIds: [101]
    });
  });
});
