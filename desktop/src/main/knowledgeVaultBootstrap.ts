import fs from "node:fs";
import path from "node:path";

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

  ensureMarkdownFile(
    path.join(registryRoot, "Документации.md"),
    "# Документации\n\n## Известные документации\n\n"
  );
  ensureMarkdownFile(
    path.join(registryRoot, "Доверенные сайты.md"),
    "# Доверенные сайты\n\n## Источники\n\n"
  );
}
