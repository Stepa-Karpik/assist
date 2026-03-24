export type OnlineEventPayload = {
  device_id: string;
  status: "online";
};

export type PairingResult = "paired" | "invalid_code" | "ignored";
export type AuthConfigState = {
  passwordConfigured: boolean;
  totpConfigured: boolean;
};

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

export type AuthConfigStatusPayload = {
  device_id: string;
  password_configured: boolean;
  totp_configured: boolean;
};

export type AuthInputEvent = {
  event_id: string;
  type: "auth_input";
  device_id: string;
  challenge_id: string;
  telegram_user_id: number;
  chat_id: number;
  step: "password" | "totp" | "confirm";
  value: string;
  status: "pending" | "resolved";
  accepted: boolean | null;
};

export type AuthEventListResponse = {
  items: AuthInputEvent[];
};

export type AuthEventResolutionInput = {
  accepted: boolean;
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

export function buildAuthConfigStatusPayload(
  deviceId: string,
  state: AuthConfigState
): AuthConfigStatusPayload {
  return {
    device_id: deviceId,
    password_configured: state.passwordConfigured,
    totp_configured: state.totpConfigured
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
    },

    announceAuthConfigState(state: AuthConfigState) {
      return fetchImpl(`${baseUrl}/api/auth/config/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(buildAuthConfigStatusPayload(deviceId, state))
      });
    },

    fetchAuthEvents() {
      const params = new URLSearchParams(buildQueuePollPayload(deviceId));
      return fetchImpl(`${baseUrl}/api/auth/events?${params.toString()}`, {
        method: "GET"
      });
    },

    resolveAuthEvent(eventId: string, resolution: AuthEventResolutionInput) {
      return fetchImpl(`${baseUrl}/api/auth/events/${eventId}/resolve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(resolution)
      });
    }
  };
}
