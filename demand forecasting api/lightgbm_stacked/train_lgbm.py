# %% [markdown]
# # Eveready — LightGBM-only demand forecaster (leak-safe, direct multi-horizon)
# Run top to bottom in VS Code (Interactive Window, `# %%` cells) or as a script:
#     python train_lgbm.py --data data/raw/eveready_mock_weekly_model_ready.csv
#
# Design
# * Target: log1p(actual_demand_units). One global model across all 186 series
#   (31 products x [National + 5 Kolkata depots]).
# * Direct strategy: one model per horizon  h in {13, 9, 4}  weeks  (M3 / M2 / M1).
#   A row = (series, target week T). Every history-derived feature is measured at the
#   cut-off  c = T - h  weeks, so nothing after the cut-off can leak in.
# * Known-in-advance covariates at T (festival calendar, scheme, budget, price, last year ...)
#   are allowed. Realised outcomes (sales, stock, lost sales ...) are NEVER used.
# * Validation: train on targets up to 13 weeks before the end of history, score the last
#   13 history weeks. Then refit on everything and forecast the hidden Oct-Dec 2026 window.
# * Benchmarks computed on the same rows: sales_fc_m3/m2/m1 and seasonal_baseline_fc.

# %%
import argparse, json, time, warnings
from pathlib import Path
import numpy as np, pandas as pd, lightgbm as lgb
warnings.filterwarnings("ignore")

SEED = 20261005
HORIZONS = {"M3": 13, "M2": 9, "M1": 4}
HCOL = {"M3": "sales_fc_m3_units", "M2": "sales_fc_m2_units", "M1": "sales_fc_m1_units"}
TARGET = "actual_demand_units"

# columns known before the target week (allowed as features at T)
KNOWN_NUM = ["iso_week", "days_to_durga_puja", "days_to_diwali", "days_from_normal_monsoon_onset",
             "days_from_monsoon_onset", "exam_season_flag", "wedding_season_flag", "trade_scheme_discount_pct",
             "asp_inr", "margin_first_quarter_flag", "influencer_campaign_active", "influencer_spend_inr_lakh",
             "budget_units", "ly_actual_sales_units", "is_npd", "weeks_since_launch",
             "cannibalising_npd_weeks_live", "cannibalising_npd_rate"]
KNOWN_CAT = ["festival_in_week", "festival_sell_in_window", "influencer_group"]
STATIC_CAT = ["series_level", "depot_id", "product_id", "category"]
# past-only drivers: may only enter as values dated <= cut-off
LAG_DRIVERS = ["rainfall_mm", "rural_income_index", "competitor_price_index", "power_cut_hrs"]


def parse():
    p = argparse.ArgumentParser()
    p.add_argument("--data", default="../data/raw/eveready_mock_weekly_model_ready.csv")
    p.add_argument("--out", default="outputs")
    p.add_argument("--quantiles", action="store_true", help="also train P10/P90 models")
    p.add_argument("--quick", action="store_true", help="fewer trees (smoke test)")
    a, _ = p.parse_known_args()
    return a


# %%
def load(path):
    df = pd.read_csv(path, parse_dates=["week_start"])
    df["series_id"] = df["grain"].str[:3] + "|" + df["depot_id"].astype(str) + "|" + df["product_id"].astype(str)
    df["series_level"] = np.where(df["depot_id"].eq("ALL"), "national", "depot")
    df = df.sort_values(["series_id", "week_start"]).reset_index(drop=True)
    return df


def build_wide(df):
    """weeks x series matrices of past-only quantities."""
    w = {"y": df.pivot(index="week_start", columns="series_id", values=TARGET)}
    for c in LAG_DRIVERS:
        w[c] = df.pivot(index="week_start", columns="series_id", values=c)
    return w


