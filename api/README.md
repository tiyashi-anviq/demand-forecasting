# Eveready demand forecasting API

One sub-folder per model type. Shared pieces (data, API app) sit at the top.

    api/
      app.py                  FastAPI service - serves every model folder listed in MODEL_FOLDERS
      test_api.py             checks the API against each model's saved forecast CSV
      pyproject.toml, uv.lock  dependencies (managed with uv)
      data/raw/               shared input data (eveready_mock_weekly_model_ready.csv)
      lightgbm_stacked/       model type 1
        predictor.py          the interface app.py calls (Predictor class)
        train_lgbm.py, stack_lgbm.py   feature building + training code
        build_models.py       refit on all history, write models/
        models/               saved M1/M2/M3 x p50/p10/p90 + meta.json
        outputs/              lgbm_test_forecast.csv, validation_scores.csv

## Run
Needs [uv](https://docs.astral.sh/uv/) (`powershell -c "irm https://astral.sh/uv/install.ps1 | iex"`).

    uv sync                                   # creates .venv and installs everything (incl. dev: pytest, httpx)
    uv run uvicorn app:app --reload           # then open http://127.0.0.1:8000/docs
    uv run pytest -q test_api.py

Add a dependency with `uv add <pkg>` (or `uv add --dev <pkg>` for test-only).

## Calls
- `GET /models` - the model types loaded
- `GET /series?model=lightgbm_stacked` - the 186 series
- `GET /forecast/all?model=lightgbm_stacked` - every series in one call (used by the React UI)
- `GET /forecast?product_id=bt20&depot_id=ALL&model=lightgbm_stacked` - 13-week P50/P10/P90 (plus sales forecast and seasonal baseline). `horizon=M1|M2|M3` forces one model; `depot_id=ALL` is national.
- `GET /metrics?by=overall|category|window[&month=YYYY-MM]` - forecast error per model, level (depot / national / national total) and horizon: accuracy, **under-forecast** (units short of demand / actual units, the lost-sales risk), **over-forecast** (units above demand / actual units, the excess-stock risk), bias and average miss. Under + over = WAPE. Computed live from the CSVs in `backtests/` (each needs `series_id, week_start, horizon, window, actual_demand_units` plus forecast columns such as `lgbm`, `lgbm_stack`, `chronos2`, `nhits`, `sales_forecast`, `seasonal_baseline_fc_units`). **To update it, drop a refreshed CSV into `backtests/`**; the next call picks it up, no restart. Only rows every model forecast are scored. Add `month=2026-09` to score only the target weeks starting in that month: M3, M2 and M1 are then the forecasts made 3, 2 and 1 months earlier (June, July and August), and the response lists the available months and the weekly actual-vs-forecast series. A month with no actuals returns 400. The UI's *Error metrics* screen reads this endpoint.

## Rebuild the LightGBM models
    cd lightgbm_stacked
    uv run python build_models.py

## Add another model type (TFT, seasonal baseline ...)
1. Create a folder, e.g. `tft/`, with its own code, saved model files and a `predictor.py` exposing `class Predictor(data_path)` with `health()`, `series()`, `resolve(series_id, product_id, depot_id)`, `forecast(series_id, horizon)` and `horizons`.
2. Add the folder name to `MODEL_FOLDERS` in `app.py`.
3. Call it with `?model=tft`.

## Limits
Only the 13 forecast weeks already in the data (Oct-Dec 2026) are served. The stacked model's 13-week national total is its weak spot.
