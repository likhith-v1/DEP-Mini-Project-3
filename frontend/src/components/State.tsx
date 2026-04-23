export function PanelState({ kind, message }: { kind: "loading" | "error" | "empty"; message?: string }) {
  const text = message ?? (kind === "loading" ? "Loading data…" : "No data — run analysis.py first");
  const borderColor = kind === "error" ? "var(--accent)" : "var(--border)";
  const textColor   = kind === "error" ? "var(--accent)" : "var(--text-dim)";
  return (
    <div
      className="p-4 text-xs font-mono"
      style={{ border: `1px solid ${borderColor}`, background: "var(--surface2)", color: textColor }}
    >
      {kind === "loading" && <span className="mr-2 opacity-50">◌</span>}
      {text}
    </div>
  );
}
