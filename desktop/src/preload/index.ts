import { contextBridge, ipcRenderer } from "electron";

const view = new URLSearchParams(window.location.search).get("view") ?? "main";

contextBridge.exposeInMainWorld("karpik", {
  view,
  getAuthConfigState: () => ipcRenderer.invoke("auth:get-config-state"),
  getPairingState: () => ipcRenderer.invoke("pairing:get-state"),
  getTaskSnapshot: () => ipcRenderer.invoke("tasks:get-snapshot"),
  openPairingSession: () => ipcRenderer.invoke("pairing:open-session"),
  saveAuthConfig: (payload: { password?: string; totpSecret?: string }) =>
    ipcRenderer.invoke("auth:save-config", payload)
});
