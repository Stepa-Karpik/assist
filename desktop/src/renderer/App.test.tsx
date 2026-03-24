import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";

const getAuthConfigState = vi.fn(async () => ({
  passwordConfigured: false,
  totpConfigured: false
}));

const saveAuthConfig = vi.fn(async () => ({
  passwordConfigured: true,
  totpConfigured: true
}));

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
      getAuthConfigState,
      getPairingState,
      openPairingSession,
      saveAuthConfig
    };
  });

  afterEach(() => {
    cleanup();
    getAuthConfigState.mockClear();
    getPairingState.mockClear();
    openPairingSession.mockClear();
    saveAuthConfig.mockClear();
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
    expect(await screen.findByLabelText("Пароль для remote auth")).toBeInTheDocument();
    expect(await screen.findByLabelText("TOTP secret")).toBeInTheDocument();
    expect(await screen.findByText("Pairing не активен")).toBeInTheDocument();
    expect(await screen.findByText("Password: не настроен")).toBeInTheDocument();
    expect(await screen.findByText("TOTP: не настроен")).toBeInTheDocument();
    expect(getAuthConfigState).toHaveBeenCalledTimes(1);
    expect(getPairingState).toHaveBeenCalledTimes(1);
  });

  it("refreshes the visible pairing code after opening a session", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Настройки" }));
    fireEvent.click(await screen.findByRole("button", { name: "Открыть pairing" }));

    expect(openPairingSession).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Код: PAIR42")).toBeInTheDocument();
  });

  it("saves auth settings from the settings page", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Настройки" }));
    fireEvent.change(await screen.findByLabelText("Пароль для remote auth"), {
      target: { value: "secret-password" }
    });
    fireEvent.change(await screen.findByLabelText("TOTP secret"), {
      target: { value: "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ" }
    });
    fireEvent.click(await screen.findByRole("button", { name: "Сохранить auth-настройки" }));

    expect(saveAuthConfig).toHaveBeenCalledWith({
      password: "secret-password",
      totpSecret: "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"
    });
    expect(await screen.findByText("Password: настроен")).toBeInTheDocument();
    expect(await screen.findByText("TOTP: настроен")).toBeInTheDocument();
  });
});
