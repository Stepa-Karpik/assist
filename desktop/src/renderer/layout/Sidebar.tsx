export type NavigationItem = {
  id: "chats" | "telegram" | "blocked" | "knowledge" | "logs" | "services" | "settings";
  label: string;
};

type SidebarProps = {
  items: NavigationItem[];
  activeSection: NavigationItem["id"];
  onSelect: (id: NavigationItem["id"]) => void;
};

export function Sidebar({ items, activeSection, onSelect }: SidebarProps) {
  return (
    <aside className="sidebar-shell">
      <div className="sidebar-brand">
        <p className="eyebrow">Karpik</p>
        <h1 className="sidebar-title">Control Plane</h1>
        <p className="muted-text">
          Desktop chats, Telegram intake, blocked tasks, and local review.
        </p>
      </div>

      <nav className="sidebar-nav" aria-label="Primary navigation">
        {items.map((item) => (
          <button
            key={item.id}
            className={item.id === activeSection ? "nav-button active" : "nav-button"}
            onClick={() => onSelect(item.id)}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}
