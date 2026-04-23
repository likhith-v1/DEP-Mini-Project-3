import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useApi } from "../hooks/useApi";
import { OverlapMetric } from "../types";
import { lowValueDomain, pairLabel, PAIR_COLORS, valueFormatter } from "../utils/chart";
import { jaccardAt10 } from "../utils/metrics";
import { AsyncPanel } from "./Panel";

interface Props { category?: string; }

export function OverlapBarChart({ category = "all" }: Props) {
  const { data, loading, error } = useApi<OverlapMetric[]>("/overlaps");

  const filtered = (data ?? []).filter((d) => category === "all" || d.category === category);
  const pairMap: Record<string, number[]> = {};
  filtered.forEach((d) => {
    const key = `${d.engine_a}_${d.engine_b}`;
    pairMap[key] = [...(pairMap[key] ?? []), jaccardAt10(d)];
  });
  const chartData = Object.entries(pairMap)
    .map(([pair, vals]) => ({
      pair,
      label: pairLabel(pair),
      jaccard: vals.reduce((a, b) => a + b, 0) / vals.length,
    }))
    .sort((a, b) => b.jaccard - a.jaccard);
  const domain = lowValueDomain(chartData.map((row) => row.jaccard));
  const topPair = chartData[0]?.pair;

  const tickStyle = { fill: "var(--text-dim)", fontFamily: "'Space Mono', monospace", fontSize: 9 };

  return (
    <AsyncPanel
      title="Mean Jaccard@10 per Subreddit Pair"
      subtitle="Mean Jaccard@10 across all queries — ranked by community similarity."
      loading={loading}
      error={error}
      empty={!data?.length}
      className="h-full"
    >
      <ResponsiveContainer width="100%" height={300}>
        <BarChart layout="vertical" data={chartData}>
          <XAxis type="number" domain={domain} tick={tickStyle} tickFormatter={(v) => Number(v).toFixed(3)} />
          <YAxis type="category" dataKey="label" tick={{ ...tickStyle, fontSize: 10 }} width={160} />
          <Tooltip
            formatter={(value) => valueFormatter(value)}
            contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 0, fontFamily: "'Space Mono', monospace", fontSize: 11, color: "var(--text)", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
            cursor={{ fill: "rgba(192,57,43,0.04)" }}
          />
          <Bar dataKey="jaccard" radius={[0, 3, 3, 0]}>
            {chartData.map((row, i) => (
              <Cell
                key={i}
                fill={row.pair === topPair ? "#ff8c00" : PAIR_COLORS[i % PAIR_COLORS.length]}
                fillOpacity={row.pair === topPair ? 1 : 0.65}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-2 grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
        {chartData.slice(0, 4).map((row, i) => (
          <div
            key={row.pair}
            className="flex justify-between rounded-sm px-2 py-1"
            style={{ background: "var(--surface2)", borderLeft: i === 0 ? "2px solid var(--accent)" : "2px solid transparent" }}
          >
            <span className="font-mono text-[11px]" style={{ color: "var(--text-dim)" }}>{row.label}</span>
            <span className="font-mono text-[11px] text-text-main">{row.jaccard.toFixed(4)}</span>
          </div>
        ))}
      </div>
    </AsyncPanel>
  );
}
