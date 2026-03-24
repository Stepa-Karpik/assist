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

type AppPreferencesState = {
  launchAtLogin: boolean;
  notificationsEnabled: boolean;
  startHiddenOnLaunch: boolean;
  closeToTrayOnClose: boolean;
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

type ActivityLogEntry = {
  entryId: string;
  kind: "local_request" | "local_result" | "remote_task";
  status: "info" | "success" | "warning" | "error";
  title: string;
  detail: string | null;
  chatId: string | null;
  taskId: string | null;
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

type LocalChatMessageItem = {
  messageId: string;
  role: "user" | "assistant" | "system";
  text: string;
  createdAt: string;
};

type LocalChatDetail = LocalChatItem & {
  messages: LocalChatMessageItem[];
};

type QuickAccessState = {
  targetChat: LocalChatItem | null;
  localChatCount: number;
  recentActivity: ActivityLogEntry[];
  recentChats: LocalChatItem[];
};

type RuntimeStatus = {
  deviceId: string;
  serverUrl: string;
  serverHeartbeatState: "online" | "offline";
  serverHeartbeatReachable: boolean;
  serverHeartbeatAt: string | null;
  pairingActive: boolean;
  trustedTelegramUserCount: number;
  passwordConfigured: boolean;
  totpConfigured: boolean;
  workspaceCount: number;
  defaultWorkspaceName: string;
  defaultWorkspaceRoot: string;
  localChatCount: number;
  lastActiveChatTitle: string | null;
  activityLogCount: number;
  pendingTaskCount: number;
  blockedTaskCount: number;
};

type KnowledgeSectionId = "master_info" | "knowledge" | "notes" | "websites";

type KnowledgeEntry = {
  relativePath: string;
  displayName: string;
};

type KnowledgeSection = {
  id: KnowledgeSectionId;
  label: string;
  entries: KnowledgeEntry[];
};

type KnowledgeEntryDetail = {
  sectionId: KnowledgeSectionId;
  relativePath: string;
  content: string;
};

declare global {
  interface Window {
    karpik?: {
      view: string;
      getActivityLog: () => Promise<ActivityLogEntry[]>;
      getAppPreferences: () => Promise<AppPreferencesState>;
      getAuthConfigState: () => Promise<AuthConfigState>;
      getCodexConfigState: () => Promise<CodexConfigState>;
      getKnowledgeState: () => Promise<KnowledgeSection[]>;
      getLocalApprovals: () => Promise<LocalApprovalItem[]>;
      getLocalChatDetail: (chatId: string) => Promise<LocalChatDetail | null>;
      getLocalChats: () => Promise<LocalChatItem[]>;
      getPairingState: () => Promise<PairingState>;
      getQuickAccessState: () => Promise<QuickAccessState | null>;
      getRuntimeStatus: () => Promise<RuntimeStatus>;
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
      readKnowledgeEntry: (payload: {
        sectionId: KnowledgeSectionId;
        relativePath: string;
      }) => Promise<KnowledgeEntryDetail | null>;
      rejectLocalApproval: (taskId: string) => Promise<void>;
      retryTask: (taskId: string) => Promise<void>;
      sendLocalChatMessage: (payload: {
        chatId: string;
        text: string;
      }) => Promise<LocalChatDetail | null>;
      submitQuickRequest: (payload: {
        chatId?: string;
        text: string;
      }) => Promise<{
        chat: LocalChatItem;
        detail: LocalChatDetail;
      }>;
      saveAuthConfig: (payload: { password?: string; totpSecret?: string }) => Promise<AuthConfigState>;
      saveAppPreferences: (payload: Partial<AppPreferencesState>) => Promise<AppPreferencesState>;
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
