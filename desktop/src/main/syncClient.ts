export type OnlineEventPayload = {
  device_id: string;
  status: "online";
};

export type QueuePollPayload = {
  device_id: string;
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
    }
  };
}
