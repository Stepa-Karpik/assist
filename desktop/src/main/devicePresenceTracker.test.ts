// @vitest-environment node

import { describe, expect, it } from "vitest";

import { createDevicePresenceTracker } from "./devicePresenceTracker";

describe("createDevicePresenceTracker", () => {
  it("tracks the last successful heartbeat", () => {
    const tracker = createDevicePresenceTracker();

    tracker.markSuccess({
      device_id: "desktop-local",
      status: "online",
      last_seen_at: "2026-03-24T12:25:00.000Z",
      is_online: true,
      acknowledged: true
    });

    expect(tracker.getSnapshot()).toEqual({
      reachable: true,
      state: "online",
      lastSeenAt: "2026-03-24T12:25:00.000Z"
    });
  });

  it("marks the heartbeat as unreachable after a failure", () => {
    const tracker = createDevicePresenceTracker();

    tracker.markSuccess({
      device_id: "desktop-local",
      status: "online",
      last_seen_at: "2026-03-24T12:25:00.000Z",
      is_online: true,
      acknowledged: true
    });
    tracker.markFailure();

    expect(tracker.getSnapshot()).toEqual({
      reachable: false,
      state: "offline",
      lastSeenAt: "2026-03-24T12:25:00.000Z"
    });
  });
});
