import fs from "node:fs";
import path from "node:path";

type FetchLike = typeof fetch;

type ChatKnowledgeRetrieverOptions = {
  getVaultRoot: () => string | null;
  maxSnippetLength?: number;
  fetchImpl?: FetchLike;
};

export type ChatKnowledgeLookupResult = {
  context: string | null;
  sourceUrls: string[];
};

const knownTopics: Array<{
  pattern: RegExp;
  noteTrail: string[];
  noteName: string;
  externalSources: Array<{
    url: string;
    label: string;
  }>;
}> = [
  {
    pattern: /\bfastapi\b/i,
    noteTrail: ["Backend", "Python", "FastAPI"],
    noteName: "FastAPI.md",
    externalSources: [
      {
        url: "https://fastapi.tiangolo.com/release-notes/",
        label: "FastAPI Release Notes"
      }
    ]
  },
  {
    pattern: /\bmcp\b/i,
    noteTrail: ["AI", "models", "MCP"],
    noteName: "MCP.md",
    externalSources: [
      {
        url: "https://modelcontextprotocol.io/introduction",
        label: "Model Context Protocol"
      }
    ]
  },
  {
    pattern: /\bpython\b/i,
    noteTrail: ["Languages", "Python"],
    noteName: "Python.md",
    externalSources: [
      {
        url: "https://docs.python.org/3/whatsnew/",
        label: "Python What's New"
      }
    ]
  },
  {
    pattern: /\breact\b/i,
    noteTrail: ["Frontend", "React"],
    noteName: "React.md",
    externalSources: [
      {
        url: "https://react.dev/blog",
        label: "React Blog"
      }
    ]
  },
  {
    pattern: /\btypescript\b/i,
    noteTrail: ["Languages", "TypeScript"],
    noteName: "TypeScript.md",
    externalSources: [
      {
        url: "https://devblogs.microsoft.com/typescript/",
        label: "TypeScript Blog"
      }
    ]
  }
];

function trimSnippet(value: string, maxSnippetLength: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length <= maxSnippetLength
    ? normalized
    : `${normalized.slice(0, maxSnippetLength - 1)}...`;
}

function stripHtml(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export function createChatKnowledgeRetriever({
  getVaultRoot,
  maxSnippetLength = 420,
  fetchImpl = globalThis.fetch
}: ChatKnowledgeRetrieverOptions) {
  async function lookupExternalSources(
    externalSources: Array<{ url: string; label: string }>
  ): Promise<ChatKnowledgeLookupResult> {
    const snippets: string[] = [];
    const sourceUrls: string[] = [];

    for (const source of externalSources) {
      try {
        const response = await fetchImpl(source.url);

        if (!response.ok) {
          continue;
        }

        const rawContent = await response.text();
        const snippet = trimSnippet(stripHtml(rawContent), maxSnippetLength);

        if (snippet.length === 0) {
          continue;
        }

        snippets.push(`${source.label}: ${snippet}`);
        sourceUrls.push(source.url);
      } catch {
        continue;
      }
    }

    return {
      context: snippets.length > 0 ? `External docs:\n\n${snippets.join("\n\n")}` : null,
      sourceUrls
    };
  }

  return {
    async lookup(prompt: string): Promise<ChatKnowledgeLookupResult> {
      const vaultRoot = getVaultRoot();
      const topic = knownTopics.find((candidate) => candidate.pattern.test(prompt));

      if (!topic) {
        return {
          context: null,
          sourceUrls: []
        };
      }

      const snippets: string[] = [];

      if (vaultRoot) {
        for (const rootName of ["user", "assist"] as const) {
          const notePath = path.join(vaultRoot, rootName, ...topic.noteTrail, topic.noteName);

          if (!fs.existsSync(notePath)) {
            continue;
          }

          const rawContent = fs.readFileSync(notePath, "utf8");
          const snippet = trimSnippet(rawContent, maxSnippetLength);

          if (snippet.length === 0) {
            continue;
          }

          snippets.push(`${rootName}: ${snippet}`);
        }
      }

      if (snippets.length > 0) {
        return {
          context: snippets.join("\n\n"),
          sourceUrls: []
        };
      }

      return lookupExternalSources(topic.externalSources);
    }
  };
}
