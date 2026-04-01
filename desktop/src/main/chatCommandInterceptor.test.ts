import { describe, expect, it } from "vitest";

import { createChatCommandInterceptor } from "./chatCommandInterceptor";

describe("createChatCommandInterceptor", () => {
  it("keeps ordinary self-description in conversation mode even if it mentions projects", () => {
    const interceptor = createChatCommandInterceptor();

    const result = interceptor.intercept(
      "Занимаюсь учебой, учусь в ДГТУ и параллельно делаю свои проекты."
    );

    expect(result).toEqual({
      kind: "conversation"
    });
  });

  it("intercepts a stable screenshot command", () => {
    const interceptor = createChatCommandInterceptor();

    const result = interceptor.intercept("Сделай скрин второго экрана");

    expect(result).toEqual({
      kind: "tool_action",
      intent: "screenshot screen-2"
    });
  });

  it("asks for clarification instead of guessing for ambiguous file send requests", () => {
    const interceptor = createChatCommandInterceptor();

    const result = interceptor.intercept("Скинь файл");

    expect(result).toEqual({
      kind: "clarify",
      question: "Уточни, какой именно файл нужно отправить."
    });
  });
});
