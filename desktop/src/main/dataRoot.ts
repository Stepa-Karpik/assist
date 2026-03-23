import path from "node:path";

import { app } from "electron";

export function getDataRoot(appDataRoot?: string): string {
  return path.join(appDataRoot ?? app.getPath("appData"), "Karpik");
}
