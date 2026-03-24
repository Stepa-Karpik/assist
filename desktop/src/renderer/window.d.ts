export {};

type PairingState = {
  code: string | null;
  expiresAt: string | null;
  isActive: boolean;
  trustedTelegramUserIds: number[];
};

type AuthConfigState = {
  passwordConfigured: boolean;
  totpConfigured: boolean;
};

type CodexWorkspace = {
  id: string;
  name: string;
  rootPath: string;
};

type CodexConfigState = {
  workspaces: CodexWorkspace[];
  defaultWorkspaceId: string;
  chatBindings: Record<string, string>;
};

type TaskSnapshotItem = {
  task_id: string;
  intent: string;
  status:
    | "queued"
    | "awaiting_auth"
    | "awaiting_local_approval"
    | "blocked"
    | "running"
    | "done"
    | "failed"
    | "stalled";
  result_text?: string | null;
  error_text?: string | null;
  chat_id?: number | null;
  telegram_user_id?: number | null;
};

type LocalApprovalItem = {
  taskId: string;
  intent: string;
  summaryText: string;
  previewText: string;
  changedFiles: string[];
  createdAt: string;
};

declare global {
  interface Window {
    karpik?: {
      view: string;
      getAuthConfigState: () => Promise<AuthConfigState>;
      getCodexConfigState: () => Promise<CodexConfigState>;
      getLocalApprovals: () => Promise<LocalApprovalItem[]>;
      getPairingState: () => Promise<PairingState>;
      getTaskSnapshot: () => Promise<TaskSnapshotItem[]>;
      approveLocalApproval: (taskId: string) => Promise<void>;
      openPairingSession: () => Promise<PairingState>;
      rejectLocalApproval: (taskId: string) => Promise<void>;
      saveAuthConfig: (payload: { password?: string; totpSecret?: string }) => Promise<AuthConfigState>;
      saveChatWorkspaceBinding: (payload: {
        chatId: number;
        workspaceId: string;
      }) => Promise<CodexConfigState>;
      saveCodexConfig: (payload: {
        workspaces?: Array<Partial<CodexWorkspace>>;
        defaultWorkspaceId?: string;
      }) => Promise<CodexConfigState>;
    };
  }
}
