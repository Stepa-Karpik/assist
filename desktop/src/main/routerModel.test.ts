import { describe, expect, it } from "vitest";

import { createRouterModel, normalizeRouterDecision } from "./routerModel";

describe("routerModel", () => {
  it("degrades to conversation by default", () => {
    const model = createRouterModel();

    expect(model.decide("расскажи про FastAPI")).toEqual({
      kind: "conversation",
      confidence: "default"
    });
  });

  it("degrades malformed model output to conversation", () => {
    expect(normalizeRouterDecision({ kind: "tool_action", intent: "" })).toEqual({
      kind: "conversation",
      confidence: "default"
    });
  });

  it("preserves valid structured tool actions", () => {
    const model = createRouterModel({
      resolve: () => ({
        kind: "tool_action",
        intent: "screenshot screen-2"
      })
    });

    expect(model.decide("сделай скрин второго экрана")).toEqual({
      kind: "tool_action",
      intent: "screenshot screen-2",
      confidence: "model"
    });
  });
});
