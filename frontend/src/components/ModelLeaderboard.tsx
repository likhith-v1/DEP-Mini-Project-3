import { useState } from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useApi } from "../hooks/useApi";
import { ModelResult } from "../types";
import { pairLabel, valueFormatter } from "../utils/chart";
import { modelScore } from "../utils/metrics";
import { AsyncPanel } from "./Panel";

const MODEL_COLORS: Record<string, string> = {
  linear:   "#1d4ed8",
  ridge:    "#7c3aed",
  rf:       "#c0392b",
  gbr:      "#15803d",
  svr:      "#b45309",
  baseline: "#a8998e",
};

export function ModelLeaderboard() {
  const { data, loading, error } = useApi<ModelResult[]>("/model-eval");
  const rows = data ?? [];
  const pairs = [...new Set(rows.map((d) => d.engine_pair))].filter(Boolean);
  const [selectedPair, setSelectedPair] = useState<string>("");

  const activePair = selectedPair || pairs[0] || "";
  const pairData = rows.filter((d) => d.engine_pair === activePair).sort((a, b) => modelScore(a) - modelScore(b));
  const bestScore = pairData[0] ? modelScore(pairData[0]) : undefined;

  const winners = pairs
    .map((pair) => rows.filter((d) => d.engine_pair === pair).sort((a, b) => modelScore(a) - modelScore(b))[0])
    .filter(Boolean)
    .sort((a, b) => modelScore(a) - modelScore(b))
    .slice(0, 5);

  const tickStyle = { fill: "var(--text-dim)", fontFamily: "'Space Mono', monospace", fontSize: 10 };

  const pairSelector = (
    <select
      value={activePair}
      onChange={(e) => setSelectedPair(e.target.value)}
      className="px-2 py-1 font-mono text-[10px] uppercase"
      style={{
        background: "var(--surface)",
        color: "var(--text)",
        border: "1px solid var(--border)",
        outline: "none",
        cursor: "pointer",
      }}
    >
      {pairs.map((p) => (
        <option key={p} value={p}>{pairLabel(p)}</option>
      ))}
    </select>
  );

  return (
    <AsyncPanel
      title="Model Leaderboard"
      subtitle="CV-MAE by model for selected subreddit pair. Lower = better."
      loading={loading}
      error={error}
      empty={!data?.length}
      headerRight={pairs.length > 1 ? pairSelector : undefined}
    >
      <ResponsiveContainer width="100%" height={130}>
        <BarChart data={pairData} layout="vertical">
          <XAxis type="number" tick={tickStyle} />
          <YAxis type="category" dataKey="model" tick={tickStyle} width={65} />
          <Tooltip
            formatter={(value) => valueFormatter(value, 4)}
            contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 2, fontFamily: "'Space Mono', monospace", fontSize: 11, color: "var(--text)" }}
          />
          <Bar dataKey="cv_mae" radius={[0, 3, 3, 0]}>
            {pairData.map((row) => (
              <Cell key={row.model} fill={MODEL_COLORS[row.model] ?? "#7de0e0"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <table className="mt-3 w-full text-xs">
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)" }}>
            <th className="pb-1 text-left font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--text-dim)" }}>Model</th>
            <th className="pb-1 font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--text-dim)" }}>CV-MAE</th>
            <th className="pb-1 font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--text-dim)" }}>RMSE</th>
            <th className="pb-1 font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--text-dim)" }}>R²</th>
          </tr>
        </thead>
        <tbody>
          {pairData.map((row) => (
            <tr key={row.model} style={modelScore(row) === bestScore ? { color: "var(--accent)" } : { color: "var(--text-dim)" }}>
              <td className="py-1 font-mono text-[11px]" style={{ borderLeft: modelScore(row) === bestScore ? "2px solid var(--accent)" : "2px solid transparent", paddingLeft: 6 }}>
                {row.model}
                {row.best_params && Object.keys(row.best_params).length > 0 && (
                  <span className="ml-2 text-[9px]" style={{ color: "var(--text-dim)" }} title={JSON.stringify(row.best_params)}>
                    ⚙
                  </span>
                )}
              </td>
              <td className="text-center font-mono">{modelScore(row).toFixed(4)}</td>
              <td className="text-center font-mono">{row.rmse.toFixed(4)}</td>
              <td className="text-center font-mono">{row.r2.toFixed(3)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--text-dim)" }}>
          Top 5 wins across all pairs
        </p>
        <div className="grid gap-1 text-xs">
          {winners.map((row) => (
            <div
              key={row.engine_pair}
              className="flex justify-between rounded-sm px-2 py-1"
              style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}
            >
              <span className="font-mono text-[10px]" style={{ color: "var(--text-dim)" }}>
                {pairLabel(row.engine_pair)} · {row.model}
              </span>
              <span className="font-mono text-[11px] text-text-main">{modelScore(row).toFixed(4)}</span>
            </div>
          ))}
        </div>
      </div>
    </AsyncPanel>
  );
}
