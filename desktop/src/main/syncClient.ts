export type OnlineEventPayload = {
  device_id: string;
  status: "online";
};

export type PairingResult = "paired" | "invalid_code" | "ignored";

export type QueuePollPayload = {
  device_id: string;
};

export type PairingOpenPayload = {
  device_id: string;
  expires_at: string;
};

export type PairingClosePayload = {
  device_id: string;
};

export type PairAttemptEvent = {
  event_id: string;
  type: "pair_attempt";
  device_id: string;
  telegram_user_id: number;
  chat_id: number;
  code: string;
  status: "pending" | "resolved" | "expired";
  result: PairingResult | null;
};

export type PairingEventListResponse = {
  items: PairAttemptEvent[];
};

export type PairingEventResolutionInput = {
  result: PairingResult;
  trustedTelegramUserId?: number;
};

export type PairingEventResolutionPayload = {
  result: PairingResult;
  trusted_telegram_user_id?: number;
};

type FetchLike = typeof fetch;

type SyncClientOptions = {
  serverUrl: string;
  deviceId: string;
  fetchImpl?: FetchLike;
};

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, "");
}

export function buildOnlineEventPayload(deviceId: string): OnlineEventPayload {
  return {
    device_id: deviceId,
    status: "online"
  };
}

export function buildQueuePollPayload(deviceId: string): QueuePollPayload {
  return {
    device_id: deviceId
  };
}

export function buildPairingOpenPayload(
  deviceId: string,
  expiresAt: string
): PairingOpenPayload {
  return {
    device_id: deviceId,
    expires_at: expiresAt
  };
}

export function buildPairingClosePayload(deviceId: string): PairingClosePayload {
  return {
    device_id: deviceId
  };
}

export function buildEventResolutionPayload(
  result: PairingResult,
  trustedTelegramUserId?: number
): PairingEventResolutionPayload {
  return trustedTelegramUserId === undefined
    ? { result }
    : {
        result,
        trusted_telegram_user_id: trustedTelegramUserId
      };
}

export function createSyncClient({
  serverUrl,
  deviceId,
  fetchImpl = globalThis.fetch
}: SyncClientOptions) {
  const baseUrl = trimTrailingSlashes(serverUrl);

  return {
    announceOnline() {
      return fetchImpl(`${baseUrl}/api/devices/online`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(buildOnlineEventPayload(deviceId))
      });
    },

    fetchQueuedTasks() {
      const params = new URLSearchParams(buildQueuePollPayload(deviceId));
      return fetchImpl(`${baseUrl}/api/tasks?${params.toString()}`, {
        method: "GET"
      });
    },

    openPairingSession(expiresAt: string) {
      return fetchImpl(`${baseUrl}/api/pairing/open`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(buildPairingOpenPayload(deviceId, expiresAt))
      });
    },

    closePairingSession() {
      return fetchImpl(`${baseUrl}/api/pairing/close`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(buildPairingClosePayload(deviceId))
      });
    },

    fetchPairingEvents() {
      const params = new URLSearchParams(buildQueuePollPayload(deviceId));
      return fetchImpl(`${baseUrl}/api/events?${params.toString()}`, {
        method: "GET"
      });
    },

    resolvePairingEvent(eventId: string, resolution: PairingEventResolutionInput) {
      return fetchImpl(`${baseUrl}/api/events/${eventId}/resolve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(
          buildEventResolutionPayload(resolution.result, resolution.trustedTelegramUserId)
        )
      });
    }
  };
}