def features_for_horizon(df, wide, h):
    """One row per (series, target week T). History features are measured at c = T - h."""
    y = wide["y"]
    ly = np.log1p(y)
    f = {}
    for j in (0, 1, 2, 3, 7):                                   # lags at/after the cut-off
        f[f"y_lag_c{j}"] = ly.shift(h + j)
    for win in (4, 13, 26):
        r = ly.rolling(win, min_periods=max(2, win // 2))
        f[f"y_mean{win}"] = r.mean().shift(h)
    f["y_std13"] = ly.rolling(13, min_periods=6).std().shift(h)
    f["y_max13"] = ly.rolling(13, min_periods=6).max().shift(h)
    f["y_ly"] = ly.shift(52)                                     # same week last year (52 >= h)
    f["y_ly_avg3"] = ly.shift(51).add(ly.shift(52)).add(ly.shift(53)).div(3)
    m13 = ly.rolling(13, min_periods=6).mean()
    f["yoy_trend13"] = (m13 - m13.shift(52)).shift(h)           # growth of the latest 13 wks vs a year ago
    f["n_obs"] = y.notna().cumsum().shift(h)                     # weeks of history at the cut-off
    for c in LAG_DRIVERS:
        f[f"{c}_c"] = wide[c].rolling(4, min_periods=1).mean().shift(h)
    stacked = {k: v.rename_axis(index="week_start", columns="series_id").stack().rename(k) for k, v in f.items()}
    F = pd.concat(stacked.values(), axis=1).reset_index()
    base = df[["series_id", "week_start", TARGET] + KNOWN_NUM + KNOWN_CAT + STATIC_CAT + ["split"] +
              list(HCOL.values()) + ["seasonal_baseline_fc_units"]]
    X = base.merge(F, on=["series_id", "week_start"], how="left")
    # relative-to-plan signals (budget and last-year are known at T)
    X["log_budget"] = np.log1p(X["budget_units"])
    X["log_ly"] = np.log1p(X["ly_actual_sales_units"])
    X["budget_vs_mean13"] = X["log_budget"] - X["y_mean13"]
    X["ly_vs_mean13"] = X["log_ly"] - X["y_mean13"]
    X["horizon_wk"] = h
    X["cutoff_week"] = X["week_start"] - pd.to_timedelta(7 * h, unit="D")
    for c in KNOWN_CAT + STATIC_CAT:
        X[c] = X[c].fillna("none").astype(str).astype("category")
    return X


FEATURES = None


def feature_cols(X):
    drop = {"series_id", "week_start", TARGET, "split", "seasonal_baseline_fc_units", "cutoff_week", *HCOL.values()}
    return [c for c in X.columns if c not in drop]


# %%
def params(objective="regression", alpha=None, quick=False):
    p = dict(objective=objective, learning_rate=0.05, num_leaves=63, min_data_in_leaf=40, feature_fraction=0.8,
             bagging_fraction=0.8, bagging_freq=1, lambda_l2=2.0, max_cat_to_onehot=8, cat_smooth=20,
             seed=SEED, verbosity=-1, n_jobs=-1)
    if alpha is not None:
        p["alpha"] = alpha
    return p, (150 if quick else 2000)


def fit(Xtr, Xva, cols, objective="regression", alpha=None, quick=False, rounds=None):
    p, n = params(objective, alpha, quick)
    dtr = lgb.Dataset(Xtr[cols], np.log1p(Xtr[TARGET]), categorical_feature=[c for c in cols if str(Xtr[c].dtype) == "category"])
    if rounds:                                                    # refit on all data
        return lgb.train(p, dtr, num_boost_round=rounds)
    dva = lgb.Dataset(Xva[cols], np.log1p(Xva[TARGET]), reference=dtr)
    return lgb.train(p, dtr, n, valid_sets=[dva], callbacks=[lgb.early_stopping(50, verbose=False)])


def acc(a, f):
    m = a.notna() & f.notna()
    a, f = a[m], f[m]
    return float(max(0, 1 - np.abs(f - a).sum() / a.sum())) if len(a) and a.sum() > 0 else np.nan


def score(frame, pred_col, bench):
    out = {}
    for lvl, g in frame.groupby("series_level"):
        out[f"{lvl}_row_accuracy"] = acc(g[TARGET], g[pred_col])
    nat = frame[frame.series_level == "national"].groupby("week_start")[[TARGET, pred_col]].sum()
    out["national_total_accuracy"] = acc(nat[TARGET], nat[pred_col])
    out["bias"] = float((frame[pred_col].sum() - frame[TARGET].sum()) / frame[TARGET].sum())
    return out


# %%
def main():
    a = parse(); t0 = time.time()
    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    df = load(a.data); wide = build_wide(df)
    hist = df[df.split == "history"]; last_hist = hist.week_start.max()
    test_weeks = sorted(df[df.split == "test"].week_start.unique())
    val_start = last_hist - pd.Timedelta(weeks=12)               # last 13 history weeks
    print(f"history to {last_hist.date()}, {len(df.series_id.unique())} series, validation from {val_start.date()}")
    rows, importance, preds_val, preds_test = [], [], [], []
    for name, h in HORIZONS.items():
        X = features_for_horizon(df, wide, h); cols = feature_cols(X)
        known = X[X.split == "history"].dropna(subset=[TARGET])
        tr = known[known.week_start < val_start]; va = known[known.week_start >= val_start]
        es = tr[tr.week_start >= tr.week_start.max() - pd.Timedelta(weeks=8)]     # early stop on latest 8 weeks
        tr2 = tr[tr.week_start < es.week_start.min()]
        m = fit(tr2, es, cols, quick=a.quick); best = m.best_iteration or 150
        va = va.copy(); va["lgbm"] = np.expm1(m.predict(va[cols], num_iteration=best)).clip(min=0)
        res = {"horizon": name, "weeks_ahead": h, "best_iter": best}
        for lbl, col in (("lgbm", "lgbm"), ("sales_forecast", HCOL[name]), ("seasonal_baseline", "seasonal_baseline_fc_units")):
            for k, v in score(va, col, None).items():
                res[f"{lbl}_{k}"] = round(v, 4)
        rows.append(res)
        print(name, {k: v for k, v in res.items() if "row_acc" in k or "national_total" in k})
        preds_val.append(va.assign(horizon=name)[["series_id", "week_start", "horizon", TARGET, "lgbm", HCOL[name], "seasonal_baseline_fc_units"]]
                         .rename(columns={HCOL[name]: "sales_forecast"}))
        imp = pd.DataFrame({"feature": cols, "gain": m.feature_importance("gain")}); imp["horizon"] = name
        importance.append(imp.sort_values("gain", ascending=False))
        # ---- refit on ALL history, forecast the hidden window
        full = known
        mf = fit(full, None, cols, rounds=int(best * 1.1) + 10)
        Xt = X[X.week_start.isin(test_weeks)].copy()
        Xt["lgbm_p50"] = np.expm1(mf.predict(Xt[cols])).clip(min=0)
        if a.quantiles:
            for q in (0.1, 0.9):
                mq = fit(full, None, cols, objective="quantile", alpha=q, rounds=int(best * 1.1) + 10)
                Xt[f"lgbm_p{int(q*100)}"] = np.expm1(mq.predict(Xt[cols])).clip(min=0)
        if a.quantiles:                                           # enforce p10 <= p50 <= p90
            Xt["lgbm_p10"] = np.minimum(Xt["lgbm_p10"], Xt["lgbm_p50"]); Xt["lgbm_p90"] = np.maximum(Xt["lgbm_p90"], Xt["lgbm_p50"])
        Xt["horizon"] = name
        preds_test.append(Xt)
    # ---- choose, for every test week, the model whose cut-off is the latest one that is still <= last history week
    T = pd.concat(preds_test); T["weeks_after_history"] = ((T.week_start - last_hist).dt.days // 7)
    T["usable"] = T["cutoff_week"] <= last_hist
    best_rows = []
    for wk, g in T[T.usable].groupby("week_start"):
        g = g.sort_values("horizon_wk"); hmin = g.horizon_wk.min()
        best_rows.append(g[g.horizon_wk == hmin])
    forecast = pd.concat(best_rows)
    keep = ["series_id", "product_id", "depot_id", "series_level", "week_start", "horizon", "weeks_after_history", "lgbm_p50"] + \
           [c for c in ("lgbm_p10", "lgbm_p90") if c in forecast]
    forecast[keep].sort_values(["series_id", "week_start"]).to_csv(out / "lgbm_test_forecast.csv", index=False)
    # also the full M3/M2/M1 grid (rows whose cut-off is after history are marked unusable until actuals are revealed)
    T[keep + ["cutoff_week", "usable"]].to_csv(out / "lgbm_test_forecast_all_horizons.csv", index=False)
    pd.DataFrame(rows).to_csv(out / "validation_scores.csv", index=False)
    pd.concat(preds_val).to_csv(out / "validation_predictions.csv", index=False)
    imp = pd.concat(importance); imp.to_csv(out / "feature_importance.csv", index=False)
    json.dump({"seed": SEED, "history_end": str(last_hist.date()), "validation_start": str(val_start.date()), "quick": a.quick,
               "quantiles": a.quantiles, "n_series": int(df.series_id.nunique()), "n_features": len(cols), "seconds": round(time.time() - t0)},
              open(out / "run_manifest.json", "w"), indent=2)
    print("saved to", out.resolve(), f"({time.time() - t0:.0f}s)")
    return pd.DataFrame(rows), imp


if __name__ == "__main__":
    scores, imp = main()
    print(scores.T.to_string())
    print(imp.groupby("feature").gain.sum().sort_values(ascending=False).head(15))
