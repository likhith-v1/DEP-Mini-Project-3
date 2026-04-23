export function DashboardFooter() {
  return (
    <footer
      className="mt-10 px-6 py-5"
      style={{ borderTop: "2px solid var(--text)", background: "var(--surface)" }}
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <p className="font-mono text-[9px] uppercase tracking-[0.2em]" style={{ color: "var(--text-dim)" }}>
          Python · Reddit JSON API · MongoDB · FastAPI · React · Recharts
        </p>
        <div className="flex items-center gap-3">
          <div style={{ width: 16, height: 1, background: "var(--accent)" }} />
          <p className="font-mono text-[9px]" style={{ color: "var(--text-dim)" }}>
            DEP Mini-Project III · JAIN University · 2026
          </p>
        </div>
      </div>
    </footer>
  );
}
