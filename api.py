"""FastAPI server: reads Reddit Multi-Community Trend Analysis MongoDB, serves JSON to React frontend."""

import os
from urllib.parse import urlparse

import pandas as pd
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from db import get_client, get_db, load_df

load_dotenv()
DB_NAME = os.getenv("MONGO_DB", "reddit_trend_analysis")

app = FastAPI(title="Reddit Multi-Community Trend Analysis API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:4173"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

_CLIENT = get_client()


def _db():
    return get_db(_CLIENT)


def _latest_run_id(db):
    last = db["model_eval"].find_one(sort=[("ts", -1)])
    return last["run_id"] if last else None


def _json_records(df: pd.DataFrame) -> list[dict]:
    if df.empty:
        return []
    return df.replace({float("nan"): None}).where(pd.notna(df), None).to_dict("records")


@app.get("/api/health")
def health():
    d = _db()
    d.client.admin.command("ping")
    return {"status": "ok", "database": DB_NAME}


@app.get("/api/summary")
def summary():
    d = _db()
    last = d["model_eval"].find_one(sort=[("ts", -1)])
    run_id = last["run_id"] if last else None
    ts = str(last["ts"]) if last else None
    subreddits = list(d.raw_results.distinct("subreddit"))
    return {
        "run_id": run_id,
        "generated_at": ts,
        "subreddits": subreddits,
        "query_count": d.queries.count_documents({}),
        "result_count": d.raw_results.count_documents({}),
        "failure_count": d.fetch_failures.count_documents({}),
        "pair_count": d.overlap_metrics.count_documents({}),
    }


@app.get("/api/subreddit-overlaps")
def subreddit_overlaps():
    d = _db()
    df_ov = load_df(d.overlap_metrics)
    df_q = load_df(d.queries)
    if df_ov.empty:
        return []
    df_ov["sub_pair"] = df_ov["sub_a"] + "_" + df_ov["sub_b"]
    if not df_q.empty:
        df_ov = df_ov.merge(df_q[["query_id", "category"]], on="query_id", how="left")
    df_ov = df_ov.drop(columns=["computed_at", "_id"], errors="ignore")
    return _json_records(df_ov)


@app.get("/api/overlaps")
def overlaps():
    d = _db()
    df_ov = load_df(d.overlap_metrics)
    df_q = load_df(d.queries)
    if df_ov.empty:
        return []
    df_ov = df_ov.rename(columns={"sub_a": "engine_a", "sub_b": "engine_b"})
    df_ov["engine_pair"] = df_ov["engine_a"] + "_" + df_ov["engine_b"]
    if not df_q.empty:
        df_ov = df_ov.merge(df_q[["query_id", "category"]], on="query_id", how="left")
    df_ov = df_ov.drop(columns=["computed_at", "_id"], errors="ignore")
    return _json_records(df_ov)


@app.get("/api/model-eval")
def model_eval_endpoint():
    d = _db()
    run_id = _latest_run_id(d)
    if not run_id:
        return []
    df = load_df(d["model_eval"], {"run_id": run_id})
    df = df.drop(columns=["ts", "_id"], errors="ignore")
    df = df.rename(columns={"sub_pair": "engine_pair"})
    return _json_records(df)


@app.get("/api/overlap-summary")
def overlap_summary():
    d = _db()
    df = load_df(d.overlap_summary)
    df = df.drop(columns=["_id", "run_id"], errors="ignore")
    return _json_records(df)


@app.get("/api/failure-analysis")
def failure_analysis():
    d = _db()
    failures = load_df(d.fetch_failures)
    queries = load_df(d.queries)
    if failures.empty or queries.empty:
        return []
    merged = failures.merge(queries[["query_id", "category"]], on="query_id", how="left")
    crosstab = pd.crosstab(merged["subreddit"], merged["category"]).fillna(0).astype(int)
    result = []
    for subreddit, row in crosstab.iterrows():
        result.append({"subreddit": subreddit, **row.to_dict()})
    return result


@app.get("/api/subreddit-model-eval")
def subreddit_model_eval():
    d = _db()
    run_id = _latest_run_id(d)
    if not run_id:
        return []
    df = load_df(d["model_eval"], {"run_id": run_id})
    df = df.drop(columns=["ts", "_id", "feature_importances"], errors="ignore")
    return _json_records(df)


@app.get("/api/predictions")
def predictions():
    d = _db()
    run_id = _latest_run_id(d)
    if not run_id:
        return []
    df_pred = load_df(d.predictions, {"run_id": run_id})
    if df_pred.empty:
        return []
    df_ov = load_df(d.overlap_metrics)
    if not df_ov.empty:
        df_ov["sub_pair"] = df_ov["sub_a"] + "_" + df_ov["sub_b"]
        df_pred = df_pred.merge(
            df_ov[["query_id", "sub_pair", "jaccard_10"]],
            on=["query_id", "sub_pair"],
            how="left",
        )
        df_pred = df_pred.rename(columns={"jaccard_10": "actual_jaccard_from_overlap"})
        if "actual_jaccard" not in df_pred.columns:
            df_pred["actual_jaccard"] = df_pred["actual_jaccard_from_overlap"]
    df_q = load_df(d.queries)
    if not df_q.empty and "category" not in df_pred.columns:
        df_pred = df_pred.merge(df_q[["query_id", "category"]], on="query_id", how="left")
    df_pred = df_pred.drop(columns=["_id", "actual_jaccard_from_overlap"], errors="ignore")
    df_pred = df_pred.rename(columns={"sub_pair": "engine_pair"})
    return _json_records(df_pred)


@app.get("/api/subreddit-predictions")
def subreddit_predictions():
    d = _db()
    run_id = _latest_run_id(d)
    if not run_id:
        return []
    df_pred = load_df(d.predictions, {"run_id": run_id})
    if df_pred.empty:
        return []
    df_q = load_df(d.queries)
    if not df_q.empty and "category" not in df_pred.columns:
        df_pred = df_pred.merge(df_q[["query_id", "category"]], on="query_id", how="left")
    df_pred = df_pred.drop(columns=["_id"], errors="ignore")
    return _json_records(df_pred)


@app.get("/api/subreddit-stats")
def subreddit_stats():
    d = _db()
    df = load_df(d.raw_results)
    if df.empty:
        return []
    df["snippet_len"] = df["snippet"].fillna("").apply(len)
    df["domain"] = df["url"].apply(lambda u: urlparse(str(u)).netloc.removeprefix("www."))
    query_count = df["query_id"].nunique() or 1
    stats = df.groupby("subreddit").agg(
        avg_snippet_len=("snippet_len", "mean"),
        unique_domains=("domain", "nunique"),
        total_results=("rank", "count"),
    ).reset_index()
    stats["avg_results"] = stats["total_results"] / query_count
    stats = stats.drop(columns=["total_results"])
    return _json_records(stats)


@app.get("/api/engine-stats")
def engine_stats():
    d = _db()
    df = load_df(d.raw_results)
    if df.empty:
        return []
    df["snippet_len"] = df["snippet"].fillna("").apply(len)
    df["domain"] = df["url"].apply(lambda u: urlparse(str(u)).netloc.removeprefix("www."))
    query_count = df["query_id"].nunique() or 1
    stats = df.groupby("subreddit").agg(
        avg_snippet_len=("snippet_len", "mean"),
        unique_domains=("domain", "nunique"),
        total_results=("rank", "count"),
    ).reset_index()
    stats["avg_results"] = stats["total_results"] / query_count
    stats = stats.drop(columns=["total_results"])
    stats = stats.rename(columns={"subreddit": "engine"})
    return _json_records(stats)


@app.get("/api/fetch-failures")
def fetch_failures():
    df = load_df(_db().fetch_failures)
    df = df.drop(columns=["_id", "fetched_at"], errors="ignore")
    return _json_records(df)


@app.get("/api/queries")
def queries_endpoint():
    df = load_df(_db().queries)
    df = df.drop(columns=["_id"], errors="ignore")
    return _json_records(df)
