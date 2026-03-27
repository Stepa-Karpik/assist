const FILE_EXTENSION_PATTERN =
  /\b[\w.\-]+\.(?:pptx?|pdf|docx?|xlsx?|txt|md|png|jpe?g|gif|zip)\b/i;

const STOP_WORDS = new Set([
  "скинь",
  "скиньте",
  "пришли",
  "пришлите",
  "отправь",
  "отправьте",
  "покажи",
  "пожалуйста",
  "мне",
  "файл",
  "файлик",
  "документ",
  "документа",
  "с",
  "со",
  "из",
  "на",
  "рабочего",
  "стола",
  "desktop"
]);

function hasAnyMatch(input: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(input));
}

export function normalizeLocalIntent(input: string): string {
  const normalized = input.trim().replace(/\s+/g, " ");

  if (normalized.length === 0) {
    return normalized;
  }

  if (
    /^(status|screenshot(?:\s+(?:screen-1|screen-2|both))?|send-file\s+.+|read\s+.+|list\s+.+|write-note\s+.+::.+|codex(?:-write)?(?:\s+.+)?)$/i.test(
      normalized
    )
  ) {
    return normalized;
  }

  const lowered = normalized.toLowerCase();
  const fromDesktop = lowered.includes("рабоч") || lowered.includes("desktop");

  if (
    hasAnyMatch(normalized, [
      /(статус|онлайн|online|жив|пинг)/i,
      /(что\s+сейчас\s+с\s+задач)/i,
      /(что\s+с\s+задач)/i,
      /(что\s+с\s+пк)/i,
      /(что\s+по\s+задач)/i,
      /(какие\s+задач)/i,
      /(как\s+там\s+задач)/i
    ])
  ) {
    return "status";
  }

  if (hasAnyMatch(normalized, [/(скрин|screenshot|screen|экран|монитор)/i])) {
    if (hasAnyMatch(normalized, [/(оба|обоих|двух|все экраны|both)/i])) {
      return "screenshot both";
    }

    if (hasAnyMatch(normalized, [/(второго|второй|2-й|экран 2|monitor 2|screen 2)/i])) {
      return "screenshot screen-2";
    }

    return "screenshot screen-1";
  }

  if (hasAnyMatch(normalized, [/(прочитай|покажи содержимое|открой файл|read )/i])) {
    const fileMatch = normalized.match(FILE_EXTENSION_PATTERN);

    if (fileMatch !== null) {
      return `read ${fileMatch[0]}`;
    }
  }

  if (hasAnyMatch(normalized, [/(список|что в папке|покажи папку|list )/i])) {
    if (lowered.includes("docs")) {
      return "list docs";
    }

    if (lowered.includes("notes")) {
      return "list docs/notes";
    }

    if (fromDesktop) {
      return "list desktop";
    }

    return "list docs";
  }

  if (
    hasAnyMatch(normalized, [
      /(скинь|пришли|отправь|send|send-file|файл|документ)/i,
      /(презентац|презу|слайды|\.ppt|\.pptx|\.pdf|\.doc|\.docx|\.xlsx|\.png|\.jpg|\.jpeg|\.zip)/i
    ])
  ) {
    const exactFileMatch = normalized.match(FILE_EXTENSION_PATTERN);
    const prefix = fromDesktop ? "desktop::" : "";

    if (exactFileMatch !== null) {
      return `send-file ${prefix}${exactFileMatch[0]}`;
    }

    const tokens = normalized
      .toLowerCase()
      .split(/[\s._-]+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 1)
      .filter((token) => !STOP_WORDS.has(token));

    if (tokens.some((token) => token.startsWith("презентац") || token.startsWith("през"))) {
      const suffix = tokens
        .filter((token) => !token.startsWith("презентац") && !token.startsWith("през"))
        .join(" ");
      return `send-file ${prefix}${suffix ? `presentation ${suffix}` : "presentation"}`;
    }

    if (tokens.length > 0) {
      return `send-file ${prefix}${tokens.join(" ")}`;
    }
  }

  return `codex ${normalized}`;
}
