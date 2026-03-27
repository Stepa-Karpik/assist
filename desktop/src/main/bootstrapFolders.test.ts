// @vitest-environment node

import path from "node:path";

import { describe, expect, it } from "vitest";

import { getRuntimeFolderMap } from "./bootstrapFolders";

describe("getRuntimeFolderMap", () => {
  it("returns the required Karpik runtime folders", () => {
    const root = "C:\\Users\\TBG\\AppData\\Roaming\\Karpik";
    const folders = getRuntimeFolderMap(root);

    expect(folders.userMasterInfo).toBe(path.join(root, "docs", "user", "master_info"));
    expect(folders.userKnowledge).toBe(path.join(root, "docs", "user", "knowledge"));
    expect(folders.userLogs).toBe(path.join(root, "docs", "user", "logs"));
    expect(folders.userServices).toBe(path.join(root, "docs", "user", "services"));
    expect(folders.userWebsites).toBe(path.join(root, "docs", "user", "websites"));
    expect(folders.userDocs).toBe(path.join(root, "docs", "user", "docs"));
    expect(folders.state).toBe(path.join(root, "state"));
    expect(folders.settings).toBe(path.join(root, "settings"));
    expect(folders.secrets).toBe(path.join(root, "secrets"));
  });
});
