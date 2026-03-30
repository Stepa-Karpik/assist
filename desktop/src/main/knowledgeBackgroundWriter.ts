import { ensureKnowledgeVault } from "./knowledgeVaultBootstrap";
import {
  decideKnowledgeWrites,
  type KnowledgeIngestInput,
  type KnowledgeSkillApprovalDraft,
  type KnowledgeWritePlan
} from "./knowledgeIngestDecider";
import { KnowledgeLinker } from "./knowledgeLinker";
import { KnowledgeWriter } from "./knowledgeWriter";

type KnowledgeBackgroundWriterOptions = {
  getVaultRoot: () => string | null;
  decide?: (input: KnowledgeIngestInput) => KnowledgeWritePlan;
  persistSkillApprovalDraft?: (draft: KnowledgeSkillApprovalDraft) => Promise<void> | void;
};

export type KnowledgeBackgroundWriteResult = {
  applied: boolean;
  pendingApproval: boolean;
  userWriteCount: number;
  assistWriteCount: number;
};

export function createKnowledgeBackgroundWriter({
  getVaultRoot,
  decide = decideKnowledgeWrites,
  persistSkillApprovalDraft
}: KnowledgeBackgroundWriterOptions) {
  return {
    async recordInteraction(input: KnowledgeIngestInput): Promise<KnowledgeBackgroundWriteResult> {
      const vaultRoot = getVaultRoot();

      if (!vaultRoot) {
        return {
          applied: false,
          pendingApproval: false,
          userWriteCount: 0,
          assistWriteCount: 0
        };
      }

      ensureKnowledgeVault(vaultRoot);
      const plan = decide(input);
      const linker = new KnowledgeLinker({ vaultRoot });
      const writer = new KnowledgeWriter({ vaultRoot, linker });

      for (const write of plan.userWrites) {
        await writer.writeUserTopic(write);
      }

      for (const write of plan.assistWrites) {
        await writer.writeAssistTopic(write);
      }

      for (const draft of plan.skillApprovalDrafts) {
        await persistSkillApprovalDraft?.(draft);
      }

      return {
        applied: plan.userWrites.length > 0 || plan.assistWrites.length > 0,
        pendingApproval: plan.skillApprovalDrafts.length > 0,
        userWriteCount: plan.userWrites.length,
        assistWriteCount: plan.assistWrites.length
      };
    }
  };
}
