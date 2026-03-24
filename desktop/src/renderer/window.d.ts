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

type CodexConfigState = {
  workspaceRoot: string;
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

declare global {
  interface Window {
    karpik?: {
      view: string;
      getAuthConfigState: () => Promise<AuthConfigState>;
      getCodexConfigState: () => Promise<CodexConfigState>;
      getPairingState: () => Promise<PairingState>;
      getTaskSnapshot: () => Promise<TaskSnapshotItem[]>;
      openPairingSession: () => Promise<PairingState>;
      saveAuthConfig: (payload: { password?: string; totpSecret?: string }) => Promise<AuthConfigState>;
      saveCodexConfig: (payload: { workspaceRoot?: string }) => Promise<CodexConfigState>;
    };
  }
}
