"""Package a model's rolling-backtest results for the API (GET /backtest?model=...).
Usage:  python make_backtest_json.py <model_folder> <backtest_predictions.csv> <pred_column> <backtest_scores.csv> <feature_importance.csv>
The predictions file needs: series_id, week_start, horizon (M1/M2/M3), window, actual_demand_units and the model's prediction column.
The scores file needs: horizon, level and three accuracy columns (model / sales forecast / seasonal baseline), see SCORE_COLS."""
import json, sys
import pandas as pd

folder, preds, col, scores, imp = sys.argv[1:6]
bt = pd.read_csv(preds)
weeks = sorted(bt.week_start.unique())
ix = {w: i for i, w in enumerate(weeks)}
series = {}
for (sid, h), g in bt.groupby(["series_id", "horizon"]):
    arr = series.setdefault(sid, {}).setdefault(h, [None] * len(weeks))
    for w, v in zip(g.week_start, g[col]):
        arr[ix[w]] = round(float(v), 1)
sc = pd.read_csv(scores)
rename = {}
for c in sc.columns:
    if c in ("horizon", "level"): continue
    if c.startswith("sales_forecast"): rename[c] = "sales_forecast_accuracy"
    elif c.startswith("seasonal"): rename[c] = "seasonal_accuracy"
    elif c == "lgbm_acc" or c == "lgbm_accuracy": continue
    elif c.startswith("lgbm"): rename[c] = "lgbm_accuracy"
sc = sc.rename(columns=rename)
if "lgbm_accuracy" not in sc.columns: raise SystemExit("no model accuracy column found: " + str(list(sc.columns)))
lgsc = [{k: (round(float(r[k]), 4) if k.endswith("accuracy") else r[k]) for k in ("horizon", "level", "lgbm_accuracy", "sales_forecast_accuracy", "seasonal_accuracy")} for _, r in sc.iterrows()]
bt["err"] = (bt[col] - bt.actual_demand_units).abs()
w = bt.groupby(["window", "horizon"]).apply(lambda g: 1 - g.err.sum() / g.actual_demand_units.sum(), include_groups=False).reset_index(name="acc")
lgwin = [{"window": int(r.window), "horizon": r.horizon, "acc": round(float(r.acc), 4), "from": bt[bt.window == r.window].week_start.min(), "to": bt[bt.window == r.window].week_start.max()} for r in w.itertuples()]
im = pd.read_csv(imp).groupby("feature").gain.sum().sort_values(ascending=False)
lgimp = [{"feature": k, "share": round(float(v / im.sum()), 4)} for k, v in im.head(12).items()]
out = {"weeks": weeks, "series": series, "lgsc": lgsc, "lgwin": lgwin, "lgimp": lgimp, "lgbt": {"from": weeks[0], "to": weeks[-1]}}
json.dump(out, open(f"{folder}/backtest.json", "w"), separators=(",", ":"))
print(folder, "->", len(series), "series,", len(weeks), "weeks,", len(lgsc), "score rows")
