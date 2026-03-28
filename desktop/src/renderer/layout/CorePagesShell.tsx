import type { ReactNode } from "react";

import type { NavigationItem } from "./Sidebar";

type CorePagesShellProps = {
  activeSection: NavigationItem["id"];
  children: ReactNode;
  onCreateChat: () => void;
  onOpenTasks: () => void;
};

function SearchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M11 18a7 7 0 1 1 0-14a7 7 0 0 1 0 14Zm8 2l-4.2-4.2"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function SparklesIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M12 4.5v3M12 16.5v3M4.5 12h3M16.5 12h3M7.5 7.5l2 2M14.5 14.5l2 2M16.5 7.5l-2 2M9.5 14.5l-2 2"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="12" fill="none" r="2.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

export function CorePagesShell({ activeSection, children, onCreateChat, onOpenTasks }: CorePagesShellProps) {
  return (
    <section className={`core-shell core-shell--${activeSection}`} data-core-page={activeSection}>
      <header className="core-shell__topbar">
        <div className="core-shell__topbar-spacer" />
        <div className="core-shell__actions">
          <label className="core-shell__search" htmlFor="core-shell-search">
            <SearchIcon />
            <input id="core-shell-search" placeholder="Поиск" readOnly type="search" />
          </label>
          <button className="core-shell__action core-shell__action--secondary" onClick={onOpenTasks} type="button">
            <SparklesIcon />
            <span>Задачи</span>
          </button>
          <button
            aria-label="Новый локальный чат"
            className="core-shell__action core-shell__action--primary"
            onClick={onCreateChat}
            type="button"
          >
            <PlusIcon />
            <span>Новый чат</span>
          </button>
        </div>
      </header>
      <div className="core-shell__body">{children}</div>
    </section>
  );
}
