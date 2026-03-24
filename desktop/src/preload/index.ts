import { contextBridge, ipcRenderer } from "electron";

const view = new URLSearchParams(window.location.search).get("view") ?? "main";

contextBridge.exposeInMainWorld("karpik", {
  view,
  getActivityLog: () => ipcRenderer.invoke("activity-log:get"),
  getAuthConfigState: () => ipcRenderer.invoke("auth:get-config-state"),
  getLocalChats: () => ipcRenderer.invoke("chats:get-local"),
  getLocalChatDetail: (chatId: string) => ipcRenderer.invoke("chats:get-detail", chatId),
  getCodexConfigState: () => ipcRenderer.invoke("codex:get-config-state"),
  getLocalApprovals: () => ipcRenderer.invoke("tasks:get-local-approvals"),
  getPairingState: () => ipcRenderer.invoke("pairing:get-state"),
  getQuickAccessState: () => ipcRenderer.invoke("quick-access:get-state"),
  getRuntimeStatus: () => ipcRenderer.invoke("runtime:get-status"),
  getTaskSnapshot: () => ipcRenderer.invoke("tasks:get-snapshot"),
  approveLocalApproval: (taskId: string) => ipcRenderer.invoke("tasks:approve-local-approval", taskId),
  createDesktopChat: (payload?: { title?: string; workspaceId?: string | null }) =>
    ipcRenderer.invoke("chats:create-desktop", payload),
  createLocalContinuationChat: (payload: {
    telegramChatId: number;
    title?: string;
    workspaceId?: string | null;
  }) => ipcRenderer.invoke("chats:create-continuation", payload),
  sendLocalChatMessage: (payload: { chatId: string; text: string }) =>
    ipcRenderer.invoke("chats:send-message", payload),
  submitQuickRequest: (payload: { text: string }) =>
    ipcRenderer.invoke("quick-access:submit-request", payload),
  openPairingSession: () => ipcRenderer.invoke("pairing:open-session"),
  rejectLocalApproval: (taskId: string) => ipcRenderer.invoke("tasks:reject-local-approval", taskId),
  saveAuthConfig: (payload: { password?: string; totpSecret?: string }) =>
    ipcRenderer.invoke("auth:save-config", payload),
  saveChatWorkspaceBinding: (payload: { chatId: number; workspaceId: string }) =>
    ipcRenderer.invoke("codex:save-chat-binding", payload),
  saveCodexConfig: (payload: {
    workspaces?: Array<{ id?: string; name?: string; rootPath?: string }>;
    defaultWorkspaceId?: string;
  }) => ipcRenderer.invoke("codex:save-config", payload)
});
