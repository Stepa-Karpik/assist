import { useState } from "react";

import { Sidebar, type NavigationItem } from "./layout/Sidebar";
import { BlockedTasksPage } from "./pages/BlockedTasksPage";
import { ChatsPage } from "./pages/ChatsPage";
import { KnowledgePage } from "./pages/KnowledgePage";
import { LogsPage } from "./pages/LogsPage";
import { ServicesPage } from "./pages/ServicesPage";
import { SettingsPage } from "./pages/SettingsPage";
import { TelegramChatsPage } from "./pages/TelegramChatsPage";

function ProgressBar() {
  return (
    <div className="progress-shell" aria-label="Global progress">
      <div className="progress-fill" style={{ width: "28%" }} />
    </div>
  );
}

function QuickPopupView() {
  return (
    <main className="quick-popup">
      <div className="quick-header">
        <div>
          <p className="eyebrow">Karpik</p>
          <h1>Quick Access</h1>
        </div>
        <button className="ghost-button" type="button">
          +
        </button>
      </div>

      <section className="quick-card">
        <p className="section-label">Current progress</p>
        <ProgressBar />
        <p className="muted-text">Approximate completion across running tasks: 28%</p>
      </section>

      <section className="quick-card">
        <label className="section-label" htmlFor="quick-task">
          Quick request
        </label>
        <input
          className="quick-input"
          id="quick-task"
          placeholder="Send to the last active local chat"
          type="text"
        />
      </section>
    </main>
  );
}

const navigationItems: NavigationItem[] = [
  { id: "chats", label: "Чаты" },
  { id: "telegram", label: "Чаты Telegram" },
  { id: "blocked", label: "Невыполненное" },
  { id: "knowledge", label: "Knowledge / Review" },
  { id: "logs", label: "Логи" },
  { id: "services", label: "Сервисы" },
  { id: "settings", label: "Настройки" }
];

function MainWindowView() {
  const [activeSection, setActiveSection] = useState<NavigationItem["id"]>("chats");

  return (
    <main className="desktop-layout">
      <Sidebar
        activeSection={activeSection}
        items={navigationItems}
        onSelect={setActiveSection}
      />
      <section className="content-panel">
        {activeSection === "chats" && <ChatsPage />}
        {activeSection === "telegram" && (
          <TelegramChatsPage
            onContinueToLocalChats={() => {
              setActiveSection("chats");
            }}
          />
        )}
        {activeSection === "blocked" && <BlockedTasksPage />}
        {activeSection === "knowledge" && <KnowledgePage />}
        {activeSection === "logs" && <LogsPage />}
        {activeSection === "services" && <ServicesPage />}
        {activeSection === "settings" && <SettingsPage />}
      </section>
    </main>
  );
}

export default function App() {
  const view = window.karpik?.view ?? "main";

  if (view === "quick-popup") {
    return <QuickPopupView />;
  }

  return <MainWindowView />;
}
