export type OnlineEventPayload = {
  device_id: string;
  status: "online";
};

export type RemoteAppCatalogSource =
  | "manual"
  | "shortcut"
  | "start_menu"
  | "program_files"
  | "discovered";

export type RemoteAppCatalogItem = {
  appId: string;
  displayName: string;
  aliases: string[];
  linked: boolean;
  source: RemoteAppCatalogSource;
};

export type RemoteAppCatalogResponse = {
  device_id: string;
  items: Array<{
    app_id: string;
    display_name: string;
    aliases: string[];
    linked: boolean;
    source: RemoteAppCatalogSource;
  }>;
};

export type DevicePresenceResponse = {
  device_id: string;
  status: "online";
  last_seen_at: string;
  is_online: boolean;
  acknowledged: boolean;
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
  | "cancel_requested"
  | "cancelled"
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
  artifact_kind?: "image_base64" | "file_base64" | null;
  artifact_mime_type?: string | null;
  artifact_file_name?: string | null;
  artifact_base64?: string | null;
  attempt_count?: number;
  created_at?: string;
};

export type TaskResultArtifact = {
  kind: "image_base64" | "file_base64";
  mimeType: string;
  fileName: string;
  contentBase64: string;
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

export function buildAppCatalogSyncPayload(
  deviceId: string,
  items: RemoteAppCatalogItem[]
): RemoteAppCatalogResponse {
  return {
    device_id: deviceId,
    items: items.map((item) => ({
      app_id: item.appId,
      display_name: item.displayName,
      aliases: [...item.aliases],
      linked: item.linked,
      source: item.source
    }))
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

    fetchDevicePresence() {
      return fetchImpl(`${baseUrl}/api/devices/${deviceId}`, {
        method: "GET"
      });
    },

    startTask(taskId: string) {
      return fetchImpl(`${baseUrl}/api/tasks/${taskId}/start`, {
        method: "POST"
      });
    },

    awaitLocalApproval(taskId: string, resultText: string) {
      return fetchImpl(`${baseUrl}/api/tasks/${taskId}/awaiting-local-approval`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          result_text: resultText
        })
      });
    },

    completeTask(taskId: string, payload: { resultText: string; artifact?: TaskResultArtifact }) {
      return fetchImpl(`${baseUrl}/api/tasks/${taskId}/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          result_text: payload.resultText,
          artifact:
            payload.artifact === undefined
              ? undefined
              : {
                  kind: payload.artifact.kind,
                  mime_type: payload.artifact.mimeType,
                  file_name: payload.artifact.fileName,
                  content_base64: payload.artifact.contentBase64
                }
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

    retryTask(taskId: string) {
      return fetchImpl(`${baseUrl}/api/tasks/${taskId}/retry`, {
        method: "POST"
      });
    },

    cancelTask(taskId: string, errorText = "Cancelled by operator.") {
      return fetchImpl(`${baseUrl}/api/tasks/${taskId}/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          error_text: errorText
        })
      });
    },

    blockTask(taskId: string, errorText: string) {
      return fetchImpl(`${baseUrl}/api/tasks/${taskId}/block`, {
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
    },

    syncAppCatalog(items: RemoteAppCatalogItem[]) {
      return fetchImpl(`${baseUrl}/api/apps/catalog`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(buildAppCatalogSyncPayload(deviceId, items))
      });
    },

    fetchAppCatalog() {
      const params = new URLSearchParams({
        device_id: deviceId
      });
      return fetchImpl(`${baseUrl}/api/apps?${params.toString()}`, {
        method: "GET"
      });
    }
  };
}
