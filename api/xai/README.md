# xai - explainability module

Answers "why is the forecast for this week different from the weeks before it?" for any model type in this API.

- `explain.py` - model-agnostic. Works with any model folder whose `predictor.py` exposes `X`, `models`, `cols`, `df`, `test_weeks`, `last_hist`, `horizons` (both `lightgbm_base` and `lightgbm_stacked` do).
- Endpoint: `POST /explain` in `app.py` (body: `series_ids`, `week_start`, `model`, optional `horizon`, `ref_weeks`).

How it works
1. LightGBM SHAP (`pred_contrib=True`) gives each feature's contribution to log1p(demand) for the target week and each reference week.
2. The change in contribution per feature is turned into units with a log-mean weight, so the drivers add up exactly to the change in the forecast.
3. Features are grouped into plain-language drivers (festival, budget, sales team forecast, ...). The plain inputs (festival, budget, last year, scheme, price) are returned next to them as `facts`.

Add a model type: nothing to do here. Register its folder in `MODEL_FOLDERS` in `app.py` and give its Predictor the attributes above.
Limits: SHAP shows what the model leaned on, not what caused demand to move. The data is simulated.
