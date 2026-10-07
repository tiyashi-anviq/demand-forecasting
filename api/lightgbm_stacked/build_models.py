"""Refit the stacked LightGBM on ALL history and save portable model files for the API.
Run once (and again whenever you retrain):  python build_models.py
Writes models/{M1,M2,M3}_{p50,p10,p90}.txt  (iterations come from outputs/validation_scores.csv)."""
import sys, json
from pathlib import Path
import pandas as pd
import train_lgbm as t, stack_lgbm as s

DATA = sys.argv[1] if len(sys.argv) > 1 else "../data/raw/eveready_mock_weekly_model_ready.csv"
out = Path("models"); out.mkdir(exist_ok=True)
best = pd.read_csv("outputs/validation_scores.csv").set_index("horizon")["best_iter"].to_dict()
df = t.load(DATA); wide = t.build_wide(df)
meta = {"horizons": t.HORIZONS, "features": None, "data": DATA}
for name, h in t.HORIZONS.items():
    X = s.features_stack(df, wide, h); cols = s.feature_cols_stack(X)
    known = X[X.split == "history"].dropna(subset=[t.TARGET])
    rounds = int(best[name] * 1.1) + 10                      # same rule as train_lgbm.py
    for tag, obj, alpha in (("p50", "regression", None), ("p10", "quantile", 0.1), ("p90", "quantile", 0.9)):
        m = t.fit(known, None, cols, objective=obj, alpha=alpha, rounds=rounds)
        m.save_model(str(out / f"{name}_{tag}.txt"))
    meta["features"] = cols
    print(name, "saved", rounds, "trees,", len(cols), "features", flush=True)
json.dump(meta, open(out / "meta.json", "w"), indent=2)
