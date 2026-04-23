export interface Summary {
  run_id: string | null;
  generated_at: string | null;
  subreddits: string[];
  query_count: number;
  result_count: number;
  failure_count: number;
  pair_count: number;
}

export interface OverlapMetric {
  query_id: string;
  engine_a: string;
  engine_b: string;
  k: number;
  jaccard: number;
  jaccard_5?: number;
  jaccard_10?: number;
  spearman_rho: number | null;
  rbo: number;
  category: string;
}

export interface ModelResult {
  run_id: string;
  model: string;
  engine_pair: string;
  mae: number;
  rmse: number;
  r2: number;
  cv_mae?: number;
  best_params?: Record<string, unknown>;
  feature_importances?: Record<string, number>;
}

export interface OverlapSummary {
  sub_pair: string;
  mean_j10: number;
  ci_low_j10: number | null;
  ci_high_j10: number | null;
  n_queries: number;
}

export interface FailureRow {
  subreddit: string;
  [category: string]: number | string;
}

export interface Prediction {
  query_id: string;
  engine_pair: string;
  model: string;
  predicted_jaccard: number;
  actual_jaccard: number;
  category: string;
}

export interface SubredditStats {
  engine: string;
  subreddit?: string;
  avg_snippet_len: number;
  unique_domains: number;
  avg_results: number;
}

export interface FetchFailure {
  query_id: string;
  subreddit: string;
  error: string;
}
