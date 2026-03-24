import type { Dirent } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

export type KnowledgeSectionId = "master_info" | "knowledge" | "notes" | "websites";

export type KnowledgeEntry = {
  relativePath: string;
  displayName: string;
};

export type KnowledgeSection = {
  id: KnowledgeSectionId;
  label: string;
  entries: KnowledgeEntry[];
};

type ReadKnowledgeEntryInput = {
  sectionId: KnowledgeSectionId;
  relativePath: string;
};

type CreateKnowledgeStoreInput = {
  runtimeRoot: string;
};

type SectionConfig = {
  id: KnowledgeSectionId;
  label: string;
  rootPath: string;
};

function toPosixRelativePath(value: string): string {
  return value.split(path.sep).join("/");
}

async function listFilesRecursive(rootPath: string, currentPath = rootPath): Promise<string[]> {
  let entries: Dirent[];

  try {
    entries = await fs.readdir(currentPath, {
      withFileTypes: true
    });
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;

    if (nodeError.code === "ENOENT") {
      return [];
    }

    throw error;
  }

  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        return listFilesRecursive(rootPath, entryPath);
      }

      if (!entry.isFile()) {
        return [];
      }

      return [toPosixRelativePath(path.relative(rootPath, entryPath))];
    })
  );

  return files.flat().sort((left, right) => left.localeCompare(right));
}

export function createKnowledgeStore({ runtimeRoot }: CreateKnowledgeStoreInput) {
  const sections: SectionConfig[] = [
    {
      id: "master_info",
      label: "Master info",
      rootPath: path.join(runtimeRoot, "docs", "user", "master_info")
    },
    {
      id: "knowledge",
      label: "Knowledge",
      rootPath: path.join(runtimeRoot, "docs", "user", "knowledge")
    },
    {
      id: "notes",
      label: "Notes",
      rootPath: path.join(runtimeRoot, "docs", "user", "docs", "notes")
    },
    {
      id: "websites",
      label: "Websites",
      rootPath: path.join(runtimeRoot, "docs", "user", "websites")
    }
  ];

  const sectionById = new Map(sections.map((section) => [section.id, section]));

  return {
    async listSections(): Promise<KnowledgeSection[]> {
      const listedSections = await Promise.all(
        sections.map(async (section) => {
          const files = await listFilesRecursive(section.rootPath);

          return {
            id: section.id,
            label: section.label,
            entries: files.map((relativePath) => ({
              relativePath,
              displayName: path.posix.basename(relativePath)
            }))
          } satisfies KnowledgeSection;
        })
      );

      return listedSections;
    },
    async readEntry({ sectionId, relativePath }: ReadKnowledgeEntryInput): Promise<{
      sectionId: KnowledgeSectionId;
      relativePath: string;
      content: string;
    }> {
      const section = sectionById.get(sectionId);

      if (!section) {
        throw new Error(`Unknown knowledge section: ${sectionId}`);
      }

      const normalizedRelativePath = relativePath.replaceAll("/", path.sep);
      const targetPath = path.resolve(section.rootPath, normalizedRelativePath);
      const relativeToSection = path.relative(section.rootPath, targetPath);

      if (
        relativeToSection.startsWith("..") ||
        path.isAbsolute(relativeToSection)
      ) {
        throw new Error("Knowledge entry is outside the allowed section.");
      }

      const content = await fs.readFile(targetPath, "utf8");

      return {
        sectionId,
        relativePath: toPosixRelativePath(relativePath),
        content
      };
    }
  };
}
