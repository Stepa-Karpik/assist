import { useEffect, useState } from "react";

type PairingState = {
  code: string | null;
  expiresAt: string | null;
  isActive: boolean;
  trustedTelegramUserIds: number[];
};

const emptyPairingState: PairingState = {
  code: null,
  expiresAt: null,
  isActive: false,
  trustedTelegramUserIds: []
};

function formatExpiryHint(expiresAt: string | null): string {
  if (expiresAt === null) {
    return "Код действует 5 минут и принимается только пока ПК онлайн.";
  }

  const expiresAtDate = new Date(expiresAt);

  if (Number.isNaN(expiresAtDate.getTime())) {
    return `Действует до: ${expiresAt}`;
  }

  return `Действует до: ${expiresAtDate.toLocaleString("ru-RU")}`;
}

export function SettingsPage() {
  const [pairingState, setPairingState] = useState<PairingState>(emptyPairingState);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpeningPairing, setIsOpeningPairing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isSubscribed = true;

    async function loadPairingState() {
      if (!window.karpik?.getPairingState) {
        if (isSubscribed) {
          setIsLoading(false);
        }

        return;
      }

      try {
        const nextState = await window.karpik.getPairingState();

        if (isSubscribed) {
          setPairingState(nextState);
        }
      } catch {
        if (isSubscribed) {
          setError("Не удалось получить локальное состояние pairing.");
        }
      } finally {
        if (isSubscribed) {
          setIsLoading(false);
        }
      }
    }

    void loadPairingState();

    return () => {
      isSubscribed = false;
    };
  }, []);

  async function handleOpenPairingSession() {
    if (!window.karpik?.openPairingSession) {
      setError("Pairing API недоступен в этом окружении.");
      return;
    }

    setError(null);
    setIsOpeningPairing(true);

    try {
      const nextState = await window.karpik.openPairingSession();
      setPairingState(nextState);
    } catch {
      setError("Не удалось открыть pairing-сессию.");
    } finally {
      setIsOpeningPairing(false);
    }
  }

  const pairingStatus = isLoading ? "Загрузка pairing-состояния..." : "Pairing не активен";

  return (
    <div className="page-shell">
      <p className="eyebrow">Настройки</p>
      <h2>Локальные настройки устройства</h2>
      <p className="muted-text">
        Здесь управляются pairing-код, доверенные Telegram ID и локальная политика доступа.
      </p>

      <section className="quick-card">
        <p className="section-label">Telegram pairing</p>
        <p>{pairingStatus}</p>
        {!isLoading && pairingState.isActive && pairingState.code !== null ? (
          <p>Код: {pairingState.code}</p>
        ) : null}
        <p className="muted-text">
          {formatExpiryHint(pairingState.isActive ? pairingState.expiresAt : null)}
        </p>
        <p className="muted-text">
          Доверенные Telegram ID: {pairingState.trustedTelegramUserIds.length}
        </p>
        {error !== null ? <p className="muted-text">{error}</p> : null}
        <button
          className="ghost-button"
          disabled={isLoading || isOpeningPairing}
          onClick={() => {
            void handleOpenPairingSession();
          }}
          type="button"
        >
          {isOpeningPairing ? "Открываем..." : "Открыть pairing"}
        </button>
      </section>
    </div>
  );
}
