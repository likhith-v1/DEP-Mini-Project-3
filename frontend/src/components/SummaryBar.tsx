import { useEffect, useRef, useState } from "react";
import { useApi } from "../hooks/useApi";
import { Summary } from "../types";

function useCounter(target: number, duration = 900) {
  const [value, setValue] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    if (!target || target === prev.current) return;
    prev.current = target;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 4);
      setValue(Math.round(ease * target));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration]);
  return value;
}

function Stat({ label, target, note, delay = 0 }: { label: string; target: number; note: string; delay?: number }) {
  const value = useCounter(target);
  return (
    <div
      className="fade-up flex flex-col justify-between p-5"
      style={{
        animationDelay: `${delay}ms`,
        borderRight: "1px solid var(--border)",
      }}
    >
      <p
        className="font-mono text-[9px] uppercase tracking-[0.25em] mb-2"
        style={{ color: "var(--text-dim)" }}
      >
        {label}
      </p>
      <p
        className="font-display font-black leading-none"
        style={{
          fontSize: "clamp(2rem, 4vw, 3rem)",
          color: "var(--accent)",
          fontVariationSettings: "'opsz' 72",
          letterSpacing: "-0.02em",
        }}
      >
        {value || "—"}
      </p>
      <p
        className="font-body italic text-xs mt-2"
        style={{ color: "var(--text-dim)" }}
      >
        {note}
      </p>
    </div>
  );
}

export function SummaryBar() {
  const { data } = useApi<Summary>("/summary");
  const subs = data?.subreddits ?? [];

  return (
    <section
      className="mx-auto mt-6 max-w-7xl overflow-hidden"
      style={{
        border: "1px solid var(--border)",
        borderTop: "2px solid var(--text)",
        background: "var(--surface)",
      }}
    >
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
        {/* Subreddit pills */}
        <div
          className="fade-up col-span-2 md:col-span-4 lg:col-span-1 p-5"
          style={{ borderRight: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}
        >
          <p className="font-mono text-[9px] uppercase tracking-[0.25em] mb-3" style={{ color: "var(--text-dim)" }}>
            Communities
          </p>
          <div className="flex flex-wrap gap-1">
            {subs.length ? subs.map((s) => (
              <span
                key={s}
                className="font-mono text-[9px] px-1.5 py-0.5 rounded-sm"
                style={{
                  background: "var(--surface2)",
                  color: "var(--text-muted)",
                  border: "1px solid var(--border)",
                }}
              >
                r/{s === "todayilearned" ? "TIL" : s}
              </span>
            )) : <span className="font-mono text-xs" style={{ color: "var(--text-dim)" }}>—</span>}
          </div>
        </div>

        <Stat label="Queries"       target={data?.query_count ?? 0}   note="5 categories"       delay={80}  />
        <Stat label="Results"       target={data?.result_count ?? 0}  note="Reddit posts"        delay={160} />
        <Stat label="Pair Records"  target={data?.pair_count ?? 0}    note="Overlap computed"    delay={240} />
        <Stat label="Empty Fetches" target={data?.failure_count ?? 0} note="Logged for analysis" delay={320} />
      </div>
    </section>
  );
}
