import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { DiscoveredAppInput } from "./appRegistryStore";

type DiscoverySource = DiscoveredAppInput["source"];

type DiscoverAppsOptions = {
  desktopRoot?: string;
  startMenuRoots?: string[];
  programFilesRoots?: string[];
  maxProgramFilesDepth?: number;
};

const SHORTCUT_EXTENSIONS = new Set([".lnk", ".exe"]);

function buildDefaultStartMenuRoots(): string[] {
  return [
    path.join(
      process.env.ProgramData ?? "C:\\ProgramData",
      "Microsoft",
      "Windows",
      "Start Menu",
      "Programs"
    ),
    path.join(
      process.env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming"),
      "Microsoft",
      "Windows",
      "Start Menu",
      "Programs"
    )
  ];
}

function buildDefaultProgramFilesRoots(): string[] {
  return [
    process.env.ProgramFiles ?? "C:\\Program Files",
    process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)"
  ];
}

function normalizeDisplayName(filePath: string): string {
  return path
    .basename(filePath, path.extname(filePath))
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeAliasKey(value: string): string {
  return value
    .toLowerCase()
    .replaceAll("ё", "е")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildAliases(displayName: string): string[] {
  const normalized = normalizeAliasKey(displayName);
  if (!normalized) {
    return [];
  }

  const tokens = normalized.split(" ").filter(Boolean);
  const aliases = new Set<string>([normalized]);

  if (tokens.length > 0) {
    aliases.add(tokens.join(" "));
    aliases.add(tokens[0]);
  }

  if (tokens.length > 1) {
    aliases.add(tokens.slice(0, 2).join(" "));
  }

  return [...aliases];
}

async function collectFiles(
  root: string,
  options: {
    depth: number;
    maxDepth: number;
  }
): Promise<string[]> {
  const { depth, maxDepth } = options;
  let entries;
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }

  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);

    if (entry.isDirectory()) {
      if (depth < maxDepth) {
        files.push(...(await collectFiles(fullPath, { depth: depth + 1, maxDepth })));
      }
      continue;
    }

    const extension = path.extname(entry.name).toLowerCase();
    if (SHORTCUT_EXTENSIONS.has(extension)) {
      files.push(fullPath);
    }
  }

  return files;
}

function toDiscoveredAppInput(filePath: string, source: DiscoverySource): DiscoveredAppInput | null {
  const displayName = normalizeDisplayName(filePath);
  if (!displayName) {
    return null;
  }

  return {
    displayName,
    launchPath: filePath,
    aliases: buildAliases(displayName),
    source
  };
}

export async function discoverApps({
  desktopRoot = path.join(os.homedir(), "Desktop"),
  startMenuRoots = buildDefaultStartMenuRoots(),
  programFilesRoots = buildDefaultProgramFilesRoots(),
  maxProgramFilesDepth = 3
}: DiscoverAppsOptions = {}): Promise<DiscoveredAppInput[]> {
  const buckets: Array<{ root: string; source: DiscoverySource; maxDepth: number }> = [
    { root: desktopRoot, source: "shortcut", maxDepth: 1 },
    ...startMenuRoots.map((root) => ({ root, source: "start_menu" as const, maxDepth: 4 })),
    ...programFilesRoots.map((root) => ({
      root,
      source: "program_files" as const,
      maxDepth: maxProgramFilesDepth
    }))
  ];

  const discovered = new Map<string, DiscoveredAppInput>();

  for (const bucket of buckets) {
    const files = await collectFiles(bucket.root, { depth: 0, maxDepth: bucket.maxDepth });
    for (const filePath of files) {
      const key = filePath.toLowerCase();
      if (discovered.has(key)) {
        continue;
      }

      const item = toDiscoveredAppInput(filePath, bucket.source);
      if (item !== null) {
        discovered.set(key, item);
      }
    }
  }

  return [...discovered.values()].sort((left, right) =>
    left.displayName.localeCompare(right.displayName, "ru")
  );
}
