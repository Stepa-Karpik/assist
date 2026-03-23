export {};

type PairingState = {
  code: string | null;
  expiresAt: string | null;
  isActive: boolean;
  trustedTelegramUserIds: number[];
};

declare global {
  interface Window {
    karpik?: {
      view: string;
      getPairingState: () => Promise<PairingState>;
      openPairingSession: () => Promise<PairingState>;
    };
  }
}
