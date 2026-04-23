import { Bar, BarChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useApi } from "../hooks/useApi";
import { SubredditStats } from "../types";
import { compactSubreddit, valueFormatter } from "../utils/chart";
import { AsyncPanel } from "./Panel";

export function EngineStatsChart() {
  const { data, loading, error } = useApi<SubredditStats[]>("/engine-stats");
  const chartData = (data ?? []).map((row) => ({ ...row, label: compactSubreddit(row.engine) }));

  const tickStyle = { fill: "var(--text-dim)", fontFamily: "'JetBrains Mono', monospace", fontSize: 10 };
  const tooltipStyle = { background: "var(--surface2)", border: "1px solid var(--accent)", borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 };

  return (
    <AsyncPanel
      title="Subreddit Coverage Stats"
      subtitle="Snippet length and domain variety by community."
      loading={loading}
      error={error}
      empty={!data?.length}
    >
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData}>
          <XAxis dataKey="label" tick={tickStyle} />
          <YAxis yAxisId="left" tick={tickStyle} />
          <YAxis yAxisId="right" orientation="right" tick={tickStyle} />
          <Tooltip formatter={(value) => valueFormatter(value, 1)} contentStyle={tooltipStyle} />
          <Legend iconType="square" wrapperStyle={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10 }} />
          <Bar yAxisId="left" dataKey="avg_snippet_len" name="Avg Snippet Len" fill="#b39dff" radius={[2, 2, 0, 0]} fillOpacity={0.85} />
          <Bar yAxisId="right" dataKey="unique_domains" name="Unique Domains" fill="#7de0e0" radius={[2, 2, 0, 0]} fillOpacity={0.85} />
        </BarChart>
      </ResponsiveContainer>
    </AsyncPanel>
  );
}
