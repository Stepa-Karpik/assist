export type RouterDecision =
  | {
      kind: "conversation";
      confidence: "default" | "model";
    }
  | {
      kind: "tool_action";
      intent: string;
      confidence: "default" | "model";
    }
  | {
      kind: "clarify";
      question: string;
      confidence: "default" | "model";
    };

export type RouterModelResolver = (text: string) => unknown;

type RouterModelOptions = {
  resolve?: RouterModelResolver;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function normalizeRouterDecision(value: unknown): RouterDecision {
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;

    if (record.kind === "tool_action" && isNonEmptyString(record.intent)) {
      return {
        kind: "tool_action",
        intent: record.intent.trim(),
        confidence: "model"
      };
    }

    if (record.kind === "clarify" && isNonEmptyString(record.question)) {
      return {
        kind: "clarify",
        question: record.question.trim(),
        confidence: "model"
      };
    }
  }

  return {
    kind: "conversation",
    confidence: "default"
  };
}

export function createRouterModel({ resolve }: RouterModelOptions = {}) {
  return {
    decide(text: string): RouterDecision {
      if (resolve === undefined) {
        return {
          kind: "conversation",
          confidence: "default"
        };
      }

      try {
        return normalizeRouterDecision(resolve(text));
      } catch {
        return {
          kind: "conversation",
          confidence: "default"
        };
      }
    }
  };
}
