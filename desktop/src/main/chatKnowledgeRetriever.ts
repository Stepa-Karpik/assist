import fs from "node:fs";
import path from "node:path";

type ChatKnowledgeRetrieverOptions = {
  getVaultRoot: () => string | null;
  maxSnippetLength?: number;
};

const knownTopics: Array<{
  pattern: RegExp;
  noteTrail: string[];
  noteName: string;
}> = [
  {
    pattern: /\bfastapi\b/i,
    noteTrail: ["Backend", "Python", "FastAPI"],
    noteName: "FastAPI.md"
  },
  {
    pattern: /\bmcp\b/i,
    noteTrail: ["AI", "models", "MCP"],
    noteName: "MCP.md"
  },
  {
    pattern: /\bpython\b/i,
    noteTrail: ["Languages", "Python"],
    noteName: "Python.md"
  },
  {
    pattern: /\breact\b/i,
    noteTrail: ["Frontend", "React"],
    noteName: "React.md"
  },
  {
    pattern: /\btypescript\b/i,
    noteTrail: ["Languages", "TypeScript"],
    noteName: "TypeScript.md"
  }
];

function trimSnippet(value: string, maxSnippetLength: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length <= maxSnippetLength
    ? normalized
    : `${normalized.slice(0, maxSnippetLength - 1)}…`;
}

export function createChatKnowledgeRetriever({
  getVaultRoot,
  maxSnippetLength = 420
}: ChatKnowledgeRetrieverOptions) {
  return {
    lookup(prompt: string): string | null {
      const vaultRoot = getVaultRoot();

      if (!vaultRoot) {
        return null;
      }

      const topic = knownTopics.find((candidate) => candidate.pattern.test(prompt));

      if (!topic) {
        return null;
      }

      const snippets: string[] = [];

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

      return snippets.length > 0 ? snippets.join("\n\n") : null;
    }
  };
}
