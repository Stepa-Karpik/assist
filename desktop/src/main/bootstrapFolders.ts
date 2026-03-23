import fs from "node:fs";
import path from "node:path";

type RuntimeFolderMap = {
  root: string;
  userRoot: string;
  userMasterInfo: string;
  userKnowledge: string;
  userLogs: string;
  userServices: string;
  userWebsites: string;
  userDocs: string;
  secrets: string;
};

export function getRuntimeFolderMap(root: string): RuntimeFolderMap {
  const userRoot = path.join(root, "docs", "user");

  return {
    root,
    userRoot,
    userMasterInfo: path.join(userRoot, "master_info"),
    userKnowledge: path.join(userRoot, "knowledge"),
    userLogs: path.join(userRoot, "logs"),
    userServices: path.join(userRoot, "services"),
    userWebsites: path.join(userRoot, "websites"),
    userDocs: path.join(userRoot, "docs"),
    secrets: path.join(root, "secrets")
  };
}

export function ensureRuntimeFolders(root: string): RuntimeFolderMap {
  const folderMap = getRuntimeFolderMap(root);

  for (const directory of Object.values(folderMap)) {
    fs.mkdirSync(directory, { recursive: true });
  }

  return folderMap;
}
