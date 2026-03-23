// @vitest-environment node

import { describe, expect, it } from "vitest";

import { buildOnlineEventPayload, buildQueuePollPayload } from "./syncClient";

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
});
