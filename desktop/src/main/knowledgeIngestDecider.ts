import crypto from "node:crypto";

export type KnowledgeWriteInstruction = {
  topicTrail: string[];
  preferredLeaf: string;
  sectionTitle: string;
  body: string;
  sourceUrls?: string[];
};

export type KnowledgeSkillApprovalDraft = {
  taskId: string;
  kind: "assist_skill";
  intent: string;
  title: string;
  summaryText: string;
  previewText: string;
  changedFiles: string[];
  targetPath: string;
  content: string;
};

export type KnowledgeIngestInput = {
  origin: "local-chat" | "remote-task";
  prompt: string;
  answer: string;
  sourceUrls?: string[];
  skillChangeSeverity?: "minor" | "significant";
};

export type KnowledgeWritePlan = {
  userWrites: KnowledgeWriteInstruction[];
  assistWrites: KnowledgeWriteInstruction[];
  skillApprovalDrafts: KnowledgeSkillApprovalDraft[];
};

type TopicResolution = {
  topicTrail: string[];
  preferredLeaf: string;
};

const knowledgeIntentPattern =
  /\b(документац|запомни|сохрани|добавь|объясни|обьясни|расскажи|разбери|как работает|что такое|guide|docs?)\b/i;
const greetingPattern = /^(привет|hello|hi|здравствуй|добрый день)\b/i;

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function extractUrls(...chunks: Array<string | null | undefined>): string[] {
  const combined = chunks.filter(Boolean).join("\n");
  const matches = combined.match(/https?:\/\/[^\s)\]]+/g) ?? [];
  return unique(matches.map((value) => value.replace(/[.,;]+$/, "")));
}

function normalizeTopicPhrase(value: string): string {
  const normalized = value.replace(/[<>:"/\\|?*]/g, " ").replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : "Новая тема";
}

function resolveTopic(prompt: string): TopicResolution {
  const explicitMappings: Array<{
    pattern: RegExp;
    topicTrail: string[];
    preferredLeaf: string;
  }> = [
    {
      pattern: /\bmcp\b/i,
      topicTrail: ["AI", "models", "MCP"],
      preferredLeaf: "MCP"
    },
    {
      pattern: /\bfastapi\b/i,
      topicTrail: ["Backend", "Python", "FastAPI"],
      preferredLeaf: "FastAPI"
    },
    {
      pattern: /\bpydantic\b/i,
      topicTrail: ["Backend", "Python", "Pydantic"],
      preferredLeaf: "Pydantic"
    },
    {
      pattern: /\breact\b/i,
      topicTrail: ["Frontend", "React"],
      preferredLeaf: "React"
    },
    {
      pattern: /\btypescript\b/i,
      topicTrail: ["Languages", "TypeScript"],
      preferredLeaf: "TypeScript"
    },
    {
      pattern: /\bpython\b/i,
      topicTrail: ["Languages", "Python"],
      preferredLeaf: "Python"
    },
    {
      pattern: /\bdocker\b/i,
      topicTrail: ["Infrastructure", "Docker"],
      preferredLeaf: "Docker"
    },
    {
      pattern: /\bpostgres(?:ql)?\b/i,
      topicTrail: ["Databases", "PostgreSQL"],
      preferredLeaf: "PostgreSQL"
    }
  ];

  for (const mapping of explicitMappings) {
    if (mapping.pattern.test(prompt)) {
      return {
        topicTrail: mapping.topicTrail,
        preferredLeaf: mapping.preferredLeaf
      };
    }
  }

  const topicMatch = prompt.match(
    /(?:документац(?:ию|ия)\s+по|добавь\s+документац(?:ию|ия)\s+по|объясни|обьясни|расскажи|разбери|про|по|о)\s+([A-Za-zА-Яа-я0-9+!._-]+)/i
  );
  const rawTopic = normalizeTopicPhrase(topicMatch?.[1] ?? prompt.split(/\s+/).slice(0, 3).join(" "));

  return {
    topicTrail: ["Темы", rawTopic],
    preferredLeaf: rawTopic
  };
}

function buildKnowledgeSectionTitle(prompt: string, sourceUrls: string[]): string {
  if (sourceUrls.length > 0) {
    return "Полезные материалы";
  }

  if (/документац/i.test(prompt)) {
    return "Практическая выжимка";
  }

  return "Выжимка";
}

function isKnowledgeWorthWriting(prompt: string, answer: string, sourceUrls: string[]): boolean {
  if (prompt.length === 0 || answer.length === 0) {
    return false;
  }

  if (greetingPattern.test(prompt)) {
    return false;
  }

  return knowledgeIntentPattern.test(prompt) || sourceUrls.length > 0;
}

function buildSkillDraft(prompt: string, answer: string): KnowledgeSkillApprovalDraft {
  const skillName = normalizeTopicPhrase(
    prompt.replace(/^(научись|освой|запомни)\s+/i, "").trim() || "Новый навык"
  );
  const title = `Навык ${skillName}`;
  const targetPath = `assist/skills/${title}.md`;
  const content = `# ${title}\n\n## Черновик навыка\n\n${answer.trim()}\n`;

  return {
    taskId: `skill-${crypto.randomUUID()}`,
    kind: "assist_skill",
    intent: prompt,
    title,
    summaryText: "Значимое обновление навыка ассистента.",
    previewText: answer.trim(),
    changedFiles: [targetPath],
    targetPath,
    content
  };
}

export function decideKnowledgeWrites({
  prompt,
  answer,
  sourceUrls = [],
  skillChangeSeverity
}: KnowledgeIngestInput): KnowledgeWritePlan {
  const normalizedPrompt = prompt.trim();
  const normalizedAnswer = answer.trim();
  const mergedSourceUrls = unique(extractUrls(normalizedPrompt, normalizedAnswer, ...sourceUrls));

  if (skillChangeSeverity === "significant") {
    return {
      userWrites: [],
      assistWrites: [],
      skillApprovalDrafts: [buildSkillDraft(normalizedPrompt, normalizedAnswer)]
    };
  }

  if (!isKnowledgeWorthWriting(normalizedPrompt, normalizedAnswer, mergedSourceUrls)) {
    return {
      userWrites: [],
      assistWrites: [],
      skillApprovalDrafts: []
    };
  }

  const resolution = resolveTopic(normalizedPrompt);
  const sectionTitle = buildKnowledgeSectionTitle(normalizedPrompt, mergedSourceUrls);

  return {
    userWrites: [
      {
        topicTrail: resolution.topicTrail,
        preferredLeaf: resolution.preferredLeaf,
        sectionTitle,
        body: normalizedAnswer,
        sourceUrls: mergedSourceUrls
      }
    ],
    assistWrites: [
      {
        topicTrail: resolution.topicTrail,
        preferredLeaf: resolution.preferredLeaf,
        sectionTitle: mergedSourceUrls.length > 0 ? "Источники и выводы" : "Внутренние выводы",
        body: `Запрос: ${normalizedPrompt}\n\n${normalizedAnswer}`,
        sourceUrls: mergedSourceUrls
      }
    ],
    skillApprovalDrafts: []
  };
}
