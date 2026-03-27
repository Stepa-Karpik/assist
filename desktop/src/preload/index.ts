import { contextBridge, ipcRenderer } from "electron";

const view = new URLSearchParams(window.location.search).get("view") ?? "main";

contextBridge.exposeInMainWorld("karpik", {
  view,
  getActivityLog: () => ipcRenderer.invoke("activity-log:get"),
  getAppsState: () => ipcRenderer.invoke("apps:get-state"),
  getAssistantProcesses: () => ipcRenderer.invoke("apps:get-active-processes"),
  getAppPreferences: () => ipcRenderer.invoke("app-preferences:get"),
  getOwnerProfileState: () => ipcRenderer.invoke("profile:get-state"),
  getAuthConfigState: () => ipcRenderer.invoke("auth:get-config-state"),
  createTotpEnrollment: () => ipcRenderer.invoke("auth:create-totp-enrollment"),
  confirmTotpEnrollment: (payload: { code: string }) =>
    ipcRenderer.invoke("auth:confirm-totp-enrollment", payload),
  getLocalChats: () => ipcRenderer.invoke("chats:get-local"),
  getLocalChatDetail: (chatId: string) => ipcRenderer.invoke("chats:get-detail", chatId),
  getCodexConfigState: () => ipcRenderer.invoke("codex:get-config-state"),
  getKnowledgeState: () => ipcRenderer.invoke("knowledge:get-state"),
  getLocalApprovals: () => ipcRenderer.invoke("tasks:get-local-approvals"),
  getPairingState: () => ipcRenderer.invoke("pairing:get-state"),
  getQuickAccessState: () => ipcRenderer.invoke("quick-access:get-state"),
  getRuntimeStatus: () => ipcRenderer.invoke("runtime:get-status"),
  getTaskSnapshot: () => ipcRenderer.invoke("tasks:get-snapshot"),
  getUpdateState: () => ipcRenderer.invoke("updates:get-state"),
  approveLocalApproval: (taskId: string) => ipcRenderer.invoke("tasks:approve-local-approval", taskId),
  checkForUpdates: () => ipcRenderer.invoke("updates:check"),
  createDesktopChat: (payload?: { title?: string; workspaceId?: string | null }) =>
    ipcRenderer.invoke("chats:create-desktop", payload),
  createLocalContinuationChat: (payload: {
    telegramChatId: number;
    title?: string;
    workspaceId?: string | null;
  }) => ipcRenderer.invoke("chats:create-continuation", payload),
  readKnowledgeEntry: (payload: {
    sectionId: "master_info" | "knowledge" | "notes" | "websites";
    relativePath: string;
  }) => ipcRenderer.invoke("knowledge:read-entry", payload),
  refreshDiscoveredApps: () => ipcRenderer.invoke("apps:refresh-discovered"),
  sendLocalChatMessage: (payload: { chatId: string; text: string }) =>
    ipcRenderer.invoke("chats:send-message", payload),
  submitQuickRequest: (payload: { chatId?: string; text: string }) =>
    ipcRenderer.invoke("quick-access:submit-request", payload),
  openPairingSession: () => ipcRenderer.invoke("pairing:open-session"),
  installUpdate: () => ipcRenderer.invoke("updates:install"),
  rejectLocalApproval: (taskId: string) => ipcRenderer.invoke("tasks:reject-local-approval", taskId),
  cancelTask: (taskId: string) => ipcRenderer.invoke("tasks:cancel", taskId),
  retryTask: (taskId: string) => ipcRenderer.invoke("tasks:retry", taskId),
  saveAuthConfig: (payload: { password?: string; totpSecret?: string }) =>
    ipcRenderer.invoke("auth:save-config", payload),
  saveAppPreferences: (payload: {
    launchAtLogin?: boolean;
    startHiddenOnLaunch?: boolean;
    closeToTrayOnClose?: boolean;
  }) => ipcRenderer.invoke("app-preferences:save", payload),
  saveOwnerProfile: (payload: {
    fullName?: string | null;
    gender?: string | null;
    age?: number | null;
    city?: string | null;
    timezone?: string | null;
    language?: string | null;
    contacts?: string | null;
    occupation?: string | null;
    bio?: string | null;
    notes?: string | null;
  }) => ipcRenderer.invoke("profile:save", payload),
  saveAppRegistryEntry: (payload: {
    appId?: string;
    displayName: string;
    launchPath: string;
    aliases?: string[];
    linked?: boolean;
    source?: "manual" | "shortcut" | "start_menu" | "program_files" | "discovered";
  }) => ipcRenderer.invoke("apps:save", payload),
  saveChatWorkspaceBinding: (payload: { chatId: number; workspaceId: string }) =>
    ipcRenderer.invoke("codex:save-chat-binding", payload),
  saveCodexConfig: (payload: {
    workspaces?: Array<{ id?: string; name?: string; rootPath?: string }>;
    defaultWorkspaceId?: string;
  }) => ipcRenderer.invoke("codex:save-config", payload),
  removeAppRegistryEntry: (appId: string) => ipcRenderer.invoke("apps:remove", appId)
});
