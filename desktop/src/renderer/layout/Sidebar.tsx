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
        <div className="brand-mark" aria-hidden="true">
          K
        </div>
        <div>
          <p className="eyebrow">Karpik</p>
          <h1 className="sidebar-title">Operator Console</h1>
          <p className="muted-text">
            Telegram intake, локальные чаты, codex review и контроль исполнения.
          </p>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="Primary navigation">
        {items.map((item) => (
          <button
            key={item.id}
            className={item.id === activeSection ? "nav-button active" : "nav-button"}
            onClick={() => onSelect(item.id)}
            type="button"
          >
            <span className="nav-label">{item.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}
