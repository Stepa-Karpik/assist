// @vitest-environment node

import { describe, expect, it } from "vitest";

import { decideKnowledgeWrites } from "./knowledgeIngestDecider";

describe("decideKnowledgeWrites", () => {
  it("creates user and assist writes for explicit documentation requests", () => {
    const plan = decideKnowledgeWrites({
      origin: "local-chat",
      prompt: "добавь документацию по FastAPI, источник https://fastapi.tiangolo.com/",
      answer: "FastAPI строит API вокруг type hints, Pydantic и ASGI."
    });

    expect(plan.userWrites).toHaveLength(1);
    expect(plan.assistWrites).toHaveLength(1);
    expect(plan.skillApprovalDrafts).toHaveLength(0);
    expect(plan.userWrites[0]).toMatchObject({
      topicTrail: ["Backend", "Python", "FastAPI"],
      preferredLeaf: "FastAPI"
    });
    expect(plan.assistWrites[0].sourceUrls).toContain("https://fastapi.tiangolo.com/");
  });

  it("ignores lightweight greetings and other non-knowledge chatter", () => {
    const plan = decideKnowledgeWrites({
      origin: "local-chat",
      prompt: "привет",
      answer: "Привет. Чем помочь?"
    });

    expect(plan).toEqual({
      userWrites: [],
      assistWrites: [],
      skillApprovalDrafts: []
    });
  });

  it("creates a pending assist skill draft for significant skill changes", () => {
    const plan = decideKnowledgeWrites({
      origin: "local-chat",
      prompt: "научись новому workflow triage багов",
      answer: "Буду раскладывать инциденты по severity, owner и rollback-path.",
      skillChangeSeverity: "significant"
    });

    expect(plan.userWrites).toHaveLength(0);
    expect(plan.assistWrites).toHaveLength(0);
    expect(plan.skillApprovalDrafts).toEqual([
      expect.objectContaining({
        kind: "assist_skill",
        intent: "научись новому workflow triage багов",
        changedFiles: ["assist/skills/Навык новому workflow triage багов.md"]
      })
    ]);
  });

  it("does not turn pronouns into topic names for article questions", () => {
    const plan = decideKnowledgeWrites({
      origin: "telegram-chat",
      prompt:
        "читаю на хабре https://habr.com/ru/articles/912576/, например про то, как работает codex, знаешь что нибудь об этом?",
      answer: "Codex помогает работать с кодовой базой и запускать изменения из CLI."
    });

    expect(plan.userWrites).toHaveLength(1);
    expect(plan.assistWrites).toHaveLength(1);
    expect(plan.userWrites[0]?.preferredLeaf).toBe("Codex");
    expect(plan.assistWrites[0]?.preferredLeaf).toBe("Codex");
  });

  it("merges source urls from structured memory writes", () => {
    const plan = decideKnowledgeWrites({
      origin: "telegram-chat",
      prompt: "добавь документацию по FastAPI",
      answer: "FastAPI строит API вокруг type hints.",
      memoryWrites: [
        {
          target: "assist/docs/papers",
          key: "https://fastapi.tiangolo.com/release-notes/",
          value: "Release Notes"
        }
      ]
    });

    expect(plan.userWrites[0]?.sourceUrls).toContain(
      "https://fastapi.tiangolo.com/release-notes/"
    );
    expect(plan.assistWrites[0]?.sourceUrls).toContain(
      "https://fastapi.tiangolo.com/release-notes/"
    );
  });

  it("treats rich self-description as memory-worthy even without documentation urls", () => {
    const plan = decideKnowledgeWrites({
      origin: "local-chat",
      prompt:
        "Занимаюсь учебой, учусь в ДГТУ на кафедре Кибербезопасность на втором курсе, параллельно делаю свои проекты. Предпочитаю быть в тишине. Играю в osu. Хочу стать фрилансером. Ценю честность.",
      answer:
        "Профиль выглядит спокойным, технически ориентированным и нацеленным на автономную работу."
    });

    expect(plan.assistWrites.length).toBeGreaterThan(0);
    expect(plan.userWrites).toHaveLength(0);
    expect(plan.skillApprovalDrafts).toHaveLength(0);
  });
});
