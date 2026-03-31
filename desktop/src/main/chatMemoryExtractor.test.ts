import { describe, expect, it } from "vitest";

import { extractChatMemoryWrites } from "./chatMemoryExtractor";

describe("extractChatMemoryWrites", () => {
  it("extracts direct profile facts and stack preferences", () => {
    const writes = extractChatMemoryWrites(
      "Меня зовут Карпов Степан Викторович, я программист на Python, использую FastAPI."
    );

    expect(writes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ target: "assist/profile", key: "full_name", value: "Карпов Степан Викторович" }),
        expect.objectContaining({ target: "assist/profile", key: "occupation", value: "программист" }),
        expect.objectContaining({ target: "assist/preferences", key: "preferred_stack", value: "Python, FastAPI" })
      ])
    );
  });

  it("extracts trusted source hints from URLs", () => {
    const writes = extractChatMemoryWrites(
      "Я видел примеры MCP на https://habr.com/ru/articles/899088/"
    );

    expect(writes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          target: "assist/docs/websites",
          key: "https://habr.com",
          value: "habr.com"
        }),
        expect.objectContaining({
          target: "assist/docs/papers",
          key: "https://habr.com/ru/articles/899088/",
          value: "https://habr.com/ru/articles/899088/"
        })
      ])
    );
  });

  it("extracts stable hardware facts and interests", () => {
    const writes = extractChatMemoryWrites(
      "Мне нравится изучать нейросети. У меня AMD Radeon RX 5700 XT, процессор Ryzen 5 3600 6-core, 32gb ozu и диск на 512 гб."
    );

    expect(writes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          target: "assist/preferences",
          key: "interests",
          value: "Нейросети"
        }),
        expect.objectContaining({
          target: "assist/profile",
          key: "gpu",
          value: "AMD Radeon RX 5700 XT"
        }),
        expect.objectContaining({
          target: "assist/profile",
          key: "cpu",
          value: "Ryzen 5 3600 6-core"
        }),
        expect.objectContaining({
          target: "assist/profile",
          key: "ram",
          value: "32 GB"
        }),
        expect.objectContaining({
          target: "assist/profile",
          key: "storage",
          value: "512 GB"
        })
      ])
    );
  });
});
