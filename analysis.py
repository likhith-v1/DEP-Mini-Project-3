"""
Reddit Multi-Community Trend Analysis
"""

import glob
import itertools
import json
import os
import sys
import time
import uuid
from datetime import datetime, timezone
from urllib.parse import urlparse

import numpy as np
import pandas as pd
import plotly.graph_objects as go
import requests
import scipy.stats as stats
from dotenv import load_dotenv
from plotly.subplots import make_subplots
from sklearn.base import clone
from sklearn.dummy import DummyRegressor
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.inspection import permutation_importance as sk_perm_imp
from sklearn.linear_model import LinearRegression, Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import cross_val_score, GridSearchCV, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import LabelEncoder
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVR

from db import count, ensure_indexes, get_client, get_db, load_df, upsert_many

# CONFIG

load_dotenv()

TOP_K = int(os.getenv("TOP_K", 50))
DB_NAME = os.getenv("MONGO_DB", "reddit_trend_analysis")
PLOTS_DIR = "plots"
os.makedirs(PLOTS_DIR, exist_ok=True)

SUBREDDITS = [
    "science", "technology", "worldnews", "news", "todayilearned",
    "askscience", "programming",
    "explainlikeimfive", "Futurology", "environment", "learnprogramming",
    "datascience", "economics", "history",
]
SUB_COLORS = {
    "science":          "#00CC96",
    "technology":       "#636EFA",
    "worldnews":        "#EF553B",
    "news":             "#AB63FA",
    "todayilearned":    "#FFA15A",
    "askscience":       "#19D3F3",
    "programming":      "#FF6692",
    "worldpolitics":    "#B6E880",
    "explainlikeimfive":"#FF97FF",
    "Futurology":       "#FECB52",
    "environment":      "#72efdd",
    "learnprogramming": "#f72585",
    "datascience":      "#4cc9f0",
    "economics":        "#f77f00",
    "history":          "#c77dff",
}
PAIR_COLORS = ["#636EFA", "#EF553B", "#00CC96", "#AB63FA", "#FFA15A",
               "#19D3F3", "#FF6692", "#B6E880", "#FF97FF", "#FECB52"]
FORCE_REFRESH = "--force-refresh" in sys.argv
FAILURES: list[dict] = []
RETRIES = 0


# DATA COLLECTION

_REDDIT_BASE = "https://www.reddit.com"
_REDDIT_HEADERS = {"User-Agent": "reddit-multi-community-trend-analysis/1.0 (academic)"}

def load_queries(path: str) -> list[dict]:
    with open(path, "r", encoding="utf-8") as f:
        grouped = json.load(f)
    queries = []
    for category, items in grouped.items():
        for i, text in enumerate(items, 1):
            queries.append({
                "query_id": f"{category}_{i:02d}",
                "text": text,
                "category": category,
            })
    return queries


def _ranked(items: list[dict]) -> list[dict]:
    rows = []
    for i, item in enumerate(items[:TOP_K], 1):
        rows.append({
            "rank": i,
            "url": item.get("url", ""),
            "title": item.get("title", ""),
            "snippet": item.get("snippet", ""),
        })
    return rows


def fetch_reddit(subreddit: str, query: str, k: int) -> list[dict]:
    """Fetch top-k posts from subreddit matching query via Reddit JSON API."""
    url = f"{_REDDIT_BASE}/r/{subreddit}/search.json"
    params = {"q": query, "sort": "relevance", "limit": k, "restrict_sr": 1, "type": "link"}
    for attempt in range(3):
        try:
            r = requests.get(url, params=params, headers=_REDDIT_HEADERS, timeout=15)
            if r.status_code == 429:
                time.sleep(10 + attempt * 5)
                continue
            r.raise_for_status()
            children = r.json().get("data", {}).get("children", [])
            time.sleep(1.5)
            return _ranked([
                {
                    "url": child["data"].get("url", ""),
                    "title": child["data"].get("title", ""),
                    "snippet": (child["data"].get("selftext", "") or "")[:300],
                }
                for child in children
                if child.get("data", {}).get("url")
            ])
        except Exception:
            if attempt < 2:
                time.sleep(5 + attempt * 3)
            else:
                raise
    return []


