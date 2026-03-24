export {};

type PairingState = {
  code: string | null;
  expiresAt: string | null;
  isActive: boolean;
  trustedTelegramUserIds: number[];
};

type AuthConfigState = {
  passwordConfigured: boolean;
  totpConfigured: boolean;
};

declare global {
  interface Window {
    karpik?: {
      view: string;
      getAuthConfigState: () => Promise<AuthConfigState>;
      getPairingState: () => Promise<PairingState>;
      openPairingSession: () => Promise<PairingState>;
      saveAuthConfig: (payload: { password?: string; totpSecret?: string }) => Promise<AuthConfigState>;
    };
  }
}
