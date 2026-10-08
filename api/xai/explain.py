"""Explainability for any model type whose Predictor exposes: X (dict horizon-name -> feature frame indexed by series_id, week_start),
models ((name,'p50') -> lightgbm Booster), cols, df, test_weeks, last_hist, horizons.

For a chosen week (and a set of series, summed) it answers "why is the forecast different from the previous weeks?":
  1. model drivers  - LightGBM SHAP contributions (pred_contrib) of the target week minus those of the reference weeks,
                      grouped into plain-language drivers and turned into units that add up to the total change;
  2. data facts     - the plain inputs behind it (festival, scheme, price, budget, last year, sales forecast, seasonal baseline)."""
import numpy as np
import pandas as pd

GROUPS = [
    ("Festival & calendar", "Festival timing, seasons and the fiscal calendar", {"iso_week", "days_to_durga_puja", "days_to_diwali", "festival_in_week", "festival_sell_in_window", "exam_season_flag", "wedding_season_flag", "margin_first_quarter_flag"}),
    ("Weather & economy", "Monsoon timing, rainfall, rural income, power cuts", {"days_from_normal_monsoon_onset", "days_from_monsoon_onset", "rainfall_mm_c", "rural_income_index_c", "power_cut_hrs_c"}),
    ("Price & schemes", "Trade scheme, selling price, competitor price", {"trade_scheme_discount_pct", "asp_inr", "competitor_price_index_c"}),
    ("Marketing", "Influencer campaigns and spend", {"influencer_campaign_active", "influencer_spend_inr_lakh", "influencer_group"}),
    ("Budget / plan", "The planned volume for the week", {"budget_units", "log_budget", "budget_vs_mean13"}),
    ("Sales team forecast", "The sales team's own forecast for the week", {"log_sales_fc", "sf_vs_mean13", "sf_vs_budget", "sf_vs_ly", "sf_vs_bl"}),
    ("Seasonal baseline", "The statistical seasonal baseline forecast", {"log_baseline_fc", "bl_vs_mean13"}),
    ("Same week last year", "Last year's demand and the year-on-year trend", {"ly_actual_sales_units", "log_ly", "ly_vs_mean13", "y_ly", "y_ly_avg3", "yoy_trend13"}),
    ("Recent demand trend", "Latest demand levels, averages and volatility", {"y_lag_c0", "y_lag_c1", "y_lag_c2", "y_lag_c3", "y_lag_c7", "y_mean4", "y_mean13", "y_mean26", "y_std13", "y_max13", "n_obs"}),
    ("New-product effects", "Launch age and cannibalisation by new products", {"is_npd", "weeks_since_launch", "cannibalising_npd_weeks_live", "cannibalising_npd_rate"}),
    ("Product & depot", "Which product / depot this is", {"series_level", "depot_id", "product_id", "category", "horizon_wk"}),
]
GROUP_OF = {f: (g[0]) for g in GROUPS for f in g[2]}
NOTE = {g[0]: g[1] for g in GROUPS}
SF_COL = {"M3": "sales_fc_m3_units", "M2": "sales_fc_m2_units", "M1": "sales_fc_m1_units"}


def _horizon_for(p, wk, horizon):
    if horizon:
        return horizon
    t = __import__("sys").modules.get("train_lgbm")
    H = {"M3": 13, "M2": 9, "M1": 4}
    if wk in set(pd.to_datetime(p.test_weeks)):
        for n in ("M1", "M2", "M3"):                       # freshest usable model, like /forecast
            if wk - pd.Timedelta(weeks=H[n]) <= p.last_hist:
                return n
    return "M3"


def _logmean(a, b):
    """(e^a - e^b)/(a - b), the weight that turns log-contributions into units that add up exactly."""
    d = a - b
    return np.where(np.abs(d) < 1e-9, np.exp(a), (np.exp(a) - np.exp(b)) / np.where(np.abs(d) < 1e-9, 1, d))


def _label(v):
    return None if v is None or (isinstance(v, float) and np.isnan(v)) else v


