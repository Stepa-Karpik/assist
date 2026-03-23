import { contextBridge } from "electron";

const view = new URLSearchParams(window.location.search).get("view") ?? "main";

contextBridge.exposeInMainWorld("karpik", {
  view
});
