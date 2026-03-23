// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import {
  buildEventResolutionPayload,
  buildOnlineEventPayload,
  buildPairingOpenPayload,
  buildQueuePollPayload,
  createSyncClient
} from "./syncClient";

describe("syncClient payload builders", () => {
  it("describes the online event payload", () => {
    expect(buildOnlineEventPayload("desktop-local")).toEqual({
      device_id: "desktop-local",
      status: "online"
    });
  });

  it("describes the queue poll payload", () => {
    expect(buildQueuePollPayload("desktop-local")).toEqual({
      device_id: "desktop-local"
    });
  });

  it("describes the pairing session payload", () => {
    expect(buildPairingOpenPayload("desktop-local", "2026-03-24T00:05:00.000Z")).toEqual({
      device_id: "desktop-local",
      expires_at: "2026-03-24T00:05:00.000Z"
    });
  });

  it("describes the pairing event resolution payload", () => {
    expect(buildEventResolutionPayload("paired", 42)).toEqual({
      result: "paired",
      trusted_telegram_user_id: 42
    });

    expect(buildEventResolutionPayload("invalid_code")).toEqual({
      result: "invalid_code"
    });
  });
});

describe("syncClient pairing api", () => {
  it("opens pairing sessions and resolves pairing events", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 200 }));
    const client = createSyncClient({
      serverUrl: "http://127.0.0.1:8000/",
      deviceId: "desktop-local",
      fetchImpl
    });

    await client.openPairingSession("2026-03-24T00:05:00.000Z");
    await client.fetchPairingEvents();
    await client.resolvePairingEvent("evt-1", {
      result: "paired",
      trustedTelegramUserId: 42
    });

    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      "http://127.0.0.1:8000/api/pairing/open",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          device_id: "desktop-local",
          expires_at: "2026-03-24T00:05:00.000Z"
        })
      })
    );

    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      "http://127.0.0.1:8000/api/events?device_id=desktop-local",
      expect.objectContaining({
        method: "GET"
      })
    );

    expect(fetchImpl).toHaveBeenNthCalledWith(
      3,
      "http://127.0.0.1:8000/api/events/evt-1/resolve",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          result: "paired",
          trusted_telegram_user_id: 42
        })
      })
    );
  });
});
