import type { ChatKnowledgeWrite } from "./chatPlan";
import { extractChatMemoryCandidates } from "./chatMemoryExtractor";

export type MemoryCandidate = {
  kind: "fact" | "preference" | "observation" | "source";
  target: ChatKnowledgeWrite["target"] | "assist/observations";
  key: string;
  value: string;
  confidence: "direct" | "inferred";
};

export type MemoryModelPlan = {
  candidates: MemoryCandidate[];
  writes: ChatKnowledgeWrite[];
};

export type MemoryModelResolver = (text: string) => MemoryCandidate[];

type MemoryModelOptions = {
  resolve?: MemoryModelResolver;
};

function toKnowledgeWrite(candidate: MemoryCandidate): ChatKnowledgeWrite {
  return {
    target: candidate.target,
    key: candidate.key,
    value: candidate.value
  };
}

export function createMemoryModel({ resolve }: MemoryModelOptions = {}) {
  return {
    plan(text: string): MemoryModelPlan {
      const candidates = resolve?.(text) ?? extractChatMemoryCandidates(text);

      return {
        candidates,
        writes: candidates.map(toKnowledgeWrite)
      };
    }
  };
}
