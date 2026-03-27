export function normalizeExecutionError(
  value: unknown,
  fallback = "Ошибка: действие не выполнено."
): string {
  const message =
    typeof value === "string"
      ? value
      : value instanceof Error
        ? value.message
        : "";

  const unexpectedArgumentMatch = /unexpected argument '([^']+)' found/i.exec(message);
  if (unexpectedArgumentMatch !== null) {
    return `Ошибка: аргумент '${unexpectedArgumentMatch[1]}' не найден.`;
  }

  if (/codex cli is unavailable/i.test(message)) {
    return "Ошибка: Codex сейчас недоступен.";
  }

  if (/enoent|file not found/i.test(message)) {
    return "Ошибка: файл не найден.";
  }

  if (/directory not found/i.test(message)) {
    return "Ошибка: папка не найдена.";
  }

  if (/unsupported task intent/i.test(message)) {
    return "Ошибка: такая команда пока не поддерживается.";
  }

  return fallback;
}
