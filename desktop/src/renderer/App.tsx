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

function MainShell() {
  return (
    <main className="app-shell">
      <section className="hero-panel">
        <p className="eyebrow">Karpik</p>
        <h1>Desktop Shell Bootstrap</h1>
        <p className="muted-text">
          Main window, tray bootstrap, and runtime path setup are ready. The full navigation
          structure will be added next.
        </p>
      </section>
    </main>
  );
}

export default function App() {
  const view = window.karpik?.view ?? "main";

  if (view === "quick-popup") {
    return <QuickPopupView />;
  }

  return <MainShell />;
}
