import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";

const getOnboardingStatus = vi.fn(async () => ({
  device_id: "device-1",
  device_registered: false,
  trusted_telegram_user_count: 0,
  owner_profile_complete: false,
  password_configured: false,
  totp_configured: false,
  completed: false
}));

const getDeviceIdentity = vi.fn(async () => ({
  deviceId: "device-1",
  deviceLabel: "ws-01",
  createdAt: "2026-03-29T00:00:00.000Z"
}));

const getOwnerProfileState = vi.fn(async () => ({
  fullName: null,
  gender: null,
  age: null,
  city: null,
  timezone: null,
  language: null,
  contacts: null,
  occupation: null,
  bio: null,
  notes: null
}));

const getAuthConfigState = vi.fn(async () => ({
  passwordConfigured: false,
  totpConfigured: false
}));

const saveDeviceLabel = vi.fn(async () => ({
  deviceId: "device-1",
  deviceLabel: "ws-01",
  createdAt: "2026-03-29T00:00:00.000Z"
}));

const saveOwnerProfile = vi.fn(async (payload: Record<string, unknown>) => ({
  fullName: payload.fullName ?? "Иван Петров",
  gender: payload.gender ?? "мужской",
  age: payload.age ?? 30,
  city: payload.city ?? "Москва",
  timezone: null,
  language: null,
  contacts: null,
  occupation: null,
  bio: null,
  notes: null
}));

const registerDevice = vi.fn(async () => ({
  device_id: "device-1",
  device_label: "ws-01",
  owner_label: "Иван Петров",
  status: "offline",
  last_seen_at: null,
  created_at: "2026-03-29T00:00:00.000Z",
  updated_at: "2026-03-29T00:00:00.000Z"
}));

const createOnboardingToken = vi.fn(async () => ({
  device_id: "device-1",
  token: "token-123",
  expires_at: "2026-03-29T00:05:00.000Z",
  start_link: "https://t.me/KarpikBot?start=pair_token-123"
}));

const openPairingSession = vi.fn(async () => ({
  code: "PAIR42",
  expiresAt: "2026-03-29T00:05:00.000Z",
  isActive: true,
  trustedTelegramUserIds: []
}));

const saveAuthConfig = vi.fn(async () => ({
  passwordConfigured: true,
  totpConfigured: false
}));

const createTotpEnrollment = vi.fn(async () => ({
  secret: "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ",
  otpAuthUri:
    "otpauth://totp/Karpik:ws-01?secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ&issuer=Karpik&algorithm=SHA1&digits=6&period=30",
  qrDataUrl: "data:image/png;base64,ZmFrZQ==",
  issuer: "Karpik",
  accountName: "ws-01"
}));

const confirmTotpEnrollment = vi.fn(async () => ({
  passwordConfigured: true,
  totpConfigured: true
}));

beforeEach(() => {
  window.karpik = {
    view: "main",
    getDeviceIdentity,
    getOnboardingStatus,
    getOwnerProfileState,
    getAuthConfigState,
    saveDeviceLabel,
    saveOwnerProfile,
    registerDevice,
    createOnboardingToken,
    openPairingSession,
    saveAuthConfig,
    createTotpEnrollment,
    confirmTotpEnrollment
  } as unknown as NonNullable<Window["karpik"]>;

  vi.stubGlobal("open", vi.fn());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("desktop onboarding gate", () => {
  it("shows onboarding instead of the main shell for a fresh install", async () => {
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Настройка Karpik" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Чаты" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Открыть Telegram" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Показать код /pair" })).toBeInTheDocument();
  });

  it("saves owner data, opens Telegram deep-link, and exposes /pair fallback", async () => {
    render(<App />);

    fireEvent.change(await screen.findByLabelText("Название этого ПК"), {
      target: { value: "ws-01" }
    });
    fireEvent.change(screen.getByLabelText("ФИО"), {
      target: { value: "Иван Петров" }
    });
    fireEvent.change(screen.getByLabelText("Пол"), {
      target: { value: "мужской" }
    });
    fireEvent.change(screen.getByLabelText("Возраст"), {
      target: { value: "30" }
    });
    fireEvent.change(screen.getByLabelText("Город"), {
      target: { value: "Москва" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить данные" }));

    await waitFor(() => {
      expect(saveDeviceLabel).toHaveBeenCalledWith({ deviceLabel: "ws-01" });
      expect(saveOwnerProfile).toHaveBeenCalledWith({
        fullName: "Иван Петров",
        gender: "мужской",
        age: 30,
        city: "Москва"
      });
      expect(registerDevice).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("button", { name: "Открыть Telegram" }));

    await waitFor(() => {
      expect(createOnboardingToken).toHaveBeenCalledTimes(1);
      expect(window.open).toHaveBeenCalledWith(
        "https://t.me/KarpikBot?start=pair_token-123",
        "_blank",
        "noopener,noreferrer"
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Показать код /pair" }));

    expect(await screen.findByText("/pair PAIR42")).toBeInTheDocument();
  });
});
