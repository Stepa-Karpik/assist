import fs from "node:fs";
import path from "node:path";

export type KnowledgeTreeName = "user" | "assist";

export type ResolveTopicInput = {
  vaultRoot: string;
  tree: KnowledgeTreeName;
  topicTrail: string[];
  preferredLeaf: string;
};

export type ResolveTopicResult = {
  mode: "append" | "create";
  directoryPath: string;
  notePath: string;
  relativePath: string;
  title: string;
};

function normalizeSegment(value: string): string {
  const normalized = value
    .replace(/[<>:"/\\|?*]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return normalized.length > 0 ? normalized : "Новая заметка";
}

function toPosixRelativePath(value: string): string {
  return value.split(path.sep).join("/");
}

function findExistingNote(directoryPath: string, preferredLeaf: string): string | null {
  if (!fs.existsSync(directoryPath)) {
    return null;
  }

  const expectedBaseName = normalizeSegment(preferredLeaf).toLowerCase();
  const entries = fs.readdirSync(directoryPath, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    const fileBaseName = path.parse(entry.name).name.toLowerCase();

    if (fileBaseName === expectedBaseName) {
      return path.join(directoryPath, entry.name);
    }
  }

  return null;
}

export function resolveTopicPath({
  vaultRoot,
  tree,
  topicTrail,
  preferredLeaf
}: ResolveTopicInput): ResolveTopicResult {
  const normalizedTrail = topicTrail.map(normalizeSegment);
  const normalizedLeaf = normalizeSegment(preferredLeaf);
  const directoryPath = path.join(vaultRoot, tree, ...normalizedTrail);
  const existingNotePath = findExistingNote(directoryPath, normalizedLeaf);
  const notePath = existingNotePath ?? path.join(directoryPath, `${normalizedLeaf}.md`);

  return {
    mode: existingNotePath === null ? "create" : "append",
    directoryPath,
    notePath,
    relativePath: toPosixRelativePath(path.relative(vaultRoot, notePath)),
    title: normalizedLeaf
  };
}
