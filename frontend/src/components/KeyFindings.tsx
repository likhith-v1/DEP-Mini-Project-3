import { useApi } from "../hooks/useApi";
import { FetchFailure, ModelResult, OverlapMetric } from "../types";
import { pairLabel } from "../utils/chart";
import { jaccardAt10, modelScore } from "../utils/metrics";
import { AsyncPanel } from "./Panel";

function bestPair(overlaps: OverlapMetric[]) {
  const grouped = new Map<string, number[]>();
  overlaps.forEach((row) => {
    const key = `${row.engine_a}_${row.engine_b}`;
    grouped.set(key, [...(grouped.get(key) ?? []), jaccardAt10(row)]);
  });
  return [...grouped.entries()]
    .map(([pair, values]) => ({ pair, value: values.reduce((s, v) => s + v, 0) / values.length }))
    .sort((a, b) => b.value - a.value)[0];
}

function bestCategory(overlaps: OverlapMetric[]) {
  const grouped = new Map<string, number[]>();
  overlaps.forEach((row) => grouped.set(row.category, [...(grouped.get(row.category) ?? []), jaccardAt10(row)]));
  return [...grouped.entries()]
    .map(([category, values]) => ({ category, value: values.reduce((s, v) => s + v, 0) / values.length }))
    .sort((a, b) => b.value - a.value)[0];
}

function bestModel(models: ModelResult[]) {
  return [...models].sort((a, b) => modelScore(a) - modelScore(b))[0];
}

function worstFailure(failures: FetchFailure[]) {
  const grouped = failures.reduce((map, row) => {
    map.set(row.subreddit, (map.get(row.subreddit) ?? 0) + 1);
    return map;
  }, new Map<string, number>());
  return [...grouped.entries()].map(([subreddit, count]) => ({ subreddit, count })).sort((a, b) => b.count - a.count)[0];
}

export function KeyFindings() {
  const { data: overlaps, loading: overlapsLoading, error: overlapsError } = useApi<OverlapMetric[]>("/overlaps");
  const { data: models, loading: modelsLoading, error: modelsError } = useApi<ModelResult[]>("/model-eval");
  const { data: failures, loading: failuresLoading, error: failuresError } = useApi<FetchFailure[]>("/fetch-failures");
  const loading = overlapsLoading || modelsLoading || failuresLoading;
  const error = overlapsError ?? modelsError ?? failuresError;
  const topPair = bestPair(overlaps ?? []);
  const topCategory = bestCategory(overlaps ?? []);
  const model = bestModel(models ?? []);
  const failure = worstFailure(failures ?? []);

  const cards = [
    { num: "01", label: "Highest Overlap", value: topPair ? pairLabel(topPair.pair) : "—",
      detail: topPair ? `Mean Jaccard@10 = ${topPair.value.toFixed(4)}` : "No overlap data" },
    { num: "02", label: "Strongest Category", value: topCategory?.category ?? "—",
      detail: topCategory ? `Mean Jaccard@10 = ${topCategory.value.toFixed(4)}` : "No category data" },
    { num: "03", label: "Best Model", value: model?.model ?? "—",
      detail: model ? `${pairLabel(model.engine_pair)} · CV-MAE ${modelScore(model).toFixed(4)}` : "No model run" },
    { num: "04", label: "Sparsest Subreddit", value: failure ? `r/${failure.subreddit}` : "—",
      detail: failure ? `${failure.count} empty searches` : "No empty searches" },
  ];

  return (
    <section className="mx-auto max-w-7xl px-6">
      <AsyncPanel
        title="Key Findings"
        subtitle="Computed highlights from the latest analysis run."
        loading={loading}
        error={error}
        empty={!overlaps?.length && !models?.length}
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <div
              key={card.label}
              className="rounded-sm p-4"
              style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderLeft: "3px solid var(--accent)" }}
            >
              <p className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--accent)" }}>
                {card.num} · {card.label}
              </p>
              <p className="mt-2 font-display text-base font-bold leading-tight text-text-main">
                {card.value}
              </p>
              <p className="mt-2 font-body italic text-xs" style={{ color: "var(--accent2)" }}>
                {card.detail}
              </p>
            </div>
          ))}
        </div>
      </AsyncPanel>
    </section>
  );
}
