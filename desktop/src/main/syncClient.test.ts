// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import {
  buildAuthConfigStatusPayload,
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

  it("describes the auth config status payload", () => {
    expect(
      buildAuthConfigStatusPayload("desktop-local", {
        passwordConfigured: true,
        totpConfigured: false
      })
    ).toEqual({
      device_id: "desktop-local",
      password_configured: true,
      totp_configured: false
    });
  });
});

describe("syncClient pairing api", () => {
  it("opens pairing sessions, syncs auth state, and resolves events", async () => {
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
    await client.announceAuthConfigState({
      passwordConfigured: true,
      totpConfigured: false
    });
    await client.fetchAuthEvents();
    await client.resolveAuthEvent("auth-1", {
      accepted: true
    });
    await client.fetchTaskHistory();
    await client.startTask("task-1");
    await client.completeTask("task-1", "desktop-local is online");
    await client.failTask("task-2", "Unsupported task intent.");

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

    expect(fetchImpl).toHaveBeenNthCalledWith(
      4,
      "http://127.0.0.1:8000/api/auth/config/status",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          device_id: "desktop-local",
          password_configured: true,
          totp_configured: false
        })
      })
    );

    expect(fetchImpl).toHaveBeenNthCalledWith(
      5,
      "http://127.0.0.1:8000/api/auth/events?device_id=desktop-local",
      expect.objectContaining({
        method: "GET"
      })
    );

    expect(fetchImpl).toHaveBeenNthCalledWith(
      6,
      "http://127.0.0.1:8000/api/auth/events/auth-1/resolve",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          accepted: true
        })
      })
    );

    expect(fetchImpl).toHaveBeenNthCalledWith(
      7,
      "http://127.0.0.1:8000/api/tasks?device_id=desktop-local&include_history=true",
      expect.objectContaining({
        method: "GET"
      })
    );

    expect(fetchImpl).toHaveBeenNthCalledWith(
      8,
      "http://127.0.0.1:8000/api/tasks/task-1/start",
      expect.objectContaining({
        method: "POST"
      })
    );

    expect(fetchImpl).toHaveBeenNthCalledWith(
      9,
      "http://127.0.0.1:8000/api/tasks/task-1/complete",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          result_text: "desktop-local is online"
        })
      })
    );

    expect(fetchImpl).toHaveBeenNthCalledWith(
      10,
      "http://127.0.0.1:8000/api/tasks/task-2/fail",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          error_text: "Unsupported task intent."
        })
      })
    );
  });
});
