"""Run:  python -m pytest -q test_api.py   -> API output must equal lightgbm_stacked/outputs/lgbm_test_forecast.csv"""
import pandas as pd
from fastapi.testclient import TestClient
import app as A

def test_lightgbm_stacked_matches_csv():
    ref = pd.read_csv("lightgbm_stacked/outputs/lgbm_test_forecast.csv", parse_dates=["week_start"])
    with TestClient(A.app) as c:
        assert c.get("/health").json()["status"] == "ok"
        assert [m["model"] for m in c.get("/models").json()] == A.MODEL_FOLDERS
        for sid in ref.series_id.unique()[:20]:
            pts = pd.DataFrame(c.get("/forecast", params={"series_id": sid, "model": "lightgbm_stacked"}).json()["points"])
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
