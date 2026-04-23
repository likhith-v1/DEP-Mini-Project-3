import { ReactNode } from "react";
import { PanelState } from "./State";

interface PanelProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  headerRight?: ReactNode;
}

interface AsyncPanelProps extends PanelProps {
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  emptyMessage?: string;
}

export function Panel({ title, subtitle, children, className = "", headerRight }: PanelProps) {
  return (
    <section
      className={`${className}`}
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderTop: "2px solid var(--text)",
        padding: "1.25rem",
      }}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2
            className="font-display font-bold leading-tight"
            style={{
              fontSize: "0.85rem",
              color: "var(--text)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              fontVariationSettings: "'opsz' 18",
            }}
          >
            {title}
          </h2>
          {subtitle && (
            <p
              className="mt-1 font-body italic text-xs leading-relaxed"
              style={{ color: "var(--text-muted)" }}
            >
              {subtitle}
            </p>
          )}
        </div>
        {headerRight && <div className="shrink-0">{headerRight}</div>}
      </div>
      {children}
    </section>
  );
}

export function AsyncPanel({ loading, error, empty, emptyMessage, children, ...props }: AsyncPanelProps) {
  if (loading) return <Panel {...props}><PanelState kind="loading" /></Panel>;
  if (error)   return <Panel {...props}><PanelState kind="error" message={error} /></Panel>;
  if (empty)   return <Panel {...props}><PanelState kind="empty" message={emptyMessage} /></Panel>;
  return <Panel {...props}>{children}</Panel>;
}
