export type OnlineEventPayload = {
  device_id: string;
  status: "online";
};

export type PairingResult = "paired" | "invalid_code" | "ignored";
export type AuthConfigState = {
  passwordConfigured: boolean;
  totpConfigured: boolean;
};

export type RemoteTaskStatus =
  | "queued"
  | "awaiting_auth"
  | "awaiting_local_approval"
  | "blocked"
  | "running"
  | "done"
  | "failed"
  | "stalled";

export type RemoteTaskRecord = {
  task_id: string;
  device_id?: string;
  intent: string;
  source?: "desktop" | "telegram";
  status: RemoteTaskStatus;
  risk?: "low" | "medium" | "high";
  required_auth?: "none" | "password" | "password_and_totp" | "local_only";
  telegram_user_id?: number | null;
  chat_id?: number | null;
  challenge_id?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  result_text?: string | null;
  error_text?: string | null;
  attempt_count?: number;
  created_at?: string;
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

export type TaskListResponse = {
  items: RemoteTaskRecord[];
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

    fetchTaskHistory() {
      const params = new URLSearchParams({
        ...buildQueuePollPayload(deviceId),
        include_history: "true"
      });
      return fetchImpl(`${baseUrl}/api/tasks?${params.toString()}`, {
        method: "GET"
      });
    },

    startTask(taskId: string) {
      return fetchImpl(`${baseUrl}/api/tasks/${taskId}/start`, {
        method: "POST"
      });
    },

    completeTask(taskId: string, resultText: string) {
      return fetchImpl(`${baseUrl}/api/tasks/${taskId}/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          result_text: resultText
        })
      });
    },

    failTask(taskId: string, errorText: string) {
      return fetchImpl(`${baseUrl}/api/tasks/${taskId}/fail`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          error_text: errorText
        })
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
