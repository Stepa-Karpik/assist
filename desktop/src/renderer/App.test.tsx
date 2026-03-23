import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";

const getPairingState = vi.fn(async () => ({
  code: null,
  expiresAt: null,
  isActive: false,
  trustedTelegramUserIds: []
}));

const openPairingSession = vi.fn(async () => ({
  code: "PAIR42",
  expiresAt: "2026-03-24T00:05:00.000Z",
  isActive: true,
  trustedTelegramUserIds: []
}));

describe("App navigation", () => {
  beforeEach(() => {
    window.karpik = {
      view: "main",
      getPairingState,
      openPairingSession
    };
  });

  afterEach(() => {
    cleanup();
    getPairingState.mockClear();
    openPairingSession.mockClear();
  });

  it("renders all primary sections", () => {
    render(<App />);

    expect(screen.getByRole("button", { name: "Чаты" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Чаты Telegram" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Невыполненное" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Knowledge / Review" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Логи" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Сервисы" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Настройки" })).toBeInTheDocument();
  });

  it("shows pairing controls in settings", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Настройки" }));

    expect(await screen.findByRole("button", { name: "Открыть pairing" })).toBeInTheDocument();
    expect(await screen.findByText("Pairing не активен")).toBeInTheDocument();
    expect(getPairingState).toHaveBeenCalledTimes(1);
  });

  it("refreshes the visible pairing code after opening a session", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Настройки" }));
    fireEvent.click(await screen.findByRole("button", { name: "Открыть pairing" }));

    expect(openPairingSession).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Код: PAIR42")).toBeInTheDocument();
  });
});
