# Eveready Demand & Supply Planner (React)

React + TypeScript + Vite + IBM Carbon, styled to `UI_DESIGN_REFERENCE.md` with the old demo's green palette (dark by default, light toggle).
Forecasts come live from the **demand forecasting api** (stacked LightGBM). If the API is not running, the app falls back to the bundled
sample forecast and the top bar shows "Sample data · API offline".

## Run (Windows)
Double-click `start.bat` (first run installs packages, then opens http://localhost:5173). Do not double-click `index.html`: it is only the
source page for the dev server, and browsers block the app's scripts when a page is opened straight from a folder (it shows blank).

Or in a terminal in this folder:
    npm install
    npm run dev                     # http://localhost:5173

Start the API first (in `..\demand forecasting api`, venv active):

    uvicorn app:app --reload        # http://127.0.0.1:8000

The top-bar tag turns green: "Live · lightgbm_stacked". To point at another API address copy `.env.example` to `.env` and edit `VITE_API_URL`.

## Build for hosting
    npm run build                   # output in dist/ (static files; hash routing, so any static host works)
    npm run preview                 # http://localhost:4173

## Layout
    src/design/        tokens.css (colours/spacing/type tokens), global.css (shared classes)
    src/layouts/       top bar, left rail, sticky page header, scenario-levers drawer, use-cases modal
    src/screens/       one folder per screen: overview, forecast, newp, calendar, supply, channels, ask, guide (+ registry.tsx)
    src/components/    LineChart (with zoom), BarChart, DataTable, controls, tooltip, empty state
    src/data/          DataProvider: loads public/data/ui_data.json and merges the live forecast
    src/api/           forecastApi.ts: calls GET /forecast/all on the API
    src/state/         theme, levers (draft/apply), per-screen state kept across navigation
    public/data/ui_data.json   the sample dataset (synthetic): history, backtest of the stacked model, supply, channel and launch data

## How the API is used
`GET {API}/forecast/all?model=lightgbm_stacked` returns P50/P10/P90 for all 186 series (13 weeks, Oct–Dec 2026). The UI overlays these on the
dataset's forecast arrays, so every chart, KPI, calendar and what-if lever uses the live numbers. Accuracy, backtest and feature-importance
figures are from the stacked model's rolling backtest and are bundled in `ui_data.json`.

## Adding another model type
Add a model folder + `predictor.py` in the API (see its README), then pass its name where `useApiForecastAll(model)` is called
(`src/api/forecastApi.ts`). A model picker can be added to the top bar using `GET /models`.

## Notes
- All figures are synthetic demo data. The stacked model leans mostly on the sales forecast, so its accuracy is a best case.
- The scenario levers are overlays on the forecast; the model is not re-run.