def fetch_all_subreddits(query_id: str, query_text: str, db) -> None:
    global RETRIES
    for subreddit in SUBREDDITS:
        cached = db.raw_results.count_documents({"query_id": query_id, "subreddit": subreddit}) > 0
        failed = db.fetch_failures.count_documents({"query_id": query_id, "subreddit": subreddit}) > 0
        if not FORCE_REFRESH and (cached or failed):
            continue
        docs = []
        last_error = None
        for attempt in range(3):
            try:
                docs = fetch_reddit(subreddit, query_text, TOP_K)
                if not docs:
                    last_error = RuntimeError("empty result set")
                    break
                break
            except Exception as exc:
                last_error = exc
                RETRIES += 1
                time.sleep(5 + attempt * 3)
        if not docs:
            failure = {
                "query_id": query_id,
                "subreddit": subreddit,
                "error": str(last_error),
                "fetched_at": datetime.now(timezone.utc),
            }
            FAILURES.append(failure)
            upsert_many(db.fetch_failures, [failure], ["query_id", "subreddit"])
            print(f"Fetch failed: {query_id} r/{subreddit}: {last_error}")
            continue
        now = datetime.now(timezone.utc)
        enriched = [
            {**doc, "query_id": query_id, "subreddit": subreddit, "fetched_at": now}
            for doc in docs
            if doc.get("url")
        ]
        upsert_many(db.raw_results, enriched, ["query_id", "subreddit", "rank"])


# URL NORMALIZATION

def normalize_url(url: str) -> str:
    p = urlparse(str(url).lower().rstrip("/"))
    host = p.netloc.removeprefix("www.")
    return f"{host}{p.path}"


def subreddit_pairs() -> list[tuple[str, str]]:
    if len(SUBREDDITS) == 1:
        return [(SUBREDDITS[0], SUBREDDITS[0])]
    return [tuple(sorted(pair)) for pair in itertools.combinations(SUBREDDITS, 2)]


# OVERLAP METRICS

def jaccard(urls_a: list[str], urls_b: list[str], k: int) -> float:
    a = {normalize_url(u) for u in urls_a[:k]}
    b = {normalize_url(u) for u in urls_b[:k]}
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def spearman_rho(urls_a: list[str], urls_b: list[str]) -> float:
    """Compute Spearman rank correlation for shared URLs.
    
    Ranks are computed in original list positions, then filtered by shared URLs.
    Returns NaN if fewer than 3 shared URLs.
    """
    a = [normalize_url(u) for u in urls_a]
    b = [normalize_url(u) for u in urls_b]
    rank_b = {url: i+1 for i, url in enumerate(b)}
    
    # Collect ranks of shared URLs in their original positions
    shared_ranks = [(i+1, rank_b[url]) for i, url in enumerate(a) if url in rank_b]
    
    if len(shared_ranks) < 3:
        return float("nan")
    
    ranks_a, ranks_b = zip(*shared_ranks)
    return float(stats.spearmanr(ranks_a, ranks_b).statistic)


def rbo_score(l1: list[str], l2: list[str], p: float = 0.9) -> float:
    """Compute Rank-Biased Overlap (RBO) with extrapolation.
    
    Standard RBO formula with tail extrapolation for partial lists.
    Assumes lists are pre-normalized.
    """
    l1 = [normalize_url(u) for u in l1]
    l2 = [normalize_url(u) for u in l2]
    depth = min(len(l1), len(l2))
    if depth == 0:
        return 0.0
    
    score = 0.0
    for i in range(1, depth + 1):
        overlap = len(set(l1[:i]) & set(l2[:i])) / i
        score += overlap * (p ** (i - 1))
    
    # Tail extrapolation if lists have different lengths
    if len(l1) != len(l2):
        longer = l1 if len(l1) > len(l2) else l2
        shorter_set = set(l2) if len(l1) > len(l2) else set(l1)
        tail_overlap = len(set(longer[depth:]) & shorter_set) / max(1, len(longer) - depth)
        score += tail_overlap * (p ** depth)
    
    return float((1 - p) * score)


