const PAIRING_TTL_MS = 5 * 60 * 1000;

type PairingStoreOptions = {
  now?: () => Date;
  codeFactory?: () => string;
};

type ActivePairingSession = {
  code: string | null;
  expiresAt: string | null;
  isActive: boolean;
};

export type PairingState = {
  code: string | null;
  expiresAt: string | null;
  isActive: boolean;
  trustedTelegramUserIds: number[];
};

export type PairingServerState = {
  trustedTelegramUserIds: number[];
  session:
    | {
        code: string | null;
        expiresAt: string | null;
        status: "active" | "inactive" | "consumed" | "expired" | "cancelled";
      }
    | null;
};

function generatePairCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function sortTrustedUserIds(userIds: number[]): number[] {
  return [...new Set(userIds)].sort((left, right) => left - right);
}

export class PairingStore {
  private readonly now: () => Date;

  private readonly codeFactory: () => string;

  private activeSession: ActivePairingSession = {
    code: null,
    expiresAt: null,
    isActive: false,
  };

  private trustedTelegramUserIds: number[] = [];

  constructor({ now = () => new Date(), codeFactory = generatePairCode }: PairingStoreOptions = {}) {
    this.now = now;
    this.codeFactory = codeFactory;
  }

  openPairingSession(): PairingState {
    this.activeSession = {
      code: this.codeFactory(),
      expiresAt: new Date(this.now().getTime() + PAIRING_TTL_MS).toISOString(),
      isActive: true,
    };

    return this.getState();
  }

  closePairingSession(): PairingState {
    this.activeSession = {
      code: null,
      expiresAt: null,
      isActive: false,
    };

    return this.getState();
  }

  syncFromServerState(state: PairingServerState): PairingState {
    this.trustedTelegramUserIds = sortTrustedUserIds(state.trustedTelegramUserIds);

    if (state.session === null || state.session.status !== "active") {
      this.activeSession = {
        code: null,
        expiresAt: null,
        isActive: false,
      };
      return this.getState();
    }

    const expiresAt = state.session.expiresAt;
    const isExpired =
      expiresAt === null || Number.isNaN(new Date(expiresAt).getTime()) || new Date(expiresAt).getTime() <= this.now().getTime();

    this.activeSession = {
      code: isExpired ? null : state.session.code,
      expiresAt: isExpired ? null : expiresAt,
      isActive: !isExpired,
    };

    return this.getState();
  }

  getState(): PairingState {
    return {
      code: this.activeSession.isActive ? this.activeSession.code : null,
      expiresAt: this.activeSession.isActive ? this.activeSession.expiresAt : null,
      isActive: this.activeSession.isActive,
      trustedTelegramUserIds: [...this.trustedTelegramUserIds],
    };
  }
}
