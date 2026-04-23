export const CATEGORY_COLORS: Record<string, string> = {
  tech:    "#c0392b",
  news:    "#1d4ed8",
  health:  "#15803d",
  howto:   "#b45309",
  science: "#7c3aed",
};

export const PAIR_COLORS = [
  "#c0392b",
  "#1d4ed8",
  "#15803d",
  "#b45309",
  "#7c3aed",
  "#0e7490",
  "#be185d",
  "#92400e",
  "#1e40af",
  "#065f46",
];

export function pairLabel(pair: string) {
  return pair
    .replace(/ \/ /g, "_")
    .split("_")
    .map((part: string) => `r/${part}`)
    .join(" + ");
}

export function compactSubreddit(name: string) {
  return name === "todayilearned" ? "TIL" : name;
}

export function lowValueDomain(values: number[], minUpper = 0.02): [number, number] {
  const max = Math.max(...values.filter(Number.isFinite), 0);
  return [0, Math.min(1, Math.max(minUpper, max * 1.25))];
}

export function valueFormatter(value: unknown, digits = 3) {
  return Number(value ?? 0).toFixed(digits);
}
