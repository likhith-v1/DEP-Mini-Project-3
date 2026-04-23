import { useApi } from "../hooks/useApi";
import { FailureRow } from "../types";
import { AsyncPanel } from "./Panel";

const SUBREDDITS = ["science", "technology", "worldnews", "news", "todayilearned", "askscience", "programming", "explainlikeimfive", "Futurology", "environment", "learnprogramming", "datascience", "economics", "history"];
const CATEGORIES = ["tech", "news", "health", "howto", "science"];

export function FailureHeatmap() {
  const { data, loading, error } = useApi<FailureRow[]>("/failure-analysis");
  const rows = data ?? [];

  const lookup = new Map<string, Map<string, number>>();
  rows.forEach((row) => {
    const m = new Map<string, number>();
    CATEGORIES.forEach((c) => m.set(c, Number(row[c] ?? 0)));
    lookup.set(row.subreddit, m);
  });

  const maxVal = Math.max(
    ...SUBREDDITS.flatMap((s) => CATEGORIES.map((c) => lookup.get(s)?.get(c) ?? 0)),
    1
  );

  return (
    <AsyncPanel
      title="Fetch Failure Heatmap"
      subtitle="Empty API responses by subreddit × query category. Darker = more failures."
      loading={loading}
      error={error}
      empty={!data?.length}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="pb-2 text-left font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--text-dim)" }}>
                Subreddit
              </th>
              {CATEGORIES.map((c) => (
                <th key={c} className="pb-2 text-center font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--text-dim)" }}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SUBREDDITS.map((sub) => (
              <tr key={sub}>
                <td className="py-1 pr-3 font-mono text-[11px]" style={{ color: "var(--accent2)" }}>
                  r/{sub === "todayilearned" ? "TIL" : sub}
                </td>
                {CATEGORIES.map((cat) => {
                  const val = lookup.get(sub)?.get(cat) ?? 0;
                  const intensity = val / maxVal;
                  return (
                    <td key={cat} className="py-1 text-center">
                      <div
                        className="mx-auto flex h-7 w-10 items-center justify-center rounded-sm font-mono text-[10px] font-bold transition-colors"
                        style={{
                          background: val === 0
                            ? "var(--surface2)"
                            : `rgba(192, 57, 43, ${0.10 + intensity * 0.75})`,
                          color: intensity > 0.55 ? "#fff" : val === 0 ? "var(--text-dim)" : "var(--text)",
                          border: "1px solid var(--border)",
                        }}
                        title={`${sub} × ${cat}: ${val} failures`}
                      >
                        {val}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AsyncPanel>
  );
}
