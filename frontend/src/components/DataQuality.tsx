import { useApi } from "../hooks/useApi";
import { FetchFailure } from "../types";
import { compactSubreddit } from "../utils/chart";
import { AsyncPanel } from "./Panel";

export function DataQuality() {
  const { data, loading, error } = useApi<FetchFailure[]>("/fetch-failures");
  const failures = data ?? [];
  const bySubreddit = [...failures.reduce((map, failure) => {
    map.set(failure.subreddit, (map.get(failure.subreddit) ?? 0) + 1);
    return map;
  }, new Map<string, number>())]
    .map(([subreddit, count]) => ({ subreddit, count }))
    .sort((a, b) => b.count - a.count);
  const worst = bySubreddit[0];

  return (
    <AsyncPanel
      title="Data Quality"
      subtitle="Subreddit searches returning no posts — tracked for transparency."
      loading={loading}
      error={error}
      empty={false}
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-sm p-3" style={{ background: "var(--surface2)", borderLeft: "3px solid var(--accent)" }}>
          <p className="font-display text-3xl font-black" style={{ color: "var(--accent)" }}>{failures.length}</p>
          <p className="font-mono text-[10px] uppercase tracking-wider" style={{ color: "var(--text-dim)" }}>Empty searches</p>
        </div>
        <div className="rounded-sm p-3" style={{ background: "var(--surface2)", borderLeft: "3px solid var(--accent2)" }}>
          <p className="font-display text-3xl font-black" style={{ color: "var(--accent2)" }}>
            {worst ? compactSubreddit(worst.subreddit) : "—"}
          </p>
          <p className="font-mono text-[10px] uppercase tracking-wider" style={{ color: "var(--text-dim)" }}>Most affected</p>
        </div>
      </div>
      <div className="mt-3 grid gap-1">
        {bySubreddit.map((row) => (
          <div
            key={row.subreddit}
            className="flex items-center justify-between rounded-sm px-2 py-1"
            style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}
          >
            <span className="font-mono text-[11px]" style={{ color: "var(--text-dim)" }}>r/{row.subreddit}</span>
            <span className="font-mono text-xs text-text-main">{row.count}</span>
          </div>
        ))}
      </div>
    </AsyncPanel>
  );
}
