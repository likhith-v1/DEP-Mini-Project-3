# Reddit Multi-Community Trend Analysis — Agent Instructions

## Project: Reddit Multi-Community Trend Analysis
Compare top-50 Reddit posts from 14 subreddits for 150 curated queries (5 categories × 30: tech/news/health/howto/science).
Compute Jaccard@5/@10, Spearman rank correlation, RBO per subreddit pair (91 pairs total).
Train 6 ML models (5 regressors + MeanBaseline) to predict inter-subreddit Jaccard overlap from query features.
No API keys required — Reddit JSON API is public for unauthenticated reads (1.5s sleep between requests).

## File Structure
reddit-multi-community-trend-analysis/
├── CLAUDE.md                   <- canonical (this file)
├── AGENTS.md -> CLAUDE.md      <- symlink
├── copilot-instructions.md -> CLAUDE.md  <- symlink
├── docker-compose.yml
├── requirements.txt
├── .env.example
├── .gitignore
├── queries.json                <- 150 queries, 5 categories × 30
├── analysis.py                 <- single runnable script
├── db.py                       <- MongoDB helpers
├── api.py                      <- FastAPI server
├── recalibrate.py              <- gitignored; recalibrates metrics with domain priors
├── insights.txt                <- generated
└── plots/                      <- generated PNGs

## Running
```
docker compose up -d mongo
source .venv/bin/activate
uv pip install -r requirements.txt
cp .env.example .env
python analysis.py --force-refresh
python analysis.py
python recalibrate.py          # run after analysis.py to apply affinity priors
```

## Environment
- Python 3.12 | Venv: .venv/ | uv pip install only (never pip/pip3)
- MongoDB 7.0 via Docker Compose | DB: reddit_trend_analysis
- Collections: queries, raw_results, overlap_metrics, predictions, model_eval, fetch_failures, overlap_summary

## Conventions
- Plotly only (no matplotlib/seaborn) for static charts in analysis.py
- analysis.py is the single runnable script; db.py is the only split module
- Generated files must contain real computed values — no placeholders
- AGENTS.md and copilot-instructions.md are symlinks to this file (CLAUDE.md)
- Do NOT touch .github/copilot-instructions.md
- recalibrate.py is gitignored — do not commit it

## Known Design Decisions
- Reddit JSON API runs without API keys; requests use a project User-Agent and 1.5s sleep
- URL normalization: lowercase + strip www + strip trailing slash reduces false non-matches
- Jaccard@10 is the ML prediction target; @5 also stored
- Spearman = NaN when shared URLs < 3
- 5-fold CV used alongside 70/30 split
- RBO p=0.9
- TOP_K=50 (stored as k=50 in overlap_metrics — API must NOT filter by k=10)
- r/worldpolitics removed (100% fetch failure rate)

## ML Methodology
- 6 models: LinearRegression, Ridge (GridSearchCV), RandomForest (GridSearchCV),
  GradientBoosting (GridSearchCV), SVR via Pipeline+StandardScaler (GridSearchCV), DummyRegressor(mean) baseline
- 8 query features: query_len, word_count, has_question, category_enc, is_navigational,
  avg_word_len, has_number, unique_char_ratio
- GridSearchCV cv=3 (small training sets); best_params stored in model_eval collection
- Permutation importance via sklearn.inspection for all non-tree models
- Bootstrap 95% CIs on Jaccard@10 per pair stored in overlap_summary collection
- Failure cross-tab (subreddit × category) reported in insights.txt

## Subreddits (14)
science, technology, worldnews, news, todayilearned, askscience, programming,
explainlikeimfive, Futurology, environment, learnprogramming, datascience, economics, history

## Frontend (v3 — Editorial Light)
- Stack: React 18 + TypeScript + Tailwind CSS v3 + Recharts
- Aesthetic: "Editorial Light" — warm parchment background, deep ink typography, crimson accent
- Fonts: Fraunces (display/numbers, optical variable serif) + Space Mono (labels/data) + Libre Baskerville (body)
- Colors: --bg #faf8f4 | --accent #c0392b (crimson) | --accent2 #1d4ed8 (cobalt) | --text #1c1917
- Location: frontend/ subfolder
- API: api.py (FastAPI) on port 8000
- Run API: uvicorn api:app --port 8000
- Run dev: cd frontend && npm run dev (http://localhost:5173)
- Build: cd frontend && npm run build (must exit 0, no TS errors)
- Section markers: §01 style with Fraunces crimson + section-rule lines
- Components: CategoryFilter, FailureHeatmap, SummaryBar (animated counters), ProjectHero
- New API endpoints: /api/overlap-summary, /api/failure-analysis
- Category filter in App.tsx filters: OverlapBarChart, RboScatter, PredictionScatter
- ModelLeaderboard has pair selector <select> dropdown
- Chart palette: crimson/cobalt/forest green/amber/violet (no orange/cyan)
