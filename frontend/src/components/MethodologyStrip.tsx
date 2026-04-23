const STEPS = [
  { step: "01", title: "Collect", detail: "Reddit JSON API · 150 queries" },
  { step: "02", title: "Store",   detail: "MongoDB · 7 collections" },
  { step: "03", title: "Measure", detail: "Jaccard · Spearman · RBO" },
  { step: "04", title: "Predict", detail: "GridSearchCV · 6 regressors" },
  { step: "05", title: "Present", detail: "FastAPI · React · Recharts" },
];

export function MethodologyStrip() {
  return (
    <section className="mx-auto max-w-7xl px-6 pt-6">
      <div
        className="flex items-stretch overflow-hidden"
        style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
      >
        {STEPS.map((item, i) => (
          <div
            key={item.step}
            className="flex flex-1 flex-col gap-1 px-4 py-3"
            style={{ borderRight: i < STEPS.length - 1 ? "1px solid var(--border)" : "none" }}
          >
            <div className="flex items-center gap-2">
              <span className="font-mono text-[9px] font-bold" style={{ color: "var(--accent)" }}>
                {item.step}
              </span>
              <span
                className="font-display font-bold text-xs uppercase tracking-wider"
                style={{ color: "var(--text)", fontVariationSettings: "'opsz' 14" }}
              >
                {item.title}
              </span>
            </div>
            <p className="font-mono text-[9px]" style={{ color: "var(--text-dim)" }}>
              {item.detail}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
