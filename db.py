"""MongoDB helpers for Mini-Project-3."""

import os
import time
from typing import Iterable

import pandas as pd
from dotenv import load_dotenv
from pymongo import MongoClient, UpdateOne
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError


def get_client() -> MongoClient:
    """Load MONGO_URI from .env and return a MongoClient with 3-attempt retry."""
    load_dotenv()
    uri = os.getenv("MONGO_URI", "mongodb://localhost:27017")
    last_error = None
    for attempt in range(3):
        try:
            client = MongoClient(uri, serverSelectionTimeoutMS=3000)
            client.admin.command("ping")
            return client
        except (ConnectionFailure, ServerSelectionTimeoutError) as exc:
            last_error = exc
            if attempt < 2:
                time.sleep(2)
    raise RuntimeError(f"Could not connect to MongoDB after 3 attempts: {last_error}")


def get_db(client: MongoClient):
    """Return the configured Mongo database."""
    load_dotenv()
    return client[os.getenv("MONGO_DB", "dep_mp3")]


def ensure_indexes(db) -> None:
    """Create all project unique indexes idempotently."""
    db.queries.create_index([("query_id", 1)], unique=True)
    db.raw_results.create_index([("query_id", 1), ("subreddit", 1), ("rank", 1)], unique=True)
    db.overlap_metrics.create_index(
        [("query_id", 1), ("sub_a", 1), ("sub_b", 1), ("k", 1)],
        unique=True,
    )
    db.predictions.create_index(
        [("run_id", 1), ("query_id", 1), ("sub_pair", 1), ("model", 1)],
        unique=True,
    )
    db.model_eval.create_index(
        [("run_id", 1), ("model", 1), ("sub_pair", 1)],
        unique=True,
    )
    db.fetch_failures.create_index([("query_id", 1), ("subreddit", 1)], unique=True)


def upsert_many(coll, docs: Iterable[dict], key_fields: list[str]) -> int:
    """Bulk upsert dictionaries by the provided key fields."""
    operations = []
    for doc in docs:
        if not doc:
            continue
        clean = {k: v for k, v in doc.items() if pd.notna(v)}
        key = {k: clean[k] for k in key_fields}
        operations.append(UpdateOne(key, {"$set": clean}, upsert=True))
    if not operations:
        return 0
    result = coll.bulk_write(operations, ordered=False)
    return int(result.upserted_count + result.modified_count)


def load_df(coll, query: dict | None = None) -> pd.DataFrame:
    """Load a collection query into a DataFrame with _id removed."""
    df = pd.DataFrame(list(coll.find(query or {})))
    if "_id" in df.columns:
        df = df.drop(columns=["_id"])
    return df


def count(coll) -> int:
    """Return total collection document count."""
    return int(coll.count_documents({}))
