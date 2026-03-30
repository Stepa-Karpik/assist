import fs from "node:fs/promises";
import path from "node:path";

import { ensureKnowledgeVault } from "./knowledgeVaultBootstrap";
import {
  DOCS_REGISTRY_FILE_NAME,
  DOCS_REGISTRY_INITIAL_CONTENT,
  TRUSTED_SITES_FILE_NAME,
  TRUSTED_SITES_INITIAL_CONTENT
} from "./knowledgeVaultConstants";

type KnowledgeLinkerOptions = {
  vaultRoot: string;
  fetchImpl?: KnowledgeFetch;
};

type FetchTextResponse = Pick<Response, "ok" | "text">;
type KnowledgeFetch = (input: string) => Promise<FetchTextResponse>;

type LinkSourceToTopicInput = {
  topicRelativePath: string;
  sourceUrl: string;
  sourceTitle?: string;
};

function appendUniqueLine(content: string, line: string): string {
  if (content.includes(line)) {
    return content;
  }

  return `${content.trimEnd()}\n- ${line}\n`;
}

function normalizeTitle(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : "Источник";
}

function normalizeFileName(value: string): string {
  const normalized = value
    .replace(/[<>:"/\\|?*]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return normalized.length > 0 ? normalized : "Источник";
}

function deriveTopicTitle(topicRelativePath: string): string {
  return path.posix.parse(topicRelativePath).name;
}

function extractHtmlTitle(html: string): string | null {
  const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);

  if (ogTitleMatch?.[1]) {
    return normalizeTitle(ogTitleMatch[1]);
  }

  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);

  if (titleMatch?.[1]) {
    return normalizeTitle(titleMatch[1]);
  }

  const headingMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);

  if (headingMatch?.[1]) {
    return normalizeTitle(headingMatch[1]);
  }

  return null;
}

async function deriveSourceTitle(
  sourceUrl: URL,
  preferredTitle?: string,
  fetchImpl: KnowledgeFetch = fetchSourceHtml
): Promise<string> {
  if (preferredTitle && preferredTitle.trim().length > 0) {
    return normalizeTitle(preferredTitle);
  }

  try {
    const response = await fetchImpl(sourceUrl.toString());

    if (response.ok) {
      const html = await response.text();
      const extractedTitle = extractHtmlTitle(html);

      if (extractedTitle) {
        return extractedTitle;
      }
    }
  } catch {
    // Ignore transient lookup errors and fall back to URL-derived titles.
  }

  const lastSegment = sourceUrl.pathname
    .split("/")
    .filter(Boolean)
    .at(-1);

  return normalizeTitle(lastSegment ? decodeURIComponent(lastSegment) : sourceUrl.hostname);
}

export class KnowledgeLinker {
  private readonly vaultRoot: string;
  private readonly fetchImpl: KnowledgeFetch;

  constructor({ vaultRoot, fetchImpl = fetchSourceHtml }: KnowledgeLinkerOptions) {
    this.vaultRoot = vaultRoot;
    this.fetchImpl = fetchImpl;
  }

  async linkSourceToTopic({
    topicRelativePath,
    sourceUrl,
    sourceTitle
  }: LinkSourceToTopicInput): Promise<void> {
    ensureKnowledgeVault(this.vaultRoot);

    const source = new URL(sourceUrl);
    const domain = source.hostname;
    const topicTitle = deriveTopicTitle(topicRelativePath);
    const displayTitle = await deriveSourceTitle(source, sourceTitle, this.fetchImpl);
    const registryRoot = path.join(this.vaultRoot, "assist", "docs", "registry");
    const websitesRoot = path.join(this.vaultRoot, "assist", "docs", "websites");
    const papersRoot = path.join(this.vaultRoot, "assist", "docs", "papers", domain);
    const trustedSitesPath = path.join(registryRoot, TRUSTED_SITES_FILE_NAME);
    const docsRegistryPath = path.join(registryRoot, DOCS_REGISTRY_FILE_NAME);
    const websiteNotePath = path.join(websitesRoot, `${domain}.md`);
    const paperNotePath = path.join(papersRoot, `${normalizeFileName(displayTitle)}.md`);

    await fs.mkdir(websitesRoot, { recursive: true });
    await fs.mkdir(papersRoot, { recursive: true });

    await this.appendToFile(trustedSitesPath, TRUSTED_SITES_INITIAL_CONTENT, `[[${domain}]]`);
    await this.appendToFile(
      docsRegistryPath,
      DOCS_REGISTRY_INITIAL_CONTENT,
      `[${displayTitle}](${sourceUrl}) -> [[${topicTitle}]]`
    );
    await this.appendToFile(
      websiteNotePath,
      `# ${domain}\n\n## Связанные темы\n\n`,
      `[[${topicTitle}]]`
    );
    await this.appendToFile(
      paperNotePath,
      `# ${displayTitle}\n\n## Ссылка\n\n- ${sourceUrl}\n\n## Связанные темы\n\n`,
      `[[${topicTitle}]]`
    );
  }

  private async appendToFile(filePath: string, initialContent: string, line: string): Promise<void> {
    let content = initialContent;

    try {
      content = await fs.readFile(filePath, "utf8");
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;

      if (nodeError.code !== "ENOENT") {
        throw error;
      }
    }

    const nextContent = appendUniqueLine(content, line);

    if (nextContent !== content) {
      await fs.writeFile(filePath, nextContent, "utf8");
    }
  }
}

async function fetchSourceHtml(input: string): Promise<FetchTextResponse> {
  return fetch(input);
}
