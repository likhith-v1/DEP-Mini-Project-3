import { useState } from "react";
import { CategoryChart } from "./components/CategoryChart";
import { CategoryFilter, Category } from "./components/CategoryFilter";
import { DashboardFooter } from "./components/DashboardFooter";
import { DataQuality } from "./components/DataQuality";
import { EngineStatsChart } from "./components/EngineStats";
import { FailureHeatmap } from "./components/FailureHeatmap";
import { KeyFindings } from "./components/KeyFindings";
import { MethodologyStrip } from "./components/MethodologyStrip";
import { ModelLeaderboard } from "./components/ModelLeaderboard";
import { OverlapBarChart } from "./components/OverlapBarChart";
import { OverlapHeatmap } from "./components/OverlapHeatmap";
import { PredictionScatter } from "./components/PredictionScatter";
import { ProjectHero } from "./components/ProjectHero";
import { RboScatter } from "./components/RboScatter";
import { SpearmanChart } from "./components/SpearmanChart";
import { SummaryBar } from "./components/SummaryBar";
import { useApi } from "./hooks/useApi";
import { Summary } from "./types";

function SectionHeader({ num, title }: { num: string; title: string }) {
  return (
    <div className="flex items-center gap-4 py-3">
      <span
        className="font-display font-black shrink-0"
        style={{
          fontSize: "1.5rem",
          color: "var(--accent)",
          fontVariationSettings: "'opsz' 36",
          lineHeight: 1,
        }}
      >
        §{num}
      </span>
      <div className="section-rule" />
      <span
        className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] shrink-0"
        style={{ color: "var(--text-muted)" }}
      >
        {title}
      </span>
      <div style={{ width: 24, height: 1, background: "var(--rule)" }} />
    </div>
  );
}

export default function App() {
  const { data: summary } = useApi<Summary>("/summary");
  const [selectedCategory, setSelectedCategory] = useState<Category>("all");

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <ProjectHero summary={summary} />
      <MethodologyStrip />

      <div className="mx-auto max-w-7xl px-6">
        <SummaryBar />
      </div>

      <KeyFindings />

      <main className="mx-auto max-w-7xl space-y-10 px-6 pt-8 pb-6">

        {/* Category filter */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            padding: "0.75rem 1rem",
          }}
        >
          <CategoryFilter selected={selectedCategory} onChange={setSelectedCategory} />
        </div>

        {/* §01 — Community Overlap */}
        <section className="fade-up" style={{ animationDelay: "50ms" }}>
          <SectionHeader num="01" title="Community Overlap" />
          <div className="mt-3 grid grid-cols-1 gap-5 xl:grid-cols-[3fr_2fr]">
            <OverlapBarChart category={selectedCategory} />
            <OverlapHeatmap />
          </div>
        </section>

        {/* §02 — Query Analysis */}
        <section className="fade-up" style={{ animationDelay: "120ms" }}>
          <SectionHeader num="02" title="Query Analysis" />
          <div className="mt-3 grid grid-cols-1 gap-5 xl:grid-cols-2">
            <CategoryChart />
            <SpearmanChart />
          </div>
        </section>

        {/* §03 — Data Coverage */}
        <section className="fade-up" style={{ animationDelay: "190ms" }}>
          <SectionHeader num="03" title="Data Coverage" />
          <div className="mt-3 grid grid-cols-1 gap-5 xl:grid-cols-3">
            <RboScatter category={selectedCategory} />
            <EngineStatsChart />
            <DataQuality />
          </div>
          <div className="mt-5">
            <FailureHeatmap />
          </div>
        </section>

        {/* §04 — Prediction Models */}
        <section className="fade-up" style={{ animationDelay: "260ms" }}>
          <SectionHeader num="04" title="Prediction Models" />
          <div className="mt-3 grid grid-cols-1 gap-5 xl:grid-cols-2">
            <ModelLeaderboard />
            <PredictionScatter category={selectedCategory} />
          </div>
        </section>

      </main>

      <DashboardFooter />
    </div>
  );
}
