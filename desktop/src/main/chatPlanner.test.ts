import { describe, expect, it } from "vitest";

import { createChatPlanner } from "./chatPlanner";

describe("createChatPlanner", () => {
  it("builds a multi-action conversational plan for a technical question with direct user facts", () => {
    const planner = createChatPlanner();

    const plan = planner.plan(
      "Меня зовут Карпов Степан Викторович, я программист на Python, использую FastAPI, знаешь что-нибудь про его свежие обновления?"
    );

    expect(plan.mode).toBe("conversation");
    expect(plan.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "visible_reply", strategy: "deepseek" }),
        expect.objectContaining({ kind: "knowledge_lookup", query: "FastAPI" }),
        expect.objectContaining({
          kind: "knowledge_write",
          writes: expect.arrayContaining([
            expect.objectContaining({ target: "assist/profile", key: "full_name", value: "Карпов Степан Викторович" }),
            expect.objectContaining({ target: "assist/profile", key: "occupation", value: "программист" }),
            expect.objectContaining({ target: "assist/preferences", key: "preferred_stack", value: "Python, FastAPI" })
          ])
        }),
        expect.objectContaining({ kind: "follow_up" })
      ])
    );
  });

  it("keeps explicit device actions in task mode", () => {
    const planner = createChatPlanner();

    const plan = planner.plan("скинь скриншот");

    expect(plan.mode).toBe("task");
    expect(plan.actions).toEqual([
      expect.objectContaining({ kind: "device_task", intent: "screenshot" })
    ]);
  });

  it("keeps article discussion about codex in conversational mode", () => {
    const planner = createChatPlanner();

    const plan = planner.plan(
      "читаю на хабре https://habr.com/ru/articles/912576/, например про то, как работает codex, знаешь что нибудь об этом?"
    );

    expect(plan.mode).toBe("conversation");
    expect(plan.actions).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "visible_reply", strategy: "deepseek" })])
    );
  });
});
