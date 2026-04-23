import { Summary } from "../types";

interface Props { summary: Summary | null; }

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

export function ProjectHero({ summary }: Props) {
  return (
    <header style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
      {/* Thin crimson top stripe */}
      <div style={{ height: 4, background: "var(--accent)" }} />

      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">

          {/* ── Left: masthead ── */}
          <div className="flex-1">
            {/* Overline */}
            <div className="flex items-center gap-3 mb-4">
              <span
                className="font-mono text-[10px] uppercase tracking-[0.35em]"
                style={{ color: "var(--accent)" }}
              >
                Data Engineering &amp; Processing
              </span>
              <div style={{ flex: 1, height: 1, background: "var(--rule)", maxWidth: 80 }} />
              <span
                className="font-mono text-[10px] tracking-wider"
                style={{ color: "var(--text-dim)" }}
              >
                Mini-Project III
              </span>
            </div>

            {/* Big title */}
            <h1
              className="font-display font-black leading-[0.9] tracking-tight"
              style={{
                fontSize: "clamp(3rem, 8vw, 6rem)",
                color: "var(--text)",
                fontVariationSettings: "'opsz' 72",
              }}
            >
              Reddit
              <br />
              <span style={{ color: "var(--accent)" }}>Overlap</span>
              <br />
              Analysis
            </h1>

            {/* Divider rule */}
            <div className="my-5 flex items-center gap-3">
              <div style={{ width: 32, height: 2, background: "var(--accent)" }} />
              <div style={{ flex: 1, height: 1, background: "var(--border)", maxWidth: 200 }} />
            </div>

            {/* Subtitle */}
            <p
              className="font-body italic leading-relaxed max-w-lg"
              style={{ fontSize: "0.95rem", color: "var(--text-muted)" }}
            >
              Comparing top-50 Reddit posts across 14 subreddits for 150 curated queries.
              Measuring URL overlap with Jaccard, Spearman &amp; RBO. Predicting community
              agreement with six regression models.
            </p>

            {/* Author line */}
            <p
              className="mt-4 font-mono text-xs"
              style={{ color: "var(--text-dim)", letterSpacing: "0.05em" }}
            >
              Likhith V &nbsp;·&nbsp; 23BTRCL257 &nbsp;·&nbsp; AIML-D &nbsp;·&nbsp; JAIN University
            </p>
          </div>

          {/* ── Right: run card ── */}
          <div
            className="shrink-0 lg:w-64"
            style={{
              border: "1px solid var(--border)",
              borderLeft: "3px solid var(--accent)",
              background: "var(--surface2)",
              padding: "1.25rem",
            }}
          >
            <p
              className="font-mono text-[9px] uppercase tracking-[0.3em] mb-3"
              style={{ color: "var(--text-dim)" }}
            >
              Run Metadata
            </p>
            <div className="space-y-3">
              {[
                { label: "Run ID",    value: summary?.run_id ? summary.run_id.slice(0, 8) + "…" : "—" },
                { label: "Generated", value: formatDate(summary?.generated_at) },
                { label: "Subreddits",value: String(summary?.subreddits?.length ?? "—") },
                { label: "Pairs",     value: summary?.pair_count != null ? String(summary.pair_count) : "—" },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="font-mono text-[9px] uppercase tracking-widest" style={{ color: "var(--text-dim)" }}>
                    {label}
                  </p>
                  <p className="font-mono text-xs mt-0.5 font-bold" style={{ color: "var(--text)" }}>
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </header>
  );
}
