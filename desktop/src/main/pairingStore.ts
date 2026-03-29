const PAIRING_TTL_MS = 5 * 60 * 1000;

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

type RemotePairingState = {
  code: string | null;
  expiresAt: string | null;
  isActive: boolean;
  trustedTelegramUserIds: number[];
};

function generatePairCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export class PairingStore {
  private readonly now: () => Date;

  private readonly codeFactory: () => string;

  private activeSession: ActivePairingSession | null = null;

  private trustedTelegramUserIds: number[] = [];

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

  applyRemoteState(state: RemotePairingState): PairingState {
    this.trustedTelegramUserIds = [...state.trustedTelegramUserIds].sort((left, right) => left - right);
    this.activeSession =
      state.isActive && state.code !== null && state.expiresAt !== null
        ? {
            code: state.code,
            expiresAt: state.expiresAt
          }
        : null;

    return this.getState();
  }

  getState(): PairingState {
    const session = this.getValidSession();

    return {
      code: session?.code ?? null,
      expiresAt: session?.expiresAt ?? null,
      isActive: session !== null,
      trustedTelegramUserIds: [...this.trustedTelegramUserIds]
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
