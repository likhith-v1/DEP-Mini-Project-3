const CATEGORIES = ["all", "tech", "news", "health", "howto", "science"] as const;
export type Category = (typeof CATEGORIES)[number];

interface Props {
  selected: Category;
  onChange: (cat: Category) => void;
}

const CAT_COLORS: Record<string, string> = {
  all:     "#1c1917",
  tech:    "#c0392b",
  news:    "#1d4ed8",
  health:  "#15803d",
  howto:   "#b45309",
  science: "#7c3aed",
};

export function CategoryFilter({ selected, onChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className="font-mono text-[9px] uppercase tracking-[0.3em] mr-1"
        style={{ color: "var(--text-dim)" }}
      >
        Filter by category
      </span>
      {CATEGORIES.map((cat) => {
        const active = selected === cat;
        const color = CAT_COLORS[cat] ?? "#1c1917";
        return (
          <button
            key={cat}
            onClick={() => onChange(cat)}
            className="font-mono text-[10px] uppercase tracking-wider transition-all"
            style={{
              padding: "3px 10px",
              background: active ? color : "transparent",
              color: active ? "#fff" : color,
              border: `1px solid ${color}`,
              fontWeight: active ? 700 : 400,
              opacity: active ? 1 : 0.65,
              cursor: "pointer",
            }}
          >
            {cat}
          </button>
        );
      })}
    </div>
  );
}
