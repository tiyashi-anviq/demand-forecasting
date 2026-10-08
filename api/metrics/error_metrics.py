"""Live forecast-error metrics (WAPE, under-forecast, over-forecast, bias, MAE) computed from the backtest files in api/backtests/.
Drop a new or refreshed *.csv there and the next /metrics call picks it up (results are cached by file modification time).
Each CSV needs: series_id, week_start, horizon (M1/M2/M3), window, actual_demand_units, plus one or more forecast columns (see MODEL_COLS).
Only rows that every model has a forecast for are scored, so all models are compared on identical rows."""
import os
from pathlib import Path
import numpy as np, pandas as pd

KEYS = ["series_id", "week_start", "horizon", "window"]
# column in the files -> (model key, label, uses the sales team forecast as an input, is a benchmark)
MODEL_COLS = {
    "lgbm": ("base", "LightGBM base", False, False),
    "lgbm_stack": ("stacked", "LightGBM stacked", True, False),
    "chronos2": ("chronos2", "Chronos-2", False, False),
    "nhits": ("nhits", "N-HiTS", False, False),
    "sales_forecast": ("sales_team", "Sales team forecast", False, True),
    "seasonal_baseline_fc_units": ("seasonal", "Seasonal baseline", False, True),
}
HORIZONS = ["M3", "M2", "M1"]
_cache: dict = {}


def _scan(folder: Path):
    return sorted(p for p in folder.glob("*.csv") if not p.name.startswith("_"))


def _load(folder: Path, data_path: str):
    files = _scan(folder)
    sig = tuple((p.name, p.stat().st_mtime_ns) for p in files) + ((data_path, os.path.getmtime(data_path)),)
    if _cache.get("sig") == sig:
        return _cache["val"]
    base, used, n_rows = None, {}, {}
    for p in files:
        d = pd.read_csv(p, parse_dates=["week_start"])
        if not set(KEYS + ["actual_demand_units"]) <= set(d.columns):
            continue
        cols = [c for c in MODEL_COLS if c in d.columns and c not in used]
        if not cols:
            continue
        for c in cols:
            used[c] = p.name
        n_rows[p.name] = len(d)
        d = d[KEYS + ["actual_demand_units"] + cols + [c for c in ("product_id", "series_level") if c in d.columns and base is None]]
        if base is None:
            base = d
        else:
            base = base.merge(d[KEYS + cols], on=KEYS, how="inner")
    if base is None:
        raise FileNotFoundError(f"no usable backtest CSVs in {folder}")
    total = max(n_rows.values())
    cat = pd.read_csv(data_path, usecols=["product_id", "category"]).drop_duplicates("product_id").set_index("product_id").category
    base["level"] = np.where(base.series_id.str.startswith("nat|"), "national", "depot")
    base["category"] = base.product_id.map(cat).fillna("Other")
    base["week_start"] = base.week_start.dt.strftime("%Y-%m-%d")
    models = [c for c in MODEL_COLS if c in used]
    val = dict(df=base, models=models, files=[{"name": k, "rows": v, "models": [MODEL_COLS[c][1] for c in used if used[c] == k]} for k, v in n_rows.items()],
               rows_used=len(base), rows_dropped=int(total - len(base)), updated=max(p.stat().st_mtime for p in files))
    _cache.update(sig=sig, val=val)
    return val


def _score(g: pd.DataFrame, models):
    """One row per model for the rows in g."""
    a = g.actual_demand_units.to_numpy(float); tot = a.sum(); out = []
    for c in models:
        f = g[c].to_numpy(float); diff = f - a
        under, over = np.clip(-diff, 0, None).sum(), np.clip(diff, 0, None).sum()
        key, label, uses_sf, bench = MODEL_COLS[c]
        out.append(dict(model=key, label=label, actual=float(tot), n=int(len(g)), under=float(under / tot) if tot else None, over=float(over / tot) if tot else None,
                        wape=float((under + over) / tot) if tot else None, accuracy=float(max(0.0, 1 - (under + over) / tot)) if tot else None,
                        bias=float(diff.sum() / tot) if tot else None, mae=float((under + over) / len(g)), uses_sales_forecast=uses_sf, benchmark=bench))
    return out


def _weekly(df: pd.DataFrame, models):
    """Per target week and level: actual and every model's forecast at each horizon, summed over the series of that level."""
    out = []
    for level, lv in (("depot", "depot"), ("national", "national")):
        x = df[df.level == lv]
        if x.empty:
            continue
        g = x.groupby(["week_start", "horizon"], as_index=False)[["actual_demand_units"] + models].sum()
        for r in g.itertuples(index=False):
            out.append(dict(level=level if level == "depot" else "national_total", week=r.week_start, horizon=r.horizon, actual=float(r.actual_demand_units),
                            **{MODEL_COLS[c][0]: float(getattr(r, c)) for c in models}))
    return out


def compute(folder, data_path, by="overall", month=None):
    """by = overall | category | window. month = 'YYYY-MM' scores only the target weeks starting in that month (default: all).
    Returns {rows: [{level, horizon, group, model, ...}], months, month, origins, weekly, ...}."""
    v = _load(Path(folder), data_path); df, models = v["df"], v["models"]
    ym = df.week_start.str[:7]
    months = [dict(month=m, weeks=int(df[ym == m].week_start.nunique())) for m in sorted(ym.unique())]
    origins, weekly = None, None
    if month:
        if month not in {m["month"] for m in months}:
            raise ValueError(f"no backtest weeks in {month}; available: {', '.join(m['month'] for m in months)}")
        df = df[ym == month]
        t = pd.Period(month, "M")
        origins = {h: str(t - n) for h, n in (("M3", 3), ("M2", 2), ("M1", 1))}   # forecast made this many months before the target month
        weekly = _weekly(df, models)
    gcol = {"overall": None, "category": "category", "window": "window"}[by]
    rows = []
    for level in ("depot", "national", "national_total"):
        src = df[df.level == ("depot" if level == "depot" else "national")]
        for h in HORIZONS:
            x = src[src.horizon == h]
            if x.empty:
                continue
            if level == "national_total":                     # sum all products per week (and per group) before scoring
                x = x.groupby(["week_start", "window"] + (["category"] if by == "category" else []), as_index=False)[["actual_demand_units"] + models].sum()
            for gv, g in ([(None, x)] if gcol is None else x.groupby(gcol)):
                for r in _score(g, models):
                    rows.append(dict(level=level, horizon=h, group=None if gv is None else (int(gv) if by == "window" else str(gv)), **r))
    return dict(by=by, models=[dict(key=MODEL_COLS[c][0], label=MODEL_COLS[c][1], uses_sales_forecast=MODEL_COLS[c][2], benchmark=MODEL_COLS[c][3]) for c in models],
                months=months, month=month, origins=origins, weekly=weekly, files=v["files"], rows_used=v["rows_used"], rows_dropped=v["rows_dropped"], updated=pd.Timestamp(v["updated"], unit="s").isoformat(), rows=rows)
