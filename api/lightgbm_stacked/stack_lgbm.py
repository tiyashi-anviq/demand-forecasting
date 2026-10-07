"""Stacked LightGBM: the base LightGBM features PLUS the sales team's forecast and the seasonal baseline.
Both are forecasts for target week T that exist at the cut-off (T - h), so they are leak-safe.
The model learns when to trust the plan / baseline and when to override them."""
import numpy as np, pandas as pd
import train_lgbm as t

_BASE = t.features_for_horizon      # keep the original so patching t.features_for_horizon cannot recurse

def features_stack(df, wide, h):
    X = _BASE(df, wide, h)
    name = {13: "M3", 9: "M2", 4: "M1"}[h]
    sf = np.log1p(X[t.HCOL[name]]); bl = np.log1p(X["seasonal_baseline_fc_units"])
    X["log_sales_fc"] = sf
    X["log_baseline_fc"] = bl
    X["sf_vs_mean13"] = sf - X["y_mean13"]          # plan vs recent level
    X["bl_vs_mean13"] = bl - X["y_mean13"]
    X["sf_vs_bl"] = sf - bl                          # plan vs seasonal baseline
    X["sf_vs_budget"] = sf - X["log_budget"]
    X["sf_vs_ly"] = sf - X["log_ly"]
    return X

def feature_cols_stack(X):
    return t.feature_cols(X)   # base drop-list excludes only raw fc columns; new log/ratio columns are kept
