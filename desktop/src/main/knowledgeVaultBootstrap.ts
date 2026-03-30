import fs from "node:fs";
import path from "node:path";

import {
  DOCS_REGISTRY_FILE_NAME,
  DOCS_REGISTRY_INITIAL_CONTENT,
  TRUSTED_SITES_FILE_NAME,
  TRUSTED_SITES_INITIAL_CONTENT
} from "./knowledgeVaultConstants";

function ensureDirectory(directoryPath: string): void {
  fs.mkdirSync(directoryPath, { recursive: true });
}

function ensureMarkdownFile(filePath: string, content: string): void {
  if (fs.existsSync(filePath)) {
    return;
  }

  fs.writeFileSync(filePath, content);
}

export function ensureKnowledgeVault(vaultRoot: string): void {
  const userRoot = path.join(vaultRoot, "user");
  const assistRoot = path.join(vaultRoot, "assist");
  const assistDocsRoot = path.join(assistRoot, "docs");
  const registryRoot = path.join(assistDocsRoot, "registry");
  const websitesRoot = path.join(assistDocsRoot, "websites");
  const papersRoot = path.join(assistDocsRoot, "papers");
  const profileRoot = path.join(assistRoot, "profile");
  const preferencesRoot = path.join(assistRoot, "preferences");
  const skillsRoot = path.join(assistRoot, "skills");

  [
    userRoot,
    assistRoot,
    assistDocsRoot,
    registryRoot,
    websitesRoot,
    papersRoot,
    profileRoot,
    preferencesRoot,
    skillsRoot
  ].forEach(ensureDirectory);

  ensureMarkdownFile(path.join(registryRoot, DOCS_REGISTRY_FILE_NAME), DOCS_REGISTRY_INITIAL_CONTENT);
  ensureMarkdownFile(
    path.join(registryRoot, TRUSTED_SITES_FILE_NAME),
    TRUSTED_SITES_INITIAL_CONTENT
  );
}