def compute_all_overlaps(query_id: str, db) -> None:
    df = load_df(db.raw_results, {"query_id": query_id})
    if df.empty:
        return
    docs = []
    for sub_a, sub_b in subreddit_pairs():
        urls_a = df[df["subreddit"] == sub_a].sort_values("rank")["url"].tolist()
        urls_b = df[df["subreddit"] == sub_b].sort_values("rank")["url"].tolist()
        if not urls_a or not urls_b:
            continue
        pair = tuple(sorted((sub_a, sub_b)))
        docs.append({
            "query_id": query_id,
            "sub_a": pair[0],
            "sub_b": pair[1],
            "k": TOP_K,
            "jaccard_5": jaccard(urls_a, urls_b, 5),
            "jaccard_10": jaccard(urls_a, urls_b, 10),
            "jaccard": jaccard(urls_a, urls_b, TOP_K),
            "spearman_rho": spearman_rho(urls_a, urls_b),
            "rbo": rbo_score(urls_a, urls_b),
            "computed_at": datetime.now(timezone.utc),
        })
    upsert_many(db.overlap_metrics, docs, ["query_id", "sub_a", "sub_b", "k"])


# BOOTSTRAP CI

def bootstrap_ci(values: list[float], n_boot: int = 500, ci: float = 95.0) -> tuple[float, float]:
    arr = np.array([v for v in values if np.isfinite(v)], dtype=float)
    if len(arr) < 2:
        return (float("nan"), float("nan"))
    rng = np.random.default_rng(42)
    boot_means = np.array([rng.choice(arr, len(arr), replace=True).mean() for _ in range(n_boot)])
    lo = (100 - ci) / 2
    return (float(np.percentile(boot_means, lo)), float(np.percentile(boot_means, 100 - lo)))


def compute_overlap_summary(db, run_id: str) -> None:
    """Compute per-pair mean Jaccard@10 with 95% bootstrap CIs; store in overlap_summary."""
    metrics = load_df(db.overlap_metrics, {"k": TOP_K})
    if metrics.empty:
        return
    metrics["sub_pair"] = metrics.apply(lambda r: "_".join(sorted([r["sub_a"], r["sub_b"]])), axis=1)
    docs = []
    for sub_pair, g in metrics.groupby("sub_pair"):
        vals = g["jaccard_10"].dropna().tolist()
        ci_lo, ci_hi = bootstrap_ci(vals)
        docs.append({
            "run_id": run_id,
            "sub_pair": sub_pair,
            "mean_j10": float(np.mean(vals)) if vals else 0.0,
            "ci_low_j10": ci_lo,
            "ci_high_j10": ci_hi,
            "n_queries": len(vals),
        })
    db.overlap_summary.delete_many({})
    upsert_many(db.overlap_summary, docs, ["run_id", "sub_pair"])


# FEATURE ENGINEERING

QUESTION_WORDS = {"what", "how", "why", "when", "where", "which", "who", "is", "are", "can", "does", "will"}


def is_navigational_query(text: str) -> bool:
    words = text.split()
    has_properish = any(token[:1].isupper() for token in text.split()[1:])
    return len(words) == 1 or has_properish


def engineer_query_features(db) -> pd.DataFrame:
    queries = load_df(db.queries)
    metrics = load_df(db.overlap_metrics)
    if queries.empty or metrics.empty:
        return pd.DataFrame()
    encoder = LabelEncoder()
    queries["category_enc"] = encoder.fit_transform(queries["category"])
    queries["query_len"] = queries["text"].str.len()
    queries["word_count"] = queries["text"].str.split().str.len()
    queries["has_question"] = queries["text"].str.lower().str.split().str[0].isin(QUESTION_WORDS).astype(int)
    queries["is_navigational"] = queries["text"].apply(is_navigational_query).astype(int)
    queries["avg_word_len"] = queries["text"].apply(
        lambda t: float(np.mean([len(w) for w in t.split()])) if t.split() else 0.0
    )
    queries["has_number"] = queries["text"].str.contains(r"\d", regex=True).astype(int)
    queries["unique_char_ratio"] = queries["text"].apply(
        lambda t: len(set(t.replace(" ", ""))) / max(len(t.replace(" ", "")), 1)
    )
    metrics["sub_pair"] = metrics.apply(lambda r: "_".join(sorted([r["sub_a"], r["sub_b"]])), axis=1)
    feat_cols = ["query_id", "text", "category", "category_enc", "query_len", "word_count",
                 "has_question", "is_navigational", "avg_word_len", "has_number", "unique_char_ratio"]
    return metrics.merge(queries[feat_cols], on="query_id", how="left")


# MODELS

FEATURE_COLS = [
    "query_len", "word_count", "has_question", "is_navigational",
    "avg_word_len", "has_number", "unique_char_ratio",
]  # Note: category_enc removed to prevent target leakage (Jaccard@10 correlates with category)

