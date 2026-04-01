// @vitest-environment node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createKnowledgeBackgroundWriter } from "./knowledgeBackgroundWriter";
import { DOCS_REGISTRY_FILE_NAME } from "./knowledgeVaultConstants";
import { LocalApprovalStore } from "./localApprovalStore";

const tempRoots: string[] = [];

function createRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "karpik-knowledge-background-"));
  tempRoots.push(root);
  return root;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("createKnowledgeBackgroundWriter", () => {
  it("persists website and paper memory writes into assist docs", async () => {
    const root = createRoot();
    const vaultRoot = path.join(root, "vault");
    const writer = createKnowledgeBackgroundWriter({
      getVaultRoot: () => vaultRoot
    });

    await writer.recordInteraction({
      origin: "telegram-chat",
      prompt: "читаю статью на хабре про Codex",
      answer: "Это статья про то, как Codex работает на практике.",
      memoryWrites: [
        {
          target: "assist/docs/websites",
          key: "https://habr.com",
          value: "habr.com"
        },
        {
          target: "assist/docs/papers",
          key: "https://habr.com/ru/articles/912576/",
          value: "Как работает Codex на практике"
        }
      ]
    });

    expect(
      fs.readFileSync(path.join(vaultRoot, "assist", "docs", "websites", "habr.com.md"), "utf8")
    ).toContain("habr.com");
    expect(
      fs.readdirSync(path.join(vaultRoot, "assist", "docs", "papers", "habr.com"))
    ).toContain("Как работает Codex на практике.md");
  });

  it("writes stable user and assist notes plus documentation registries", async () => {
    const root = createRoot();
    const vaultRoot = path.join(root, "vault");
    const writer = createKnowledgeBackgroundWriter({
      getVaultRoot: () => vaultRoot
    });

    const result = await writer.recordInteraction({
      origin: "local-chat",
      prompt: "добавь документацию по FastAPI, источник https://fastapi.tiangolo.com/",
      answer: "FastAPI строит API вокруг type hints, Pydantic и ASGI."
    });

    const userNote = path.join(vaultRoot, "user", "Backend", "Python", "FastAPI", "FastAPI.md");
    const assistNote = path.join(
      vaultRoot,
      "assist",
      "Backend",
      "Python",
      "FastAPI",
      "FastAPI.md"
    );
    const docsRegistry = path.join(vaultRoot, "assist", "docs", "registry", DOCS_REGISTRY_FILE_NAME);

    expect(result).toEqual({
      applied: true,
      pendingApproval: false,
      userWriteCount: 1,
      assistWriteCount: 1
    });
    expect(fs.readFileSync(userNote, "utf8")).toContain("FastAPI строит API вокруг type hints");
    expect(fs.readFileSync(assistNote, "utf8")).toContain("Запрос: добавь документацию по FastAPI");
    expect(fs.readFileSync(docsRegistry, "utf8")).toContain("https://fastapi.tiangolo.com/");
  });

  it("creates a local approval draft for significant assist skill changes", async () => {
    const root = createRoot();
    const vaultRoot = path.join(root, "vault");
    const approvalStore = new LocalApprovalStore({
      stateRoot: path.join(root, "state")
    });
    const writer = createKnowledgeBackgroundWriter({
      getVaultRoot: () => vaultRoot,
      persistSkillApprovalDraft: async (draft) => {
        approvalStore.saveSkillDraft(draft.intent, draft);
      }
    });

    const result = await writer.recordInteraction({
      origin: "local-chat",
      prompt: "научись новому workflow triage багов",
      answer: "Буду раскладывать инциденты по severity, owner и rollback-path.",
      skillChangeSeverity: "significant"
    });

    expect(result).toEqual({
      applied: false,
      pendingApproval: true,
      userWriteCount: 0,
      assistWriteCount: 0
    });
    expect(approvalStore.list()).toEqual([
      expect.objectContaining({
        kind: "assist_skill",
        summaryText: "Значимое обновление навыка ассистента."
      })
    ]);
  });

  it("stores extracted profile and preference memory writes under assist notes", async () => {
    const root = createRoot();
    const vaultRoot = path.join(root, "vault");
    const writer = createKnowledgeBackgroundWriter({
      getVaultRoot: () => vaultRoot
    });

    const result = await writer.recordInteraction({
      origin: "local-chat",
      prompt: "Меня зовут Карпов Степан Викторович, я программист на Python и FastAPI.",
      answer: "Понял, буду учитывать твой стек.",
      memoryWrites: [
        {
          target: "assist/profile",
          key: "full_name",
          value: "Карпов Степан Викторович"
        },
        {
          target: "assist/profile",
          key: "occupation",
          value: "программист"
        },
        {
          target: "assist/preferences",
          key: "preferred_stack",
          value: "Python, FastAPI"
        }
      ]
    });

    expect(result).toEqual({
      applied: true,
      pendingApproval: false,
      userWriteCount: 0,
      assistWriteCount: 3
    });
    expect(
      fs.readFileSync(path.join(vaultRoot, "assist", "profile", "Профиль владельца.md"), "utf8")
    ).toContain("Карпов Степан Викторович");
    expect(
      fs.readFileSync(
        path.join(vaultRoot, "assist", "preferences", "Предпочтения общения.md"),
        "utf8"
      )
    ).toContain("Python, FastAPI");
  });

  it("stores observations separately from confirmed profile facts", async () => {
    const root = createRoot();
    const vaultRoot = path.join(root, "vault");
    const writer = createKnowledgeBackgroundWriter({
      getVaultRoot: () => vaultRoot
    });

    const result = await writer.recordInteraction({
      origin: "local-chat",
      prompt: "Мне кажется, я часто пишу с ошибками.",
      answer: "Понял, буду учитывать это при формулировках.",
      memoryWrites: [
        {
          target: "assist/observations",
          key: "communication_style",
          value: "Возможны устойчивые орфографические ошибки, стоит упрощать формулировки."
        }
      ]
    });

    expect(result).toEqual({
      applied: true,
      pendingApproval: false,
      userWriteCount: 0,
      assistWriteCount: 1
    });
    expect(
      fs.readFileSync(
        path.join(vaultRoot, "assist", "observations", "Временные наблюдения.md"),
        "utf8"
      )
    ).toContain("communication_style");
  });
});
