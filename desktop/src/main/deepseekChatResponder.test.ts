// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import { createDeepSeekChatResponder } from "./deepseekChatResponder";

describe("createDeepSeekChatResponder", () => {
  it("returns the deepseek reply text", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: "Привет. Чем помочь?"
              }
            }
          ]
        }),
        { status: 200 }
      )
    );
    const responder = createDeepSeekChatResponder({
      apiKey: "test-key",
      fetchImpl
    });

    await expect(responder.reply("привет")).resolves.toBe("Привет. Чем помочь?");
  });

  it("returns a safe russian fallback on failure", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 500 }));
    const responder = createDeepSeekChatResponder({
      apiKey: "test-key",
      fetchImpl
    });

    await expect(responder.reply("привет")).resolves.toBe(
      "Сейчас не получилось обработать обычный вопрос. Попробуйте ещё раз или уточните запрос."
    );
  });

  it("injects owner profile context into the system prompt", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: "Принято."
              }
            }
          ]
        }),
        { status: 200 }
      )
    );
    const responder = createDeepSeekChatResponder({
      apiKey: "test-key",
      fetchImpl
    });

    await responder.reply("какой план на день?", {
      ownerProfileContext: "Владелец: Степан Карпов\nГород: Москва"
    });

    const requestInit = ((fetchImpl.mock.calls as unknown) as Array<[string, RequestInit]>)[0]?.[1];
    const payload = JSON.parse(String(requestInit?.body)) as {
      messages: Array<{ role: string; content: string }>;
    };

    expect(payload.messages[0]?.content).toContain("Владелец: Степан Карпов");
    expect(payload.messages[0]?.content).toContain("Город: Москва");
  });
});
