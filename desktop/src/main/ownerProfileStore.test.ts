// @vitest-environment node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { OwnerProfileStore, buildOwnerProfileContext } from "./ownerProfileStore";

const tempRoots: string[] = [];

function createSettingsRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "karpik-owner-profile-"));
  tempRoots.push(root);
  return root;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("OwnerProfileStore", () => {
  it("saves and reloads owner profile fields", () => {
    const settingsRoot = createSettingsRoot();
    const store = new OwnerProfileStore({ settingsRoot });

    const saved = store.save({
      fullName: "Степан Карпов",
      gender: "мужской",
      age: 26,
      city: "Москва",
      language: "ru",
      occupation: "software engineer"
    });

    expect(saved).toEqual(
      expect.objectContaining({
        fullName: "Степан Карпов",
        gender: "мужской",
        age: 26,
        city: "Москва",
        language: "ru",
        occupation: "software engineer"
      })
    );

    const reloaded = new OwnerProfileStore({ settingsRoot });
    expect(reloaded.getState()).toEqual(saved);
  });

  it("builds a compact conversational context from non-empty fields only", () => {
    const context = buildOwnerProfileContext({
      fullName: "Степан Карпов",
      city: "Москва",
      language: "ru",
      bio: "",
      notes: null
    });

    expect(context).toContain("Владелец: Степан Карпов");
    expect(context).toContain("Город: Москва");
    expect(context).toContain("Язык: ru");
    expect(context).not.toContain("Биография");
    expect(context).not.toContain("Заметки");
  });
});