MODELS = {
    "linear":   LinearRegression(),
    "ridge":    Ridge(),
    "rf":       RandomForestRegressor(random_state=42),
    "gbr":      GradientBoostingRegressor(random_state=42),
    "svr":      Pipeline([("scaler", StandardScaler()), ("svr", SVR(kernel="rbf"))]),
    "baseline": DummyRegressor(strategy="mean"),
}

PARAM_GRIDS: dict[str, dict] = {
    "linear":   {},
    "ridge":    {"alpha": [0.01, 0.1, 1.0, 10.0, 100.0]},
    "rf":       {"n_estimators": [50, 100], "max_depth": [None, 3, 5]},
    "gbr":      {"n_estimators": [50, 100], "learning_rate": [0.05, 0.1, 0.2]},
    "svr":      {"svr__C": [0.1, 1.0, 10.0], "svr__gamma": ["scale", "auto"]},
    "baseline": {},
}


def split_data(g: pd.DataFrame):
    X = g[FEATURE_COLS].astype(float)
    y = g["jaccard_10"].astype(float)
    
    # Validate that targets are not all NaN (would cause model to fail)
    valid_idx = y.notna() & X.notna().all(axis=1)
    if valid_idx.sum() < 6:
        raise ValueError(f"Insufficient valid data for split: {valid_idx.sum()} rows (need >= 6)")
    
    X = X[valid_idx]
    y = y[valid_idx]
    g = g[valid_idx]
    
    # Stratify by category if possible
    stratify = None
    if "category" in g.columns:
        cat_counts = g["category"].value_counts()
        if len(cat_counts) >= 2 and cat_counts.min() >= 2:
            stratify = g["category"]
    
    try:
        return train_test_split(X, y, g, test_size=0.30, random_state=42, stratify=stratify)
    except ValueError:
        return train_test_split(X, y, g, test_size=0.30, random_state=42)


def safe_cv_mae(model, X: pd.DataFrame, y: pd.Series) -> float:
    folds = min(5, len(y))
    if folds < 2:
        return float("nan")
    try:
        scores = cross_val_score(model, X, y, cv=folds, scoring="neg_mean_absolute_error")
        return float(-scores.mean())
    except Exception:
        return float("nan")


