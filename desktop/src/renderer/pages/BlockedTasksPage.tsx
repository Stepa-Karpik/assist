export function BlockedTasksPage() {
  return (
    <div className="page-shell">
      <p className="eyebrow">Невыполненное</p>
      <h2>Blocked and Local-Approval Tasks</h2>
      <p className="muted-text">
        Tasks that were blocked by remote policy or that now require local review will live here.
      </p>
    </div>
  );
}
