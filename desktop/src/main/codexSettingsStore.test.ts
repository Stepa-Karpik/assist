// @vitest-environment node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { CodexSettingsStore } from "./codexSettingsStore";

const tempRoots: string[] = [];

function createSettingsRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "karpik-codex-settings-"));
  tempRoots.push(root);
  return root;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("CodexSettingsStore", () => {
  it("returns a bootstrapped default workspace when no config exists", () => {
    const store = new CodexSettingsStore({
      settingsRoot: createSettingsRoot(),
      defaultWorkspaceRoot: "C:\\Users\\TBG\\AppData\\Roaming\\Karpik\\docs\\user"
    });

    expect(store.getState()).toEqual({
      workspaces: [
        {
          id: "default-workspace",
          name: "Default",
          rootPath: "C:\\Users\\TBG\\AppData\\Roaming\\Karpik\\docs\\user"
        }
      ],
      defaultWorkspaceId: "default-workspace",
      chatBindings: {}
    });
  });

  it("migrates the legacy single-root config into the new workspace registry", () => {
    const settingsRoot = createSettingsRoot();
    fs.writeFileSync(
      path.join(settingsRoot, "codex.json"),
      JSON.stringify({
        workspaceRoot: "D:\\Projects\\assist"
      })
    );

    const store = new CodexSettingsStore({
      settingsRoot,
      defaultWorkspaceRoot: "C:\\default"
    });

    expect(store.getState()).toEqual({
      workspaces: [
        {
          id: "default-workspace",
          name: "Default",
          rootPath: "D:\\Projects\\assist"
        }
      ],
      defaultWorkspaceId: "default-workspace",
      chatBindings: {}
    });
  });

  it("persists multiple workspaces and chat bindings", () => {
    const settingsRoot = createSettingsRoot();
    const firstStore = new CodexSettingsStore({
      settingsRoot,
      defaultWorkspaceRoot: "C:\\default"
    });

    const saved = firstStore.saveConfig({
      workspaces: [
        {
          id: "default-workspace",
          name: "Default",
          rootPath: "C:\\default"
        },
        {
          id: "assist-repo",
          name: "Assist",
          rootPath: "D:\\Projects\\assist"
        }
      ],
      defaultWorkspaceId: "assist-repo"
    });
    firstStore.saveChatBinding({
      chatId: 5001,
      workspaceId: "assist-repo"
    });
    const secondStore = new CodexSettingsStore({
      settingsRoot,
      defaultWorkspaceRoot: "C:\\default"
    });

    expect(saved).toEqual({
      workspaces: [
        {
          id: "default-workspace",
          name: "Default",
          rootPath: "C:\\default"
        },
        {
          id: "assist-repo",
          name: "Assist",
          rootPath: "D:\\Projects\\assist"
        }
      ],
      defaultWorkspaceId: "assist-repo",
      chatBindings: {}
    });
    expect(secondStore.getState()).toEqual({
      workspaces: [
        {
          id: "default-workspace",
          name: "Default",
          rootPath: "C:\\default"
        },
        {
          id: "assist-repo",
          name: "Assist",
          rootPath: "D:\\Projects\\assist"
        }
      ],
      defaultWorkspaceId: "assist-repo",
      chatBindings: {
        "5001": "assist-repo"
      }
    });
  });

  it("drops invalid chat bindings when the target workspace is removed", () => {
    const store = new CodexSettingsStore({
      settingsRoot: createSettingsRoot(),
      defaultWorkspaceRoot: "C:\\default"
    });
    store.saveConfig({
      workspaces: [
        {
          id: "default-workspace",
          name: "Default",
          rootPath: "C:\\default"
        },
        {
          id: "assist-repo",
          name: "Assist",
          rootPath: "D:\\Projects\\assist"
        }
      ],
      defaultWorkspaceId: "default-workspace"
    });
    store.saveChatBinding({
      chatId: 5001,
      workspaceId: "assist-repo"
    });

    expect(store.getWorkspaceForChat(5001)).toEqual({
      id: "assist-repo",
      name: "Assist",
      rootPath: "D:\\Projects\\assist"
    });

    expect(
      store.saveConfig({
        workspaces: [
          {
            id: "default-workspace",
            name: "Default",
            rootPath: "C:\\default"
          }
        ],
        defaultWorkspaceId: "default-workspace"
      })
    ).toEqual({
      workspaces: [
        {
          id: "default-workspace",
          name: "Default",
          rootPath: "C:\\default"
        }
      ],
      defaultWorkspaceId: "default-workspace",
      chatBindings: {}
    });

    expect(store.getWorkspaceForChat(5001)).toEqual({
      id: "default-workspace",
      name: "Default",
      rootPath: "C:\\default"
    });
  });
});
