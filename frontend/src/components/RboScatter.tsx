import { Legend, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";
import { useApi } from "../hooks/useApi";
import { OverlapMetric } from "../types";
import { CATEGORY_COLORS, lowValueDomain, valueFormatter } from "../utils/chart";
import { jaccardAt10 } from "../utils/metrics";
import { AsyncPanel } from "./Panel";

interface Props { category?: string; }

export function RboScatter({ category = "all" }: Props) {
  const { data, loading, error } = useApi<OverlapMetric[]>("/overlaps");

  const rows = (data ?? []).filter((d) => category === "all" || d.category === category);
  const categories = [...new Set(rows.map((d) => d.category))];
  const xDomain = lowValueDomain(rows.map((d) => jaccardAt10(d)));
  const yDomain = lowValueDomain(rows.map((d) => d.rbo));

  const tickStyle = { fill: "var(--text-dim)", fontFamily: "'JetBrains Mono', monospace", fontSize: 10 };
  const tooltipStyle = { background: "var(--surface2)", border: "1px solid var(--accent)", borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 };

  return (
    <AsyncPanel
      title="RBO vs Jaccard@10"
      subtitle="Both metrics measure overlap — strong positive correlation expected."
      loading={loading}
      error={error}
      empty={!data?.length}
    >
      <ResponsiveContainer width="100%" height={220}>
        <ScatterChart>
          <XAxis dataKey="jaccard" name="Jaccard" type="number" domain={xDomain} tick={tickStyle} tickFormatter={(v) => Number(v).toFixed(3)} />
          <YAxis dataKey="rbo" name="RBO" type="number" domain={yDomain} tick={tickStyle} tickFormatter={(v) => Number(v).toFixed(3)} />
          <Tooltip formatter={(value) => valueFormatter(value)} contentStyle={tooltipStyle} />
          <Legend iconType="circle" wrapperStyle={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10 }} />
          {categories.map((cat) => (
            <Scatter
              key={cat}
              name={cat}
              data={rows.filter((d) => d.category === cat).map((d, idx) => ({
                jaccard: jaccardAt10(d) + (idx % 3) * 0.00015,
                rbo: d.rbo + (idx % 4) * 0.00015,
              }))}
              fill={CATEGORY_COLORS[cat] ?? "#b39dff"}
              fillOpacity={0.75}
            />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </AsyncPanel>
  );
}
