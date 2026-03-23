import { contextBridge, ipcRenderer } from "electron";

const view = new URLSearchParams(window.location.search).get("view") ?? "main";

contextBridge.exposeInMainWorld("karpik", {
  view,
  getPairingState: () => ipcRenderer.invoke("pairing:get-state"),
  openPairingSession: () => ipcRenderer.invoke("pairing:open-session")
});
