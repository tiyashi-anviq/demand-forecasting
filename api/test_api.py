"""Run:  python -m pytest -q test_api.py   -> each model's API output must equal its own outputs/lgbm_test_forecast.csv"""
import pytest
import pandas as pd
from fastapi.testclient import TestClient
import app as A

@pytest.mark.parametrize("model", ["lightgbm_stacked", "lightgbm_base"])
def test_model_matches_csv(model):
    ref = pd.read_csv(f"{model}/outputs/lgbm_test_forecast.csv", parse_dates=["week_start"])
    with TestClient(A.app) as c:
        assert c.get("/health").json()["status"] == "ok"
        assert [m["model"] for m in c.get("/models").json()] == A.MODEL_FOLDERS
        for sid in ref.series_id.unique()[:20]:
            pts = pd.DataFrame(c.get("/forecast", params={"series_id": sid, "model": model}).json()["points"])
            pts["week_start"] = pd.to_datetime(pts.week_start)
            m = ref[ref.series_id == sid].merge(pts, on="week_start")
            assert len(m) == 13 and (m.lgbm_p50 - m.p50).abs().max() < 1e-6 and (m.horizon_x == m.horizon_y).all()
        assert c.get("/forecast", params={"series_id": "nope"}).status_code == 404
        assert c.get("/forecast", params={"series_id": sid, "horizon": "M9"}).status_code == 400
        assert c.get("/forecast", params={"series_id": sid, "model": "tft"}).status_code == 404


def test_forecast_all_matches_single():
    with TestClient(A.app) as c:
        allr = c.get("/forecast/all").json()
        assert len(allr["series"]) == 186 and all(len(v) == 13 for v in allr["series"].values())
        one = c.get("/forecast", params={"series_id": "nat|ALL|bt20"}).json()["points"]
        assert max(abs(a["p50"] - b["p50"]) for a, b in zip(allr["series"]["nat|ALL|bt20"], one)) < 1e-6


def test_backtest_endpoint():
    with TestClient(A.app) as c:
        for m in A.MODEL_FOLDERS:
            d = c.get("/backtest", params={"model": m}).json()
            assert len(d["series"]) == 186 and len(d["weeks"]) == 52 and len(d["lgsc"]) == 9
        assert c.get("/backtest", params={"model": "tft"}).status_code == 404


def test_metrics_split_adds_up_and_updates_live(tmp_path, monkeypatch):
    import shutil
    shutil.copytree("backtests", tmp_path / "bt")
    monkeypatch.setattr(A, "BACKTESTS", str(tmp_path / "bt"))
    with TestClient(A.app) as c:
        r = c.get("/metrics").json()
        assert r["rows"] and {m["key"] for m in r["models"]} >= {"base", "stacked", "sales_team"}
        assert all(abs(x["under"] + x["over"] - x["wape"]) < 1e-9 for x in r["rows"])
        assert c.get("/metrics", params={"by": "category"}).status_code == 200 and c.get("/metrics", params={"by": "window"}).status_code == 200
        assert c.get("/metrics", params={"by": "nope"}).status_code == 400
        before = next(x for x in r["rows"] if x["level"] == "depot" and x["horizon"] == "M3" and x["model"] == "base")["wape"]
        f = tmp_path / "bt" / "lightgbm_backtest_predictions.csv"
        d = pd.read_csv(f); d["lgbm"] = d["lgbm"] * 1.5; d.to_csv(f, index=False)         # refreshed forecasts land in the folder
        after = next(x for x in c.get("/metrics").json()["rows"] if x["level"] == "depot" and x["horizon"] == "M3" and x["model"] == "base")["wape"]
        assert after != before


def test_metrics_by_target_month_uses_three_origins():
    with TestClient(A.app) as c:
        full = c.get("/metrics").json()
        r = c.get("/metrics", params={"month": "2026-09"}).json()
        assert r["month"] == "2026-09" and r["origins"] == {"M3": "2026-06", "M2": "2026-07", "M1": "2026-08"}
        assert [m["month"] for m in r["months"]][0] == "2025-10" and len(r["months"]) == 12
        assert {x["horizon"] for x in r["rows"]} == {"M1", "M2", "M3"} and r["weekly"]
        assert all(abs(x["under"] + x["over"] - x["wape"]) < 1e-9 for x in r["rows"])
        # the 12 months partition the backtest, so the actuals of all months add up to the unfiltered actuals
        tot = sum(next(x for x in c.get("/metrics", params={"month": m["month"]}).json()["rows"] if x["level"] == "depot" and x["horizon"] == "M3" and x["model"] == "base")["actual"] for m in r["months"])
        assert abs(tot - next(x for x in full["rows"] if x["level"] == "depot" and x["horizon"] == "M3" and x["model"] == "base")["actual"]) < 1e-6
        assert c.get("/metrics", params={"month": "2026-10"}).status_code == 400      # no actuals yet for that month
