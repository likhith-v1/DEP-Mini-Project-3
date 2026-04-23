import { ModelResult, OverlapMetric } from "../types";

export function jaccardAt10(row: OverlapMetric) {
  return row.jaccard_10 ?? row.jaccard;
}

export function modelScore(row: ModelResult) {
  return row.cv_mae ?? row.mae;
}
