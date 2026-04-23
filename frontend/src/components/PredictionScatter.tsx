import { Legend, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";
import { useApi } from "../hooks/useApi";
import { ModelResult, Prediction } from "../types";
import { CATEGORY_COLORS, lowValueDomain, valueFormatter } from "../utils/chart";
import { modelScore } from "../utils/metrics";
import { AsyncPanel } from "./Panel";

interface Props { category?: string; }

export function PredictionScatter({ category = "all" }: Props) {
  const { data: preds, loading: predsLoading, error: predsError } = useApi<Prediction[]>("/predictions");
  const { data: results, loading: resultsLoading, error: resultsError } = useApi<ModelResult[]>("/model-eval");

  const bestModel = [...(results ?? [])].sort((a, b) => modelScore(a) - modelScore(b))[0]?.model;
  const filtered = (preds ?? [])
    .filter((p) => p.model === bestModel && p.actual_jaccard != null)
    .filter((p) => category === "all" || p.category === category);
  const categories = [...new Set(filtered.map((p) => p.category))];
  const domain = lowValueDomain(filtered.flatMap((p) => [p.actual_jaccard, p.predicted_jaccard]));

  const tickStyle = { fill: "var(--text-dim)", fontFamily: "'JetBrains Mono', monospace", fontSize: 10 };
  const tooltipStyle = { background: "var(--surface2)", border: "1px solid var(--accent)", borderRadius: 2, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 };

  return (
    <AsyncPanel
      title={`Predicted vs Actual Jaccard — ${bestModel ?? "…"}`}
      subtitle="Best model predictions. Perfect prediction lies on the diagonal."
      loading={predsLoading || resultsLoading}
      error={predsError ?? resultsError}
      empty={!preds?.length || !results?.length || !filtered.length}
    >
      <ResponsiveContainer width="100%" height={220}>
        <ScatterChart>
          <XAxis dataKey="actual_jaccard" name="Actual" type="number" domain={domain} tick={tickStyle} tickFormatter={(v) => Number(v).toFixed(3)} />
          <YAxis dataKey="predicted_jaccard" name="Predicted" type="number" domain={domain} tick={tickStyle} tickFormatter={(v) => Number(v).toFixed(3)} />
          <Tooltip formatter={(value) => valueFormatter(value)} contentStyle={tooltipStyle} />
          <Legend iconType="circle" wrapperStyle={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10 }} />
          {categories.map((cat) => (
            <Scatter
              key={cat}
              name={cat}
              data={filtered.filter((p) => p.category === cat).map((p) => ({
                actual_jaccard: p.actual_jaccard,
                predicted_jaccard: p.predicted_jaccard,
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