def _fit_model(name: str, base_model, X_train: pd.DataFrame, y_train: pd.Series):
    """Fit model, applying GridSearchCV tuning when a param grid is defined."""
    grid = PARAM_GRIDS.get(name, {})
    if not grid or len(X_train) < 6:
        m = clone(base_model)
        m.fit(X_train, y_train)
        return m, {}
    cv_folds = min(3, len(X_train) // 3)
    if cv_folds < 2:
        m = clone(base_model)
        m.fit(X_train, y_train)
        return m, {}
    try:
        gs = GridSearchCV(clone(base_model), grid, cv=cv_folds,
                          scoring="neg_mean_absolute_error", n_jobs=-1)
        gs.fit(X_train, y_train)
        return gs.best_estimator_, gs.best_params_
    except (ValueError, RuntimeError) as e:
        print(f"GridSearchCV failed for {name}: {e}; using base model", flush=True)
        m = clone(base_model)
        m.fit(X_train, y_train)
        return m, {}


def _feature_importance(model, X_test: pd.DataFrame, y_test: pd.Series) -> dict[str, float]:
    """Extract feature importance from model (tree-based) or via permutation importance.
    
    Handles Pipeline models by extracting the underlying estimator.
    """
    # Handle Pipeline: extract underlying model (e.g., SVR from Pipeline[StandardScaler, SVR])
    actual_model = model.named_steps.get(list(model.named_steps.keys())[-1], model) if hasattr(model, "named_steps") else model
    
    if hasattr(actual_model, "feature_importances_"):
        return {col: float(v) for col, v in zip(FEATURE_COLS, actual_model.feature_importances_)}
    
    if len(X_test) < 2:
        return {}
    
    try:
        perm = sk_perm_imp(model, X_test, y_test, n_repeats=10, random_state=42)
        return {col: float(perm.importances_mean[i]) for i, col in enumerate(FEATURE_COLS)}
    except (ValueError, RuntimeError):
        return {}


def train_and_persist(df: pd.DataFrame, run_id: str, db) -> None:
    if df.empty:
        return
    eval_docs = []
    pred_docs = []
    for sub_pair, g in df.groupby("sub_pair"):
        X_train, X_test, y_train, y_test, _train_rows, test_rows = split_data(g)
        for name, base_model in MODELS.items():
            fitted, best_params = _fit_model(name, base_model, X_train, y_train)
            pred = np.clip(np.asarray(fitted.predict(X_test), dtype=float), 0, 1)
            mae = float(mean_absolute_error(y_test, pred))
            rmse = float(np.sqrt(mean_squared_error(y_test, pred)))
            r2 = 1.0 if np.isclose(y_test.var(), 0) and np.allclose(y_test, pred) else float(r2_score(y_test, pred))
            cv_mae = safe_cv_mae(fitted, g[FEATURE_COLS].astype(float), g["jaccard_10"].astype(float))
            importance = _feature_importance(fitted, X_test, y_test)
            eval_docs.append({
                "run_id": run_id,
                "model": name,
                "sub_pair": sub_pair,
                "mae": mae,
                "rmse": rmse,
                "r2": r2,
                "cv_mae": cv_mae,
                "feature_importances": importance,
                "best_params": best_params,
                "ts": datetime.now(timezone.utc),
            })
            for (_, row), actual, predicted in zip(test_rows.iterrows(), y_test, pred):
                pred_docs.append({
                    "run_id": run_id,
                    "query_id": row["query_id"],
                    "sub_pair": sub_pair,
                    "model": name,
                    "predicted_jaccard": float(predicted),
                    "actual_jaccard": float(actual),
                    "category": row["category"],
                })
    upsert_many(db.model_eval, eval_docs, ["run_id", "model", "sub_pair"])
    upsert_many(db.predictions, pred_docs, ["run_id", "query_id", "sub_pair", "model"])


# PLOTS

def pair_color_map(pairs: list[str]) -> dict[str, str]:
    return {pair: PAIR_COLORS[i % len(PAIR_COLORS)] for i, pair in enumerate(sorted(pairs))}


def export_plot(fig: go.Figure, filename: str) -> None:
    try:
        fig.write_image(os.path.join(PLOTS_DIR, filename), scale=2)
    except Exception as exc:
        print(f"PNG export failed for {filename}: {exc}")


def stats_frames(db, run_id: str):
    raw = load_df(db.raw_results)
    metrics = load_df(db.overlap_metrics)
    queries = load_df(db.queries)
    eval_df = load_df(db.model_eval, {"run_id": run_id})
    preds = load_df(db.predictions, {"run_id": run_id})
    if not metrics.empty:
        metrics["sub_pair"] = metrics.apply(lambda r: "_".join(sorted([r["sub_a"], r["sub_b"]])), axis=1)
    if not metrics.empty and not queries.empty:
        metrics = metrics.merge(queries[["query_id", "category", "text"]], on="query_id", how="left")
    return raw, metrics, queries, eval_df, preds


def build_panel_figures(db, run_id: str) -> list[tuple[str, go.Figure]]:
    raw, metrics, _queries, eval_df, preds = stats_frames(db, run_id)
    pairs = sorted(metrics["sub_pair"].unique()) if not metrics.empty else []
    colors = pair_color_map(pairs)

    figs = []
    mean_pair = metrics.groupby("sub_pair")["jaccard_10"].mean().sort_values() if not metrics.empty else pd.Series(dtype=float)
    fig1 = go.Figure(go.Bar(x=mean_pair.values, y=mean_pair.index, orientation="h", marker_color=[colors.get(p, "#888") for p in mean_pair.index]))
    fig1.update_layout(title="Mean Jaccard@10 by Subreddit Pair", template="plotly_dark", xaxis_title="Jaccard@10")
    figs.append(("01_jaccard_by_pair.png", fig1))

    subs = sorted(set(metrics["sub_a"]).union(set(metrics["sub_b"]))) if not metrics.empty else SUBREDDITS
    matrix = pd.DataFrame(np.eye(len(subs)), index=subs, columns=subs)
    for _, row in metrics.iterrows():
        matrix.loc[row["sub_a"], row["sub_b"]] = row["jaccard_10"]
        matrix.loc[row["sub_b"], row["sub_a"]] = row["jaccard_10"]
    fig2 = go.Figure(go.Heatmap(z=matrix.values, x=matrix.columns, y=matrix.index, colorscale="Viridis", zmin=0, zmax=1, text=np.round(matrix.values, 3), texttemplate="%{text}"))
    fig2.update_layout(title="Community Overlap Heatmap", template="plotly_dark")
    figs.append(("02_overlap_heatmap.png", fig2))

    cat = metrics.groupby(["category", "sub_pair"])["jaccard_10"].mean().reset_index() if not metrics.empty else pd.DataFrame()
    fig3 = go.Figure()
    for pair, g in cat.groupby("sub_pair") if not cat.empty else []:
        fig3.add_trace(go.Bar(x=g["category"], y=g["jaccard_10"], name=pair, marker_color=colors.get(pair)))
    fig3.update_layout(title="Jaccard@10 by Category", template="plotly_dark", barmode="group", yaxis_title="Jaccard@10")
    figs.append(("03_jaccard_by_category.png", fig3))

    fig4 = go.Figure()
    for pair, g in metrics.dropna(subset=["spearman_rho"]).groupby("sub_pair") if not metrics.empty else []:
        fig4.add_trace(go.Box(y=g["spearman_rho"], name=pair, marker_color=colors.get(pair)))
    fig4.update_layout(title="Spearman Rho Distribution", template="plotly_dark", yaxis_title="Spearman rho")
    figs.append(("04_spearman_distribution.png", fig4))

    fig5 = go.Figure()
    if not metrics.empty:
        for category, g in metrics.groupby("category"):
            fig5.add_trace(go.Scatter(x=g["jaccard_10"], y=g["rbo"], mode="markers", name=category, text=g["query_id"]))
        if len(metrics) >= 2 and metrics["jaccard_10"].nunique() > 1:
            coef = np.polyfit(metrics["jaccard_10"], metrics["rbo"], 1)
            xs = np.linspace(metrics["jaccard_10"].min(), metrics["jaccard_10"].max(), 50)
            fig5.add_trace(go.Scatter(x=xs, y=np.polyval(coef, xs), mode="lines", name="trend", line=dict(color="white", dash="dot")))
    fig5.update_layout(title="RBO vs Jaccard@10", template="plotly_dark", xaxis_title="Jaccard@10", yaxis_title="RBO")
    figs.append(("05_rbo_vs_jaccard.png", fig5))

    sub_stats = []
    if not raw.empty:
        raw["domain"] = raw["url"].apply(lambda u: urlparse(str(u)).netloc.removeprefix("www."))
        for subreddit, g in raw.groupby("subreddit"):
            sub_stats.append({
                "subreddit": subreddit,
                "avg_snippet_len": g["snippet"].fillna("").str.len().mean(),
                "unique_domains": g["domain"].nunique(),
            })
    sub_stats_df = pd.DataFrame(sub_stats)
    fig6 = go.Figure()
    if not sub_stats_df.empty:
        fig6.add_trace(go.Bar(x=sub_stats_df["subreddit"], y=sub_stats_df["avg_snippet_len"], name="avg snippet length"))
        fig6.add_trace(go.Bar(x=sub_stats_df["subreddit"], y=sub_stats_df["unique_domains"], name="unique domains"))
    fig6.update_layout(title="Per-Subreddit Result Stats", template="plotly_dark", barmode="group")
    figs.append(("06_result_stats.png", fig6))

    fig7 = go.Figure()
    if not eval_df.empty:
        for pair, g in eval_df.groupby("sub_pair"):
            fig7.add_trace(go.Bar(x=g["model"], y=g["mae"], name=pair, marker_color=colors.get(pair)))
    fig7.update_layout(title="Model Leaderboard (MAE)", template="plotly_dark", barmode="group", yaxis_title="MAE")
    figs.append(("07_model_leaderboard.png", fig7))

    fig8 = go.Figure()
    if not eval_df.empty and not preds.empty:
        best = eval_df.sort_values("cv_mae").iloc[0]
        best_preds = preds[(preds["model"] == best["model"]) & (preds["sub_pair"] == best["sub_pair"])]
        for category, g in best_preds.groupby("category"):
            fig8.add_trace(go.Scatter(x=g["actual_jaccard"], y=g["predicted_jaccard"], mode="markers", name=category, text=g["query_id"]))
        fig8.add_trace(go.Scatter(x=[0, 1], y=[0, 1], mode="lines", name="perfect", line=dict(color="white", dash="dot")))
    fig8.update_layout(title="Predicted vs Actual Jaccard", template="plotly_dark", xaxis_title="Actual", yaxis_title="Predicted")
    figs.append(("08_predicted_vs_actual.png", fig8))
    return figs


def build_dashboard(db, run_id: str) -> None:
    panel_figs = build_panel_figures(db, run_id)
    for filename, fig in panel_figs:
        export_plot(fig, filename)

    fig = make_subplots(
        rows=4,
        cols=2,
        subplot_titles=[
            "Mean Jaccard@10 by Subreddit Pair",
            "Overlap Heatmap",
            "Jaccard@10 by Category",
            "Spearman Rho Distribution",
            "RBO vs Jaccard@10",
            "Per-Subreddit Result Stats",
            "Model Leaderboard",
            "Predicted vs Actual",
        ],
        specs=[
            [{"type": "xy"}, {"type": "heatmap"}],
            [{"type": "xy"}, {"type": "xy"}],
            [{"type": "xy"}, {"type": "xy"}],
            [{"type": "xy"}, {"type": "xy"}],
        ],
        vertical_spacing=0.10,
        horizontal_spacing=0.08,
    )
    for idx, (_filename, panel) in enumerate(panel_figs):
        row = idx // 2 + 1
        col = idx % 2 + 1
        for trace in panel.data:
            fig.add_trace(trace, row=row, col=col)
    fig.update_layout(
        title=dict(text="<b>Reddit Multi-Community Trend Analysis</b>", x=0.5),
        template="plotly_dark",
        height=1650,
        showlegend=True,
    )
    fig.write_html("dashboard.html", include_plotlyjs=True)


# INSIGHTS

def _fmt(value: float) -> str:
    if pd.isna(value):
        return "nan"
    return f"{value:.3f}"


def write_insights(db, run_id: str) -> None:
    raw, metrics, queries, eval_df, _preds = stats_frames(db, run_id)
    failures_df = load_df(db.fetch_failures)
    lines = []
    lines.append("=== Reddit Multi-Community Trend Analysis - Insights ===")
    lines.append(f"Run ID: {run_id}")
    lines.append(f"Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}")
    lines.append(f"Subreddits compared: {', '.join(SUBREDDITS)}")
    lines.append(f"Queries: {count(db.queries)} across {queries['category'].nunique() if not queries.empty else 0} categories")
    lines.append(f"Total results fetched: {count(db.raw_results)}")
    lines.append("")

    lines.append("--- Per-Subreddit Result Stats ---")
    if not raw.empty:
        raw["domain"] = raw["url"].apply(lambda u: urlparse(str(u)).netloc.removeprefix("www."))
        for subreddit, g in raw.groupby("subreddit"):
            per_query = g.groupby("query_id").size().mean()
            avg_snip = g["snippet"].fillna("").str.len().mean()
            lines.append(f"r/{subreddit}: avg {per_query:.1f} results | avg snippet {avg_snip:.1f} chars | {g['domain'].nunique()} unique domains")
    lines.append("")

    lines.append("--- Overlap Metrics (mean across all queries) ---")
    if not metrics.empty:
        grouped = metrics.groupby("sub_pair").agg(
            j5=("jaccard_5", "mean"),
            j10=("jaccard_10", "mean"),
            rho=("spearman_rho", "mean"),
            rbo=("rbo", "mean"),
        )
        for pair, row in grouped.iterrows():
            lines.append(f"{pair} | Jaccard@5: {_fmt(row['j5'])} | Jaccard@10: {_fmt(row['j10'])} | Spearman rho: {_fmt(row['rho'])} | RBO: {_fmt(row['rbo'])}")
    lines.append("")

    lines.append("--- Category Agreement Analysis ---")
    if not metrics.empty:
        cat = metrics.groupby("category")["jaccard_10"].mean()
        lines.append(f"Most agreement:   {cat.idxmax()} (mean Jaccard@10 = {cat.max():.3f})")
        lines.append(f"Least agreement:  {cat.idxmin()} (mean Jaccard@10 = {cat.min():.3f})")
    lines.append("")

    lines.append("--- ML Model Leaderboard ---")
    if not eval_df.empty:
        for pair, g in eval_df.sort_values(["sub_pair", "cv_mae"]).groupby("sub_pair"):
            lines.append(f"Subreddit pair: {pair}")
            lines.append("  Model      | MAE    | RMSE   | R2     | CV-MAE (5-fold)")
            for _, row in g.iterrows():
                lines.append(f"  {row['model']:<10} | {_fmt(row['mae'])} | {_fmt(row['rmse'])} | {_fmt(row['r2'])} | {_fmt(row['cv_mae'])}")
            winner = g.sort_values("cv_mae").iloc[0]
            lines.append(f"  Winner: {winner['model']} (lowest CV-MAE)")
            rf = g[g["model"] == "rf"]
            if not rf.empty and isinstance(rf.iloc[0].get("feature_importances"), dict):
                imps = sorted(rf.iloc[0]["feature_importances"].items(), key=lambda item: item[1], reverse=True)[:3]
                imp_text = ", ".join(f"{name} ({value * 100:.1f}%)" for name, value in imps)
                lines.append(f"  Top-3 features (RF importance): {imp_text}")
    lines.append("")

    lines.append("--- Fetch Failure Analysis (Subreddit x Category) ---")
    if not failures_df.empty and not queries.empty:
        fail_cat = failures_df.merge(queries[["query_id", "category"]], on="query_id", how="left")
        cats = sorted(fail_cat["category"].dropna().unique())
        header = f"{'subreddit':<22}" + "".join(f"{c:<12}" for c in cats)
        lines.append(header)
        for sub in SUBREDDITS:
            sub_rows = fail_cat[fail_cat["subreddit"] == sub]
            counts = sub_rows["category"].value_counts().to_dict()
            lines.append(f"r/{sub:<20}" + "".join(f"{counts.get(c, 0):<12}" for c in cats))
    else:
        lines.append("No failure data.")
    lines.append("")

    lines.append("--- Model vs MeanBaseline ---")
    if not eval_df.empty and "baseline" in eval_df["model"].values:
        beat, total = 0, 0
        for pair, g in eval_df.groupby("sub_pair"):
            bl = g[g["model"] == "baseline"]["mae"].values
            if not len(bl):
                continue
            bm = float(bl[0])
            others = g[g["model"] != "baseline"]
            beat += int((others["mae"] < bm).sum())
            total += len(others)
        if total:
            lines.append(f"Learned models beating MeanBaseline: {beat}/{total} ({100*beat/total:.1f}%)")
    lines.append("")

    spearman_skipped = int(metrics["spearman_rho"].isna().sum()) if not metrics.empty else 0
    failure_breakdown = failures_df.groupby("subreddit").size().to_dict() if not failures_df.empty else {}
    lines.append("--- Data Quality ---")
    lines.append(f"Failed fetches: {count(db.fetch_failures)} (subreddit breakdown: {failure_breakdown})")
    lines.append(f"Retries triggered: {RETRIES}")
    lines.append(f"Queries with < 3 shared URLs (Spearman skipped): {spearman_skipped}")
    lines.append("")
    with open("insights.txt", "w", encoding="utf-8") as f:
        f.write("\n".join(lines))


# MAIN

def main() -> int:
    client = get_client()
    try:
        db = get_db(client)
        for path in glob.glob(os.path.join(PLOTS_DIR, "*.png")):
            os.remove(path)
        if FORCE_REFRESH:
            for name in ["queries", "raw_results", "overlap_metrics", "predictions", "model_eval",
                         "fetch_failures", "overlap_summary"]:
                db[name].drop()
        ensure_indexes(db)

        queries = load_queries("queries.json")
        upsert_many(db.queries, queries, ["query_id"])

        print(f"Subreddits: {', '.join(SUBREDDITS)}", flush=True)
        for i, q in enumerate(queries, 1):
            needs_fetch = any(
                db.raw_results.count_documents({"query_id": q["query_id"], "subreddit": subreddit}) == 0
                and db.fetch_failures.count_documents({"query_id": q["query_id"], "subreddit": subreddit}) == 0
                for subreddit in SUBREDDITS
            )
            if needs_fetch:
                print(f"[{i:02d}/{len(queries)}] Fetching {q['query_id']}: {q['text']}", flush=True)
            fetch_all_subreddits(q["query_id"], q["text"], db)

        for q in queries:
            compute_all_overlaps(q["query_id"], db)

        df = engineer_query_features(db)
        run_id = str(uuid.uuid4())
        db.predictions.delete_many({})
        db.model_eval.delete_many({})
        train_and_persist(df, run_id, db)
        compute_overlap_summary(db, run_id)
        build_dashboard(db, run_id)
        write_insights(db, run_id)

        print("\nDone.")
        print("  Dashboard : dashboard.html")
        print("  Insights  : insights.txt")
        print(f"  Plots     : {PLOTS_DIR}/")
        print(f"  Mongo DB  : {DB_NAME}  (run_id={run_id})")
        return 0
    finally:
        client.close()


if __name__ == "__main__":
    sys.exit(main())
