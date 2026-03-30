import fs from "node:fs/promises";

import { KnowledgeLinker } from "./knowledgeLinker";
import {
  resolveTopicPath,
  type KnowledgeTreeName,
  type ResolveTopicResult
} from "./knowledgeTopicResolver";

type WriteTopicInput = {
  topicTrail: string[];
  preferredLeaf: string;
  sectionTitle: string;
  body: string;
  sourceUrls?: string[];
};

type KnowledgeWriterOptions = {
  vaultRoot: string;
  linker?: KnowledgeLinker;
};

type KnowledgeWriteResult = {
  relativePath: string;
  title: string;
  mode: ResolveTopicResult["mode"];
};

function normalizeTextBlock(value: string): string {
  return value.trim();
}

function buildSectionHeading(sectionTitle: string): string {
  return `## ${sectionTitle.trim()}`;
}

async function ensureNoteContent(
  resolution: ResolveTopicResult,
  sectionTitle: string,
  body: string
): Promise<void> {
  await fs.mkdir(resolution.directoryPath, { recursive: true });

  const heading = `# ${resolution.title}`;
  const sectionHeading = buildSectionHeading(sectionTitle);
  const normalizedBody = normalizeTextBlock(body);

  let content = "";

  try {
    content = await fs.readFile(resolution.notePath, "utf8");
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;

    if (nodeError.code !== "ENOENT") {
      throw error;
    }
  }

  if (content.trim().length === 0) {
    content = `${heading}\n\n${sectionHeading}\n\n${normalizedBody}\n`;
    await fs.writeFile(resolution.notePath, content, "utf8");
    return;
  }

  if (!content.includes(heading)) {
    content = `${heading}\n\n${content.trim()}\n`;
  }

  if (!content.includes(sectionHeading)) {
    content = `${content.trimEnd()}\n\n${sectionHeading}\n\n${normalizedBody}\n`;
    await fs.writeFile(resolution.notePath, content, "utf8");
    return;
  }

  if (content.includes(normalizedBody)) {
    return;
  }

  content = `${content.trimEnd()}\n\n${normalizedBody}\n`;
  await fs.writeFile(resolution.notePath, content, "utf8");
}

export class KnowledgeWriter {
  private readonly vaultRoot: string;
  private readonly linker: KnowledgeLinker | null;

  constructor({ vaultRoot, linker }: KnowledgeWriterOptions) {
    this.vaultRoot = vaultRoot;
    this.linker = linker ?? null;
  }

  async writeUserTopic(input: WriteTopicInput): Promise<KnowledgeWriteResult> {
    return this.writeTopic("user", input);
  }

  async writeAssistTopic(input: WriteTopicInput): Promise<KnowledgeWriteResult> {
    return this.writeTopic("assist", input);
  }

  private async writeTopic(
    tree: KnowledgeTreeName,
    { topicTrail, preferredLeaf, sectionTitle, body, sourceUrls = [] }: WriteTopicInput
  ): Promise<KnowledgeWriteResult> {
    const resolution = resolveTopicPath({
      vaultRoot: this.vaultRoot,
      tree,
      topicTrail,
      preferredLeaf
    });

    await ensureNoteContent(resolution, sectionTitle, body);

    if (this.linker) {
      for (const sourceUrl of sourceUrls) {
        await this.linker.linkSourceToTopic({
          topicRelativePath: resolution.relativePath,
          sourceUrl
        });
      }
    }

    return {
      relativePath: resolution.relativePath,
      title: resolution.title,
      mode: resolution.mode
    };
  }
}
