import { Link } from 'react-router-dom';
import { useData } from '../../data/DataProvider';
import { Card, Kpi } from '../../components/Controls';
import { BarChart } from '../../components/BarChart';
import { COL, fN, fP, sum } from '../../lib/format';
import OutlookCard from './OutlookCard';

export default function Overview() {
  const { D, SEGS } = useData();
  const k = D.kpi;
  const LS = (lv: string, h: string) => D.lgsc.find((r: any) => r.level === lv && r.horizon === h) || {};
  const bfy = ['FY24', 'FY25', 'FY26', 'FY27'];
  const tot = (f: string) => D.bud.filter((b: any) => b.fy === f);
  const hz = ['M3', 'M2', 'M1'];
  void SEGS;
  return (
    <div>
      <p className="lead">A walk-through of the mock dataset. All numbers come from the synthetic dataset (157 history weeks, Oct 2023 – Sep 2026, plus a 13-week hidden test window). Use the menu on the left, filter on each screen and click rows to drill down. New here? Open the <Link to="/guide" style={{ color: 'var(--interactive, inherit)' }}>Guide</Link>.</p>
      <div className="grid g3" style={{ marginBottom: 12 }}>
        <Kpi l="LightGBM, depot rows M3" v={fP(LS('depot', 'M3').lgbm_accuracy)} d={`Sales forecast ${fP(LS('depot', 'M3').sales_forecast_accuracy)}`} />
        <Kpi l="LightGBM, depot rows M2" v={fP(LS('depot', 'M2').lgbm_accuracy)} d={`Sales forecast ${fP(LS('depot', 'M2').sales_forecast_accuracy)}`} />
        <Kpi l="LightGBM, depot rows M1" v={fP(LS('depot', 'M1').lgbm_accuracy)} d={`Sales forecast ${fP(LS('depot', 'M1').sales_forecast_accuracy)}`} />
        <Kpi l="LightGBM, national total M3" v={fP(LS('national_total', 'M3').lgbm_accuracy)} d={`Sales forecast ${fP(LS('national_total', 'M3').sales_forecast_accuracy)}`} />
        <Kpi l="LightGBM, national total M2" v={fP(LS('national_total', 'M2').lgbm_accuracy)} d={`Sales forecast ${fP(LS('national_total', 'M2').sales_forecast_accuracy)}`} />
        <Kpi l="LightGBM, national total M1" v={fP(LS('national_total', 'M1').lgbm_accuracy)} d={`Sales forecast ${fP(LS('national_total', 'M1').sales_forecast_accuracy)}`} />
      </div>
      <div className="grid g3" style={{ marginBottom: 12 }}>
        <Kpi l="Replenishment OTIF" v={fP(D.rep.total.otif)} d={`On time ${fP(D.rep.total.on_time)} · in full ${fP(D.rep.total.in_full)}`} />
        <Kpi l="Quick-commerce OTIF" v={fP(k.qc_otif)} d={`Over-ordering ${k.qc_over}× true demand`} />
        <Kpi l="Depot fill rate" v={fP(k.fill)} d="quantity received ÷ ordered" />
      </div>
      <div className="grid g3" style={{ marginBottom: 12 }}>
        <Kpi l="Sales challenge flags" v={fP(k.flagN)} d={`national product-weeks · Kolkata ${fP(k.flagK)}`} />
        <Kpi l="Procurement challenge flags" v={fP(k.sflagN)} d="national product-weeks" />
      </div>
      <OutlookCard />
      <div className="grid g2" style={{ marginBottom: 12 }}>
        <Card title="Budget vs actual sales by financial year (₹ Cr)" note="FY24 and FY27 are part years (26 weeks in the data window). Home care starts Dec 2025.">
          <BarChart cfg={{ id: 'ovb', title: 'Budget vs actual sales', cats: bfy, h: 240, yfmt: (v) => fN(v),
            series: [{ name: 'Budget', color: COL(0), data: bfy.map((f) => sum(tot(f).map((b: any) => b.budget_cr))) }, { name: 'Actual sales', color: COL(1), data: bfy.map((f) => sum(tot(f).map((b: any) => b.sales_cr))) }] }} />
        </Card>
        <Card title="LightGBM vs sales forecast, by horizon" note="52-week rolling backtest, weekly grain: 1 − Σ|forecast−actual| ÷ Σ actual.">
          <BarChart cfg={{ id: 'ova2', title: 'Accuracy by horizon', cats: hz, h: 240, ymax: 1, yfmt: (v) => fP(v, 0), tfmt: (v) => fP(v),
            series: [{ name: 'LightGBM · depot rows', color: COL(1), data: hz.map((h) => LS('depot', h).lgbm_accuracy) }, { name: 'Sales forecast · depot rows', color: COL(5), data: hz.map((h) => LS('depot', h).sales_forecast_accuracy) },
              { name: 'LightGBM · national total', color: COL(0), data: hz.map((h) => LS('national_total', h).lgbm_accuracy) }, { name: 'Sales forecast · national total', color: COL(2), data: hz.map((h) => LS('national_total', h).sales_forecast_accuracy) }] }} />
        </Card>
      </div>
    </div>
  );
}
