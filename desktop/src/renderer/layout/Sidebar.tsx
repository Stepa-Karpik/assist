import designLogo from "../assets/design-logo.png";

export type NavigationItem = {
  id:
    | "home"
    | "chats"
    | "telegram"
    | "blocked"
    | "applications"
    | "knowledge"
    | "logs"
    | "services"
    | "profile"
    | "settings";
  label: string;
};

type SidebarProps = {
  items: NavigationItem[];
  activeSection: NavigationItem["id"];
  onSelect: (id: NavigationItem["id"]) => void;
};

function SidebarIcon({ id }: { id: NavigationItem["id"] }) {
  const sharedProps = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.7
  };

  switch (id) {
    case "home":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path {...sharedProps} d="M4 11.5L12 5l8 6.5" />
          <path {...sharedProps} d="M7 10.5V19h10v-8.5" />
        </svg>
      );
    case "chats":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path {...sharedProps} d="M6 6h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9l-4 3v-3H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" />
        </svg>
      );
    case "telegram":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path {...sharedProps} d="m20 5-3 14-5-5-3 2 1-4-4-2 14-5Z" />
        </svg>
      );
    case "blocked":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path {...sharedProps} d="M6 12h12" />
          <path {...sharedProps} d="M12 6v12" />
          <rect {...sharedProps} x="4" y="4" width="16" height="16" rx="4" />
        </svg>
      );
    case "applications":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <rect {...sharedProps} x="4" y="4" width="6" height="6" rx="1.5" />
          <rect {...sharedProps} x="14" y="4" width="6" height="6" rx="1.5" />
          <rect {...sharedProps} x="4" y="14" width="6" height="6" rx="1.5" />
          <rect {...sharedProps} x="14" y="14" width="6" height="6" rx="1.5" />
        </svg>
      );
    case "knowledge":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path {...sharedProps} d="M7 5.5h8a3 3 0 0 1 3 3V19l-4-2-4 2V8.5a3 3 0 0 0-3-3Z" />
          <path {...sharedProps} d="M7 5.5a3 3 0 0 0-3 3V19l4-2" />
        </svg>
      );
    case "logs":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path {...sharedProps} d="M8 6h8" />
          <path {...sharedProps} d="M8 12h8" />
          <path {...sharedProps} d="M8 18h5" />
          <rect {...sharedProps} x="4" y="4" width="16" height="16" rx="3" />
        </svg>
      );
    case "services":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path {...sharedProps} d="M12 4v4" />
          <path {...sharedProps} d="M12 16v4" />
          <path {...sharedProps} d="M4 12h4" />
          <path {...sharedProps} d="M16 12h4" />
          <circle {...sharedProps} cx="12" cy="12" r="4" />
        </svg>
      );
    case "profile":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <circle {...sharedProps} cx="12" cy="8" r="3.5" />
          <path {...sharedProps} d="M5.5 19a6.5 6.5 0 0 1 13 0" />
        </svg>
      );
    case "settings":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path {...sharedProps} d="M12 8.5A3.5 3.5 0 1 0 12 15.5A3.5 3.5 0 1 0 12 8.5Z" />
          <path {...sharedProps} d="M19 12a7.1 7.1 0 0 0-.1-1.1l2-1.5-2-3.4-2.4 1a8.3 8.3 0 0 0-1.9-1.1L14.2 3h-4.4l-.4 2.9a8.3 8.3 0 0 0-1.9 1.1l-2.4-1-2 3.4 2 1.5A7.1 7.1 0 0 0 5 12c0 .4 0 .8.1 1.1l-2 1.5 2 3.4 2.4-1c.6.5 1.2.8 1.9 1.1l.4 2.9h4.4l.4-2.9c.7-.3 1.3-.6 1.9-1.1l2.4 1 2-3.4-2-1.5c.1-.3.1-.7.1-1.1Z" />
        </svg>
      );
  }
}

export function Sidebar({ items, activeSection, onSelect }: SidebarProps) {
  const primaryItems = items.filter((item) => item.id !== "profile" && item.id !== "settings");
  const secondaryItems = items.filter((item) => item.id === "profile" || item.id === "settings");

  return (
    <aside className="sidebar-shell">
      <button
        aria-label="Главная"
        className={`sidebar-logo${activeSection === "home" ? " active" : ""}`}
        onClick={() => onSelect("home")}
        type="button"
      >
        <img alt="" src={designLogo} />
      </button>

      <nav aria-label="Primary navigation" className="sidebar-nav sidebar-nav--icon">
        {primaryItems.map((item) => (
          <button
            key={item.id}
            aria-label={item.label}
            className={item.id === activeSection ? "nav-button nav-button--icon active" : "nav-button nav-button--icon"}
            onClick={() => onSelect(item.id)}
            title={item.label}
            type="button"
          >
            <SidebarIcon id={item.id} />
            <span className="sr-only">{item.label}</span>
          </button>
        ))}
      </nav>

      <nav aria-label="Secondary navigation" className="sidebar-nav sidebar-nav--icon sidebar-nav--bottom">
        {secondaryItems.map((item) => (
          <button
            key={item.id}
            aria-label={item.label}
            className={item.id === activeSection ? "nav-button nav-button--icon active" : "nav-button nav-button--icon"}
            onClick={() => onSelect(item.id)}
            title={item.label}
            type="button"
          >
            <SidebarIcon id={item.id} />
            <span className="sr-only">{item.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}
