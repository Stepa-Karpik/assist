// @vitest-environment node

import { describe, expect, it } from "vitest";

import { normalizeExecutionError } from "./errorNormalizer";

describe("normalizeExecutionError", () => {
  it("translates unexpected argument errors to Russian", () => {
    expect(normalizeExecutionError("error: unexpected argument 'osu' found")).toBe(
      "Ошибка: аргумент 'osu' не найден."
    );
  });

  it("translates codex availability errors to Russian", () => {
    expect(normalizeExecutionError("Codex CLI is unavailable.")).toBe(
      "Ошибка: Codex сейчас недоступен."
    );
  });

  it("uses the provided fallback for unknown errors", () => {
    expect(normalizeExecutionError("mystery failure", "Ошибка: действие не выполнено.")).toBe(
      "Ошибка: действие не выполнено."
    );
  });
});
