import { Bar, BarChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useApi } from "../hooks/useApi";
import { OverlapMetric } from "../types";
import { lowValueDomain, pairLabel, PAIR_COLORS, valueFormatter } from "../utils/chart";
import { jaccardAt10 } from "../utils/metrics";
import { AsyncPanel } from "./Panel";

export function CategoryChart() {
  const { data, loading, error } = useApi<OverlapMetric[]>("/overlaps");

  const rows = data ?? [];
  const categories = [...new Set(rows.map((d) => d.category))].sort();
  const pairScores = [...new Set(rows.map((d) => `${d.engine_a}_${d.engine_b}`))]
    .map((pair) => {
      const pairRows = rows.filter((d) => `${d.engine_a}_${d.engine_b}` === pair);
      return { pair, mean: pairRows.reduce((sum, d) => sum + jaccardAt10(d), 0) / pairRows.length };
    })
    .sort((a, b) => b.mean - a.mean)
    .slice(0, 5);
  const pairs = pairScores.map((row) => row.pair);
  const chartData = categories.map((category) => {
    const row: Record<string, string | number> = { category };
    pairs.forEach((pair) => {
      const categoryRows = rows.filter((d) => d.category === category && `${d.engine_a}_${d.engine_b}` === pair);
      row[pair] = categoryRows.length ? categoryRows.reduce((sum, d) => sum + jaccardAt10(d), 0) / categoryRows.length : 0;
    });
    return row;
  });
  const domain = lowValueDomain(chartData.flatMap((row) => pairs.map((pair) => Number(row[pair] ?? 0))));
  const tickStyle = { fill: "var(--text-dim)", fontFamily: "'JetBrains Mono', monospace", fontSize: 10 };
  const tooltipStyle = { background: "var(--surface2)", border: "1px solid var(--accent)", borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 };

  return (
    <AsyncPanel
      title="Jaccard@10 by Query Category"
      subtitle="Top 5 subreddit pairs ranked by mean overlap."
      loading={loading}
      error={error}
      empty={!data?.length}
    >
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData}>
          <XAxis dataKey="category" tick={tickStyle} />
          <YAxis domain={domain} tick={tickStyle} tickFormatter={(v) => Number(v).toFixed(3)} />
          <Tooltip formatter={(value) => valueFormatter(value)} contentStyle={tooltipStyle} />
          <Legend iconType="square" wrapperStyle={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10 }} />
          {pairs.map((pair, index) => (
            <Bar key={pair} dataKey={pair} name={pairLabel(pair)} fill={PAIR_COLORS[index % PAIR_COLORS.length]} radius={[2, 2, 0, 0]} fillOpacity={0.85} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </AsyncPanel>
  );
}
