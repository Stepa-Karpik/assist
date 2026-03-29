// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import {
  buildAppCatalogSyncPayload,
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
    expect(buildPairingOpenPayload("desktop-local", "PAIR-01", "2026-03-24T00:05:00.000Z")).toEqual({
      device_id: "desktop-local",
      code: "PAIR-01",
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

  it("describes the app catalog sync payload", () => {
    expect(
      buildAppCatalogSyncPayload("desktop-local", [
        {
          appId: "app-osu",
          displayName: "osu! lazer",
          aliases: ["osu", "осу", "osu lazer"],
          linked: true,
          source: "manual"
        }
      ])
    ).toEqual({
      device_id: "desktop-local",
      items: [
        {
          app_id: "app-osu",
          display_name: "osu! lazer",
          aliases: ["osu", "осу", "osu lazer"],
          linked: true,
          source: "manual"
        }
      ]
    });
  });
});

describe("syncClient pairing api", () => {
  it("opens pairing sessions, reads pairing state, and syncs auth state", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 200 }));
    const client = createSyncClient({
      serverUrl: "http://127.0.0.1:8000/",
      deviceId: "desktop-local",
      fetchImpl
    });

    await client.openPairingSession("PAIR-01", "2026-03-24T00:05:00.000Z");
    await client.fetchPairingState();
    await client.announceAuthConfigState({
      passwordConfigured: true,
      totpConfigured: false
    });
    await client.fetchAuthEvents();
    await client.resolveAuthEvent("auth-1", {
      accepted: true
    });
    await client.syncAppCatalog([
      {
        appId: "app-osu",
        displayName: "osu! lazer",
        aliases: ["osu", "осу", "osu lazer"],
        linked: true,
        source: "manual"
      }
    ]);
    await client.fetchAppCatalog();
    await client.fetchTaskSnapshot();
    await client.fetchTaskHistory({ limit: 50 });
    await client.fetchTask("task-1");
    await client.fetchDevicePresence();
    await client.startTask("task-1");
    await client.completeTask("task-1", {
      resultText: "desktop-local is online"
    });
    await client.failTask("task-2", "Unsupported task intent.");
    await client.retryTask("task-2");

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
          code: "PAIR-01",
          expires_at: "2026-03-24T00:05:00.000Z"
        })
      })
    );

    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      "http://127.0.0.1:8000/api/pairing/state?device_id=desktop-local",
      expect.objectContaining({
        method: "GET"
      })
    );

    expect(fetchImpl).toHaveBeenNthCalledWith(
      3,
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
      4,
      "http://127.0.0.1:8000/api/auth/events?device_id=desktop-local",
      expect.objectContaining({
        method: "GET"
      })
    );

    expect(fetchImpl).toHaveBeenNthCalledWith(
      5,
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
      6,
      "http://127.0.0.1:8000/api/apps/catalog",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          device_id: "desktop-local",
          items: [
            {
              app_id: "app-osu",
              display_name: "osu! lazer",
              aliases: ["osu", "осу", "osu lazer"],
              linked: true,
              source: "manual"
            }
          ]
        })
      })
    );

    expect(fetchImpl).toHaveBeenNthCalledWith(
      7,
      "http://127.0.0.1:8000/api/apps?device_id=desktop-local",
      expect.objectContaining({
        method: "GET"
      })
    );

    expect(fetchImpl).toHaveBeenNthCalledWith(
      8,
      "http://127.0.0.1:8000/api/tasks?device_id=desktop-local&include_history=true&limit=25",
      expect.objectContaining({
        method: "GET"
      })
    );

    expect(fetchImpl).toHaveBeenNthCalledWith(
      9,
      "http://127.0.0.1:8000/api/tasks?device_id=desktop-local&include_history=true&limit=50",
      expect.objectContaining({
        method: "GET"
      })
    );

    expect(fetchImpl).toHaveBeenNthCalledWith(
      10,
      "http://127.0.0.1:8000/api/tasks/task-1",
      expect.objectContaining({
        method: "GET"
      })
    );

    expect(fetchImpl).toHaveBeenNthCalledWith(
      11,
      "http://127.0.0.1:8000/api/devices/desktop-local",
      expect.objectContaining({
        method: "GET"
      })
    );

    expect(fetchImpl).toHaveBeenNthCalledWith(
      12,
      "http://127.0.0.1:8000/api/tasks/task-1/start",
      expect.objectContaining({
        method: "POST"
      })
    );

    expect(fetchImpl).toHaveBeenNthCalledWith(
      13,
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
      14,
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

    expect(fetchImpl).toHaveBeenNthCalledWith(
      15,
      "http://127.0.0.1:8000/api/tasks/task-2/retry",
      expect.objectContaining({
        method: "POST"
      })
    );
  });
});
