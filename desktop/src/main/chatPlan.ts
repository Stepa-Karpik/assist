export type ChatKnowledgeWrite = {
  target:
    | "assist/profile"
    | "assist/preferences"
    | "assist/observations"
    | "assist/docs/websites"
    | "assist/docs/papers";
  key: string;
  value: string;
};

export type ChatPlanAction =
  | {
      kind: "visible_reply";
      strategy: "deepseek" | "static" | "codex";
    }
  | {
      kind: "knowledge_lookup";
      query: string;
    }
  | {
      kind: "knowledge_write";
      writes: ChatKnowledgeWrite[];
    }
  | {
      kind: "clarify";
      text: string;
    }
  | {
      kind: "device_task";
      intent: string;
    }
  | {
      kind: "follow_up";
      suggestion: string;
    };

export type ChatPlan = {
  mode: "conversation" | "task";
  actions: ChatPlanAction[];
};
