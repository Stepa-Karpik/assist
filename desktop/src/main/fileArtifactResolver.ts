import type { Dirent } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

type ResolveFileArtifactInput = {
  query: string;
  userHome: string;
  additionalRoots: string[];
};

export type ResolvedFileArtifact = {
  mimeType: string;
  fileName: string;
  contentBase64: string;
};

const STOP_WORDS = new Set([
  "send",
  "file",
  "send-file",
  "скинь",
  "пришли",
  "отправь",
  "файл",
  "документ",
  "с",
  "со",
  "из",
  "на",
  "рабочего",
  "стола",
  "desktop"
]);

const TRANSLITERATION_MAP: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "sch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya"
};

function transliterate(value: string): string {
  return Array.from(value.toLowerCase())
    .map((character) => TRANSLITERATION_MAP[character] ?? character)
    .join("");
}

function normalizeToken(value: string): string {
  return transliterate(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function levenshtein(left: string, right: string): number {
  const rows = Array.from({ length: left.length + 1 }, () =>
    new Array<number>(right.length + 1).fill(0)
  );

  for (let index = 0; index <= left.length; index += 1) {
    rows[index][0] = index;
  }

  for (let index = 0; index <= right.length; index += 1) {
    rows[0][index] = index;
  }

  for (let row = 1; row <= left.length; row += 1) {
    for (let column = 1; column <= right.length; column += 1) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1;
      rows[row][column] = Math.min(
        rows[row - 1][column] + 1,
        rows[row][column - 1] + 1,
        rows[row - 1][column - 1] + cost
      );
    }
  }

  return rows[left.length][right.length];
}

function getMimeType(fileName: string): string {
  const extension = path.extname(fileName).toLowerCase();

  switch (extension) {
    case ".ppt":
      return "application/vnd.ms-powerpoint";
    case ".pptx":
      return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    case ".pdf":
      return "application/pdf";
    case ".doc":
      return "application/msword";
    case ".docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case ".xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case ".txt":
      return "text/plain";
    case ".md":
      return "text/markdown";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".zip":
      return "application/zip";
    default:
      return "application/octet-stream";
  }
}

function parseQuery(value: string) {
  const trimmed = value.trim();
  const separatorIndex = trimmed.indexOf("::");
  const locationHint = separatorIndex >= 0 ? trimmed.slice(0, separatorIndex).toLowerCase() : null;
  const rawQuery = separatorIndex >= 0 ? trimmed.slice(separatorIndex + 2).trim() : trimmed;
  const loweredQuery = rawQuery.toLowerCase();
  const exactFileName = path.basename(rawQuery).trim().toLowerCase();
  const prefersPresentation =
    loweredQuery.includes("presentation") || loweredQuery.includes("презентац");
  const tokens = rawQuery
    .split(/[\s._-]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
    .filter((token) => !STOP_WORDS.has(token.toLowerCase()));

  return {
    locationHint,
    rawQuery,
    exactFileName,
    prefersPresentation,
    normalizedTokens: tokens.map(normalizeToken).filter((token) => token.length > 0)
  };
}

async function walkFiles(root: string, depth = 0): Promise<string[]> {
  if (depth > 4) {
    return [];
  }

  let entries: Dirent[];

  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }

  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(root, entry.name);

    if (entry.isFile()) {
      files.push(entryPath);
      continue;
    }

    if (entry.isDirectory()) {
      files.push(...(await walkFiles(entryPath, depth + 1)));
    }
  }

  return files;
}

function buildRoots(locationHint: string | null, userHome: string, additionalRoots: string[]): string[] {
  const preferredRoots: string[] = [];

  if (locationHint === "desktop") {
    preferredRoots.push(path.join(userHome, "Desktop"));
  }

  preferredRoots.push(
    path.join(userHome, "Desktop"),
    path.join(userHome, "Documents"),
    path.join(userHome, "Downloads"),
    ...additionalRoots
  );

  return Array.from(new Set(preferredRoots.map((root) => path.resolve(root))));
}

function scoreCandidate(
  filePath: string,
  options: {
    exactFileName: string;
    normalizedTokens: string[];
    prefersPresentation: boolean;
  }
): number {
  const { exactFileName, normalizedTokens, prefersPresentation } = options;
  const baseName = path.basename(filePath);
  const normalizedBaseName = baseName.toLowerCase();
  const normalizedStem = normalizeToken(path.parse(baseName).name);
  const normalizedParts = normalizedBaseName
    .split(/[\s._-]+/)
    .map(normalizeToken)
    .filter((part) => part.length > 0);
  let score = 0;

  if (exactFileName.length > 0 && normalizedBaseName === exactFileName) {
    score += 1000;
  }

  if (prefersPresentation && [".ppt", ".pptx"].includes(path.extname(baseName).toLowerCase())) {
    score += 200;
  }

  for (const token of normalizedTokens) {
    if (token.length === 0) {
      continue;
    }

    if (normalizedStem === token) {
      score += 250;
      continue;
    }

    if (normalizedStem.includes(token) || token.includes(normalizedStem)) {
      score += 120;
      continue;
    }

    if (normalizedParts.some((part) => part === token)) {
      score += 100;
      continue;
    }

    const distance = levenshtein(normalizedStem, token);

    if (distance <= 1) {
      score += 90;
      continue;
    }

    if (distance <= 2) {
      score += 50;
    }
  }

  return score;
}

export async function resolveFileArtifact({
  query,
  userHome,
  additionalRoots
}: ResolveFileArtifactInput): Promise<ResolvedFileArtifact | null> {
  const { locationHint, exactFileName, normalizedTokens, prefersPresentation } = parseQuery(query);
  const roots = buildRoots(locationHint, userHome, additionalRoots);
  const files = (await Promise.all(roots.map((root) => walkFiles(root)))).flat();

  let bestMatch: string | null = null;
  let bestScore = 0;

  for (const filePath of files) {
    const score = scoreCandidate(filePath, {
      exactFileName,
      normalizedTokens,
      prefersPresentation
    });

    if (score > bestScore) {
      bestMatch = filePath;
      bestScore = score;
    }
  }

  if (bestMatch === null || bestScore < 90) {
    return null;
  }

  return {
    mimeType: getMimeType(bestMatch),
    fileName: path.basename(bestMatch),
    contentBase64: (await fs.readFile(bestMatch)).toString("base64")
  };
}
