import type { DevicePresenceResponse } from "./syncClient";

export type DevicePresenceSnapshot = {
  reachable: boolean;
  state: "online" | "offline";
  lastSeenAt: string | null;
};

const emptySnapshot: DevicePresenceSnapshot = {
  reachable: false,
  state: "offline",
  lastSeenAt: null
};

export function createDevicePresenceTracker(initialSnapshot: DevicePresenceSnapshot = emptySnapshot) {
  let snapshot = { ...initialSnapshot };

  return {
    markSuccess(response: DevicePresenceResponse) {
      snapshot = {
        reachable: true,
        state: response.is_online ? "online" : "offline",
        lastSeenAt: response.last_seen_at
      };
    },

    markFailure() {
      snapshot = {
        ...snapshot,
        reachable: false,
        state: "offline"
      };
    },

    getSnapshot(): DevicePresenceSnapshot {
      return { ...snapshot };
    }
  };
}
