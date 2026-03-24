import { contextBridge, ipcRenderer } from "electron";

const view = new URLSearchParams(window.location.search).get("view") ?? "main";

contextBridge.exposeInMainWorld("karpik", {
  view,
  getAuthConfigState: () => ipcRenderer.invoke("auth:get-config-state"),
  getCodexConfigState: () => ipcRenderer.invoke("codex:get-config-state"),
  getLocalApprovals: () => ipcRenderer.invoke("tasks:get-local-approvals"),
  getPairingState: () => ipcRenderer.invoke("pairing:get-state"),
  getTaskSnapshot: () => ipcRenderer.invoke("tasks:get-snapshot"),
  approveLocalApproval: (taskId: string) => ipcRenderer.invoke("tasks:approve-local-approval", taskId),
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
