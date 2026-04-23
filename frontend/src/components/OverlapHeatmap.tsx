import { useApi } from "../hooks/useApi";
import { OverlapMetric } from "../types";
import { compactSubreddit } from "../utils/chart";
import { jaccardAt10 } from "../utils/metrics";
import { AsyncPanel } from "./Panel";

export function OverlapHeatmap() {
  const { data, loading, error } = useApi<OverlapMetric[]>("/overlaps");

  const rowsData = data ?? [];
  const subreddits = [...new Set(rowsData.flatMap((d) => [d.engine_a, d.engine_b]))].sort();
  const maxValue = Math.max(...rowsData.map((d) => jaccardAt10(d)), 0.001);

  const meanJaccard = (a: string, b: string) => {
    const rows = rowsData.filter((d) => (d.engine_a === a && d.engine_b === b) || (d.engine_a === b && d.engine_b === a));
    return rows.length ? rows.reduce((sum, d) => sum + jaccardAt10(d), 0) / rows.length : null;
  };

  return (
    <AsyncPanel
      title="Community Overlap Matrix"
      subtitle="Mean Jaccard@10 per pair — color scales to observed maximum."
      loading={loading}
      error={error}
      empty={!data?.length}
      className="h-full"
    >
      <div className="overflow-auto">
        <table className="w-full border-separate border-spacing-1 text-center text-xs">
          <thead>
            <tr>
              <th className="p-1" />
              {subreddits.map((s) => (
                <th key={s} className="p-1 font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--text-dim)" }}>
                  {compactSubreddit(s)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {subreddits.map((rowSub) => (
              <tr key={rowSub}>
                <td className="p-1 font-mono text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>
                  {compactSubreddit(rowSub)}
                </td>
                {subreddits.map((colSub) => {
                  if (rowSub === colSub) {
                    return (
                      <td key={colSub} className="rounded-sm p-2 font-mono text-[10px]" style={{ color: "var(--text-dim)", background: "var(--surface2)" }}>—</td>
                    );
                  }
                  const val = meanJaccard(rowSub, colSub);
                  const intensity = val != null ? val / maxValue : 0;
                  return (
                    <td
                      key={colSub}
                      className="rounded-sm p-2 font-mono text-[10px]"
                      style={{
                        background: `rgba(192, 57, 43, ${0.07 + intensity * 0.78})`,
                        color: intensity > 0.55 ? "#fff" : "var(--text)",
                      }}
                      title={`${rowSub} × ${colSub}: ${val?.toFixed(4) ?? "n/a"}`}
                    >
                      {val != null ? val.toFixed(3) : "n/a"}
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
