import type { Dirent } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

export type KnowledgeVaultNode = {
  id: string;
  title: string;
  relativePath: string;
  kind: "directory" | "note";
  children: KnowledgeVaultNode[];
};

export type KnowledgeNoteDetail = {
  relativePath: string;
  title: string;
  content: string;
};

type CreateKnowledgeVaultStoreInput = {
  vaultRoot: string;
};

function toPosixRelativePath(value: string): string {
  return value.split(path.sep).join("/");
}

function toNoteTitle(fileName: string): string {
  return path.posix.basename(fileName, path.posix.extname(fileName));
}

async function readDirectorySafe(directoryPath: string): Promise<Dirent[]> {
  try {
    return await fs.readdir(directoryPath, { withFileTypes: true });
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;

    if (nodeError.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

function compareEntries(left: Dirent, right: Dirent): number {
  if (left.isDirectory() && !right.isDirectory()) {
    return -1;
  }

  if (!left.isDirectory() && right.isDirectory()) {
    return 1;
  }

  return left.name.localeCompare(right.name, "ru");
}

async function buildNodeTree(vaultRoot: string, absolutePath: string): Promise<KnowledgeVaultNode[]> {
  const entries = (await readDirectorySafe(absolutePath)).sort(compareEntries);
  const nodes: KnowledgeVaultNode[] = [];

  for (const entry of entries) {
    const entryPath = path.join(absolutePath, entry.name);
    const relativePath = toPosixRelativePath(path.relative(vaultRoot, entryPath));

    if (entry.isDirectory()) {
      nodes.push({
        id: relativePath,
        title: entry.name,
        relativePath,
        kind: "directory",
        children: await buildNodeTree(vaultRoot, entryPath)
      });
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    nodes.push({
      id: relativePath,
      title: toNoteTitle(entry.name),
      relativePath,
      kind: "note",
      children: []
    });
  }

  return nodes;
}

function normalizeNotePath(vaultRoot: string, relativePath: string): string {
  const normalizedRelativePath = relativePath.replaceAll("/", path.sep);
  const targetPath = path.resolve(vaultRoot, normalizedRelativePath);
  const relativeToVault = path.relative(vaultRoot, targetPath);

  if (relativeToVault.startsWith("..") || path.isAbsolute(relativeToVault)) {
    throw new Error("Knowledge note is outside the configured vault.");
  }

  return targetPath;
}

export function createKnowledgeVaultStore({ vaultRoot }: CreateKnowledgeVaultStoreInput) {
  return {
    async listRoots(): Promise<KnowledgeVaultNode[]> {
      const rootNames = ["user", "assist"] as const;

      return Promise.all(
        rootNames.map(async (rootName) => {
          const absolutePath = path.join(vaultRoot, rootName);
          return {
            id: rootName,
            title: rootName,
            relativePath: rootName,
            kind: "directory" as const,
            children: await buildNodeTree(vaultRoot, absolutePath)
          };
        })
      );
    },
    async readNote(relativePath: string): Promise<KnowledgeNoteDetail> {
      const targetPath = normalizeNotePath(vaultRoot, relativePath);
      const content = await fs.readFile(targetPath, "utf8");

      return {
        relativePath: toPosixRelativePath(relativePath),
        title: toNoteTitle(path.posix.basename(toPosixRelativePath(relativePath))),
        content
      };
    }
  };
}