def explain(p, series_ids, week, horizon=None, ref_weeks=4, top_features=3):
    wk = pd.Timestamp(week)
    name = _horizon_for(p, wk, horizon)
    if name not in p.X:
        raise ValueError(f"unknown horizon {name}")
    refs = [wk - pd.Timedelta(weeks=k) for k in range(1, ref_weeks + 1)]
    X = p.X[name]
    cols = p.cols
    booster = p.models[(name, "p50")]
    ids = [s for s in series_ids if (s, wk) in X.index]
    if not ids:
        raise KeyError("no rows for this week / series")
    idx_t = pd.MultiIndex.from_product([ids, [wk]], names=X.index.names)
    rows_t = X.loc[idx_t]
    C_t = booster.predict(rows_t[cols], pred_contrib=True)          # (n, nfeat+1), log1p space; last col = bias
    a = C_t.sum(1)
    bias_imp = 0.0; feat_imp = np.zeros(len(cols)); group_imp = {g[0]: 0.0 for g in GROUPS}
    P_w = float(np.expm1(a).sum()); P_refs = []; used = 0
    feat_total = {}
    for r in refs:
        name_r = horizon or _horizon_for(p, r, None)               # each week uses the model the forecast chart uses for it
        Xr = p.X[name_r]; br = p.models[(name_r, "p50")]
        have = [i for i in ids if (i, r) in Xr.index]
        if not have:
            continue
        idx_r = pd.MultiIndex.from_arrays([have, [r] * len(have)], names=Xr.index.names)
        rows_r = Xr.loc[idx_r]
        C_r = br.predict(rows_r[cols], pred_contrib=True)
        pos = {s: k for k, s in enumerate(ids)}
        sel = [pos[s] for s in idx_r.get_level_values(0)]
        at, ar = a[sel], C_r.sum(1)
        w = _logmean(at, ar)                                        # units per unit of log-change, per series
        d = C_t[sel, :-1] - C_r[:, :-1]                             # contribution change per feature (like-for-like per series)
        imp = d * w[:, None]                                        # units; rows sum to expm1(at) - expm1(ar)
        feat_imp += imp.sum(0)
        bias_imp += float(((C_t[sel, -1] - C_r[:, -1]) * w).sum())   # differs only when the week and its reference use different horizon models
        P_refs.append(float(np.expm1(ar).sum() - 0)); P_w_r = float(np.expm1(at).sum())
        used += 1
        P_w_used = P_w_r
    if used == 0:
        raise KeyError("no reference weeks available")
    feat_imp /= used; bias_imp /= used
    ref_avg = float(np.mean(P_refs))
    # the target-week total must be over the same series as each reference; use the all-series total for the headline
    for f, v in zip(cols, feat_imp):
        g = GROUP_OF.get(f, "Product & depot")
        group_imp[g] += float(v); feat_total.setdefault(g, []).append((f, float(v)))
    change = float(feat_imp.sum()) + bias_imp
    drivers = []
    for g in GROUPS:
        gname = g[0]
        v = group_imp[gname]
        if abs(v) < 1e-6 and gname not in feat_total:
            continue
        fs = sorted(feat_total.get(gname, []), key=lambda x: -abs(x[1]))[:top_features]
        drivers.append({"driver": gname, "about": NOTE[gname], "impact_units": v, "features": [{"feature": f, "impact_units": x} for f, x in fs if abs(x) > 0]})
    if abs(bias_imp) > 1e-6:
        drivers.append({"driver": "Forecast horizon", "about": "This week and the reference weeks are forecast by different horizon models (4, 9 or 13 weeks ahead)", "impact_units": bias_imp, "features": []})
    drivers.sort(key=lambda d: -abs(d["impact_units"]))
    # --- plain data facts -------------------------------------------------------------------------------------------
    df = p.df
    sub = df[df.series_id.isin(ids)]
    def agg(col, weeks, how="sum"):
        s = sub[sub.week_start.isin(weeks)].groupby("week_start")[col]
        s = s.sum(min_count=1) if how == "sum" else s.mean()
        return s
    facts = []
    used = set(cols)                                         # only list inputs this model actually uses
    def add(label, col, how="sum", unit="units", needs=()):
        if needs and not (set(needs) & used):
            return
        t = agg(col, [wk], how); r = agg(col, refs, how)
        if len(t) == 0 or t.isna().all():
            return
        tv = float(t.iloc[0]); rv = float(r.mean()) if len(r) and not r.isna().all() else None
        facts.append({"label": label, "this_week": tv, "reference": rv, "change_pct": (None if not rv else (tv / rv - 1) * 100), "unit": unit})
    sfcol = SF_COL[name]
    add("Budget", "budget_units", needs=("budget_units", "log_budget")); add("Sales team forecast", sfcol, needs=("log_sales_fc",))
    add("Seasonal baseline forecast", "seasonal_baseline_fc_units", needs=("log_baseline_fc",))
    add("Same week last year", "ly_actual_sales_units", needs=("ly_actual_sales_units", "log_ly"))
    add("Trade scheme discount", "trade_scheme_discount_pct", "mean", "%", needs=("trade_scheme_discount_pct",))
    add("Average selling price", "asp_inr", "mean", "INR", needs=("asp_inr",))
    fest = lambda ws: sorted({str(x) for x in sub[sub.week_start.isin(ws)].festival_in_week.dropna().unique() if str(x) not in ("none", "nan")})
    ft, fr = fest([wk]), fest(refs)
    actual = sub[sub.week_start == wk].actual_demand_units
    return {"week_start": str(wk.date()), "horizon": name, "series_count": len(ids), "reference": f"average of the previous {ref_weeks} weeks",
            "forecast": P_w, "reference_value": ref_avg, "change": P_w - ref_avg, "change_pct": (P_w / ref_avg - 1) * 100 if ref_avg else None,
            "explained": change, "actual": (float(actual.sum()) if actual.notna().any() else None),
            "in_history": bool(wk <= p.last_hist), "festival_this_week": ft, "festival_reference": fr, "drivers": drivers, "facts": facts}
