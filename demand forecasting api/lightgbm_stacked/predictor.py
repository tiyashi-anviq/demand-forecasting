"""LightGBM (stacked) predictor. Every model type exposes the same small interface so app.py can serve it:
    Predictor(data_path).health() / .series() / .forecast(series_id, horizon)"""
import json, sys
from pathlib import Path
HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))
import lightgbm as lgb
import numpy as np
import pandas as pd
import train_lgbm as t
import stack_lgbm as s

NAME = "lightgbm_stacked"
H2N = {h: n for n, h in t.HORIZONS.items()}


class Predictor:
    def __init__(self, data_path):
        meta = json.load(open(HERE / "models" / "meta.json"))
        df = t.load(data_path); wide = t.build_wide(df)
        self.df = df
        self.last_hist = df[df.split == "history"].week_start.max()
        self.test_weeks = sorted(df[df.split == "test"].week_start.unique())
        self.cols = meta["features"]
        self.X = {n: s.features_stack(df, wide, h).set_index(["series_id", "week_start"]) for n, h in t.HORIZONS.items()}
        self.models = {(n, q): lgb.Booster(model_file=str(HERE / "models" / f"{n}_{q}.txt")) for n in t.HORIZONS for q in ("p50", "p10", "p90")}
        self.horizons = list(t.HORIZONS)

    def health(self):
        return {"model": NAME, "history_end": str(self.last_hist.date()), "series": int(self.df.series_id.nunique()),
                "features": len(self.cols), "horizons": self.horizons,
                "forecast_weeks": [str(pd.Timestamp(w).date()) for w in self.test_weeks]}

    def series(self):
        d = self.df.drop_duplicates("series_id")[["series_id", "product_id", "depot_id", "series_level"]]
        return d.sort_values("series_id").to_dict("records")

    def resolve(self, series_id, product_id, depot_id):
        d = self.df
        if series_id is None:
            m = d[(d.product_id.astype(str) == str(product_id)) & (d.depot_id.astype(str) == str(depot_id))].series_id
            series_id = m.iloc[0] if len(m) else None
        return series_id if series_id in set(d.series_id) else None

    def forecast(self, sid, horizon=None):
        pts = []
        for wk in self.test_weeks:
            wk = pd.Timestamp(wk)
            if horizon:
                name = horizon
                if wk - pd.Timedelta(weeks=t.HORIZONS[name]) > self.last_hist:
                    continue
            else:
                ok = [h for h in sorted(H2N) if wk - pd.Timedelta(weeks=h) <= self.last_hist]
                if not ok:
                    continue
                name = H2N[ok[0]]
            row = self.X[name].loc[[(sid, wk)]]
            p = {q: float(np.expm1(self.models[(name, q)].predict(row[self.cols])[0]).clip(min=0)) for q in ("p50", "p10", "p90")}
            p["p10"], p["p90"] = min(p["p10"], p["p50"]), max(p["p90"], p["p50"])
            pts.append({"week_start": str(wk.date()), "horizon": name, "weeks_ahead": t.HORIZONS[name], **p,
                        "sales_forecast": float(row[t.HCOL[name]].iloc[0]),
                        "seasonal_baseline": float(row["seasonal_baseline_fc_units"].iloc[0])})
        return pts

    def forecast_all(self, horizon=None):
        """Every series at once: {series_id: [points]} - one batched predict per (model, quantile)."""
        plan = {}                                            # model name -> [weeks]
        for wk in self.test_weeks:
            wk = pd.Timestamp(wk)
            if horizon:
                if wk - pd.Timedelta(weeks=t.HORIZONS[horizon]) > self.last_hist:
                    continue
                name = horizon
            else:
                ok = [h for h in sorted(H2N) if wk - pd.Timedelta(weeks=h) <= self.last_hist]
                if not ok:
                    continue
                name = H2N[ok[0]]
            plan.setdefault(name, []).append(wk)
        out = {}
        for name, weeks in plan.items():
            X = self.X[name]
            rows = X[X.index.get_level_values("week_start").isin(weeks)]
            pr = {q: np.expm1(self.models[(name, q)].predict(rows[self.cols])).clip(min=0) for q in ("p50", "p10", "p90")}
            for k, ((sid, wk), r) in enumerate(rows.iterrows()):
                p50 = float(pr["p50"][k])
                out.setdefault(sid, []).append({
                    "week_start": str(pd.Timestamp(wk).date()), "horizon": name, "weeks_ahead": t.HORIZONS[name],
                    "p50": p50, "p10": min(float(pr["p10"][k]), p50), "p90": max(float(pr["p90"][k]), p50),
                    "sales_forecast": float(r[t.HCOL[name]]), "seasonal_baseline": float(r["seasonal_baseline_fc_units"])})
        for pts in out.values():
            pts.sort(key=lambda x: x["week_start"])
        return out
