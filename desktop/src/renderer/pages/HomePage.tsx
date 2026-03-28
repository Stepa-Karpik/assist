import { useState } from "react";

import type { NavigationItem } from "../layout/Sidebar";
import designLogo from "../assets/design-logo.png";

type HomePageProps = {
  ownerProfile: NonNullable<Awaited<ReturnType<NonNullable<Window["karpik"]>["getOwnerProfileState"]>>> | null;
  onOpenSection: (section: NavigationItem["id"]) => void;
};

function getDisplayName(profile: HomePageProps["ownerProfile"]): string {
  const fullName = profile?.fullName?.trim();

  if (!fullName) {
    return "оператор";
  }

  return fullName.split(/\s+/)[0] ?? fullName;
}

export function HomePage({ ownerProfile, onOpenSection }: HomePageProps) {
  const [requestText, setRequestText] = useState("");
  const [responseText, setResponseText] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const greetingName = getDisplayName(ownerProfile);

  async function handleSubmit() {
    if (!window.karpik?.submitQuickRequest) {
      setErrorText("Quick access API недоступен в этом окружении.");
      return;
    }

    const normalizedText = requestText.trim();

    if (!normalizedText) {
      return;
    }

    setIsSubmitting(true);
    setErrorText(null);

    try {
      const result = await window.karpik.submitQuickRequest({
        text: normalizedText
      });
      setResponseText(result.detail.messages.at(-1)?.text ?? null);
      setRequestText("");
      onOpenSection("chats");
    } catch {
      setErrorText("Не удалось отправить быстрый запрос.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="reference-home" data-testid="reference-home">
      <div aria-hidden="true" className="reference-home__glow" />
      <img alt="" className="reference-home__orb" src={designLogo} />
      <h1 className="reference-home__title">
        Доброе утро, <span>{greetingName}</span>
        <br />
        Чем помочь сегодня?
      </h1>

      <div className="reference-home__composer">
        <textarea
          aria-label="Быстрый запрос"
          className="reference-home__input"
          onChange={(event) => setRequestText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void handleSubmit();
            }
          }}
          placeholder="Спросите о чем нибудь или расскажите как прошел ваш день!"
          rows={3}
          value={requestText}
        />
        <div className="reference-home__composer-footer">
          <button className="reference-home__attach" onClick={() => onOpenSection("chats")} type="button">
            Прикрепить
          </button>
          <button
            aria-label="Отправить запрос"
            className="reference-home__submit"
            disabled={isSubmitting || requestText.trim().length === 0}
            onClick={() => {
              void handleSubmit();
            }}
            type="button"
          >
            ↑
          </button>
        </div>
      </div>

      {responseText ? <p className="reference-home__response">{responseText}</p> : null}
      {errorText ? <p className="task-error">{errorText}</p> : null}
    </section>
  );
}
