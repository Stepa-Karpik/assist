const PAIRING_TTL_MS = 5 * 60 * 1000;

type PairingResult = "paired" | "invalid_code" | "ignored";

type PairAttempt = {
  code: string;
  telegramUserId: number;
};

type PairingStoreOptions = {
  now?: () => Date;
  codeFactory?: () => string;
};

type ActivePairingSession = {
  code: string;
  expiresAt: string;
};

export type PairingState = {
  code: string | null;
  expiresAt: string | null;
  isActive: boolean;
  trustedTelegramUserIds: number[];
};

export type PairAttemptResolution = {
  result: PairingResult;
  trustedTelegramUserIds: number[];
};

function generatePairCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export class PairingStore {
  private readonly now: () => Date;

  private readonly codeFactory: () => string;

  private activeSession: ActivePairingSession | null = null;

  private trustedTelegramUserIds = new Set<number>();

  constructor({ now = () => new Date(), codeFactory = generatePairCode }: PairingStoreOptions = {}) {
    this.now = now;
    this.codeFactory = codeFactory;
  }

  openPairingSession(): PairingState {
    const expiresAt = new Date(this.now().getTime() + PAIRING_TTL_MS).toISOString();

    this.activeSession = {
      code: this.codeFactory(),
      expiresAt
    };

    return this.getState();
  }

  closePairingSession(): PairingState {
    this.activeSession = null;
    return this.getState();
  }

  getState(): PairingState {
    const session = this.getValidSession();

    return {
      code: session?.code ?? null,
      expiresAt: session?.expiresAt ?? null,
      isActive: session !== null,
      trustedTelegramUserIds: [...this.trustedTelegramUserIds].sort((left, right) => left - right)
    };
  }

  resolvePairAttempt({ code, telegramUserId }: PairAttempt): PairAttemptResolution {
    const session = this.getValidSession();

    if (session === null) {
      return {
        result: "ignored",
        trustedTelegramUserIds: [...this.trustedTelegramUserIds].sort((left, right) => left - right)
      };
    }

    if (session.code !== code) {
      return {
        result: "invalid_code",
        trustedTelegramUserIds: [...this.trustedTelegramUserIds].sort((left, right) => left - right)
      };
    }

    this.trustedTelegramUserIds.add(telegramUserId);
    this.activeSession = null;

    return {
      result: "paired",
      trustedTelegramUserIds: [...this.trustedTelegramUserIds].sort((left, right) => left - right)
    };
  }

  private getValidSession(): ActivePairingSession | null {
    if (this.activeSession === null) {
      return null;
    }

    if (new Date(this.activeSession.expiresAt).getTime() <= this.now().getTime()) {
      this.activeSession = null;
      return null;
    }

    return this.activeSession;
  }
}
