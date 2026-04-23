import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useApi } from "../hooks/useApi";
import { OverlapMetric } from "../types";
import { pairLabel, PAIR_COLORS, valueFormatter } from "../utils/chart";
import { AsyncPanel } from "./Panel";

export function SpearmanChart() {
  const { data, loading, error } = useApi<OverlapMetric[]>("/overlaps");

  const pairMap: Record<string, number[]> = {};
  (data ?? []).filter((d) => d.spearman_rho != null).forEach((d) => {
    const key = `${d.engine_a}_${d.engine_b}`;
    pairMap[key] = [...(pairMap[key] ?? []), d.spearman_rho as number];
  });
  const chartData = Object.entries(pairMap).map(([pair, vals], i) => ({
    pair,
    label: pairLabel(pair),
    mean: vals.reduce((a, b) => a + b, 0) / vals.length,
    color: PAIR_COLORS[i % PAIR_COLORS.length],
  }));

  const tickStyle = { fill: "var(--text-dim)", fontFamily: "'JetBrains Mono', monospace", fontSize: 10 };
  const tooltipStyle = { background: "var(--surface2)", border: "1px solid var(--accent)", borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 };

  return (
    <AsyncPanel
      title="Spearman Rho per Subreddit Pair"
      subtitle="Rank correlation — only computed when ≥3 URLs are shared."
      loading={loading}
      error={error}
      empty={!data?.length || !chartData.length}
      emptyMessage={!data?.length ? undefined : "Too few shared URLs for Spearman rank correlation."}
    >
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData}>
          <XAxis dataKey="label" tick={tickStyle} />
          <YAxis domain={[-1, 1]} tick={tickStyle} />
          <Tooltip formatter={(value) => valueFormatter(value)} contentStyle={tooltipStyle} />
          <Bar dataKey="mean" radius={[2, 2, 0, 0]}>
            {chartData.map((row) => (
              <Cell key={row.pair} fill={row.color} fillOpacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </AsyncPanel>
  );
}
