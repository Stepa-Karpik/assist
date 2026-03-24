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

type LocalChatItem = {
  chatId: string;
  source: "desktop_chat" | "local_continuation_chat";
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  referenceLabel: string | null;
  telegramChatId: number | null;
  workspaceId: string | null;
};

declare global {
  interface Window {
    karpik?: {
      view: string;
      getAuthConfigState: () => Promise<AuthConfigState>;
      getCodexConfigState: () => Promise<CodexConfigState>;
      getLocalApprovals: () => Promise<LocalApprovalItem[]>;
      getLocalChats: () => Promise<LocalChatItem[]>;
      getPairingState: () => Promise<PairingState>;
      getTaskSnapshot: () => Promise<TaskSnapshotItem[]>;
      approveLocalApproval: (taskId: string) => Promise<void>;
      createDesktopChat: (payload?: {
        title?: string;
        workspaceId?: string | null;
      }) => Promise<LocalChatItem>;
      createLocalContinuationChat: (payload: {
        telegramChatId: number;
        title?: string;
        workspaceId?: string | null;
      }) => Promise<LocalChatItem>;
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
