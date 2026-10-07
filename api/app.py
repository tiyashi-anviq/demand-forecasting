"""Eveready demand forecasting API. One sub-folder per model type, each with a predictor.py.
Start:  uvicorn app:app --reload        Docs: http://127.0.0.1:8000/docs
To add a model type: create a folder with predictor.py (class Predictor) and add it to MODEL_FOLDERS."""
import importlib.util, os
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field

ROOT = Path(__file__).parent
DATA = os.environ.get("EVEREADY_DATA", str(ROOT / "data/raw/eveready_mock_weekly_model_ready.csv"))
MODEL_FOLDERS = ["lightgbm_stacked"]          # add "tft", "seasonal_baseline", ... as they are built
DEFAULT_MODEL = "lightgbm_stacked"
PRED = {}


def _load(folder):
    spec = importlib.util.spec_from_file_location(f"{folder}_predictor", ROOT / folder / "predictor.py")
    mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
    return mod.Predictor(DATA)


@asynccontextmanager
async def lifespan(app):
    for f in MODEL_FOLDERS:
        PRED[f] = _load(f)
    yield
    PRED.clear()


app = FastAPI(title="Eveready demand forecasting", version="2.1", lifespan=lifespan)
# the React UI runs on another port (Vite dev server), so allow cross-origin calls (override with EVEREADY_CORS="https://a,https://b")
app.add_middleware(CORSMiddleware, allow_origins=os.environ.get("EVEREADY_CORS", "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173").split(","),
                   allow_methods=["GET"], allow_headers=["*"])


@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse("/docs")


class Point(BaseModel):
    week_start: str
    horizon: str = Field(description="M1 (4 wk), M2 (9 wk) or M3 (13 wk) ahead")
    weeks_ahead: int
    p50: float
    p10: float
    p90: float
    sales_forecast: float | None = None
    seasonal_baseline: float | None = None


class ForecastOut(BaseModel):
    model: str
    series_id: str
    history_end: str
    points: list[Point]


def _pred(model):
    if model not in PRED:
        raise HTTPException(404, f"unknown model '{model}'. Available: {list(PRED)}")
    return PRED[model]


@app.get("/models")
def models():
    return [p.health() for p in PRED.values()]


@app.get("/health")
def health():
    return {"status": "ok", "models": list(PRED)}


@app.get("/series")
def series(model: str = DEFAULT_MODEL):
    return _pred(model).series()


@app.get("/forecast", response_model=ForecastOut)
def forecast(series_id: str | None = None, product_id: str | None = None,
             depot_id: str | None = Query(None, description="'ALL' = national"),
             horizon: str | None = Query(None, description="M1, M2 or M3. Omit for the freshest usable model per week"),
             model: str = Query(DEFAULT_MODEL, description="model type = sub-folder name, see /models")):
    p = _pred(model)
    if series_id is None and not (product_id and depot_id):
        raise HTTPException(422, "give series_id, or product_id and depot_id")
    if horizon is not None and horizon not in p.horizons:
        raise HTTPException(400, f"horizon must be one of {p.horizons}")
    sid = p.resolve(series_id, product_id, depot_id)
    if sid is None:
        raise HTTPException(404, "unknown series. See /series")
    return ForecastOut(model=model, series_id=sid, history_end=str(p.last_hist.date()), points=p.forecast(sid, horizon))


class AllOut(BaseModel):
    model: str
    history_end: str
    series: dict[str, list[Point]]


@app.get("/forecast/all", response_model=AllOut)
def forecast_all(horizon: str | None = Query(None, description="M1, M2 or M3. Omit for the freshest usable model per week"),
                 model: str = Query(DEFAULT_MODEL)):
    """Every series in one call (used by the UI). Keys are series_id, e.g. nat|ALL|bt20 or kol|bar|bt20."""
    p = _pred(model)
    if horizon is not None and horizon not in p.horizons:
        raise HTTPException(400, f"horizon must be one of {p.horizons}")
    return AllOut(model=model, history_end=str(p.last_hist.date()), series=p.forecast_all(horizon))
