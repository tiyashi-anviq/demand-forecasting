import { useData } from '../../data/DataProvider';
import { Card, Ctl, Kpi, SelectCtl, SegCtl } from '../../components/Controls';
import { LineChart } from '../../components/LineChart';
import { BarChart } from '../../components/BarChart';
import { DataTable } from '../../components/DataTable';
import { COL, dlabOf, fK, fN, fP, fS } from '../../lib/format';
import type { NpProps } from './helpers';

export default function Vap({ np, setNp }: NpProps) {
  const { D, W, NH, LABELS } = useData();
  const cs = np.case, cr = D.vcase.filter((r: any) => r.geography === cs), sm = D.vsum.filter((r: any) => r.geography === cs);
  const brands = ['Eveready mosquito vaporizer line', 'Competitor V1 (category leader)', 'Competitor V2', 'Competitor V3', 'Regional / unbranded'];
  const bcol: Record<string, string> = {}; brands.forEach((x, i) => (bcol[x] = COL(i)));
  const M: Record<string, [string, (v: number) => string]> = {
    volume_share_pct: ['Volume share', (v) => fP(v)], avg_price_per_refill_inr: ['Price per refill (₹)', (v) => fN(v, 0)], weighted_distribution_pct: ['Weighted distribution', (v) => fP(v)],
    numeric_distribution_pct: ['Numeric distribution', (v) => fP(v)], promo_intensity_pct: ['Promotion intensity', (v) => fP(v)], volume_units: ['Volume (refills)', fK] };
  const L = W.indexOf(cr[0].week_start), i0 = W.indexOf('2024-12-30');
  const best = sm.filter((r: any) => r.window === 'all 26 weeks');
  const wins = ['weeks 0-5 (launch)', 'weeks 6-12', 'weeks 13-25', 'all 26 weeks'], mets = ['A. Company plan', 'B. Market share at launch', 'C. B recalibrated weekly (4-week lag)'];
  const sections = [...new Set<string>(D.vpack.map((r: any) => r.section))];
  return (
    <div>
      <h3 style={{ margin: '4px 0 6px' }}>Mosquito vaporizer — forecast with no history, vs market incumbents</h3>
      <p className="lead">New-product forecasting with no own history. At the planned launch date only the market panel, plan and pack were known. Compare three methods against what actually happened: <b>A</b> company plan, <b>B</b> market-share build (category forecast × planned distribution × listing ramp × reference velocity), <b>C</b> B recalibrated weekly using actuals older than 4 weeks.</p>
      <Ctl>
        <SegCtl label="Level" items={[['National', 'National'], ['Kolkata', 'Kolkata']]} value={cs} onChange={(v) => setNp({ case: v, geo: v })} />
        <SelectCtl label="Market metric" items={Object.entries(M).map(([k, v]) => [k, v[0]])} value={np.metric} onChange={(v) => setNp({ metric: v })} />
      </Ctl>
      <div className="grid g3" style={{ marginBottom: 12 }}>
        {best.map((r: any) => <Kpi key={r.method} l={r.method.split('.')[0] + '. ' + r.method.split('. ')[1]} v={fP(r.accuracy_pct)} d={`Forecast ${fN(r.forecast_units)} vs actual ${fN(r.actual_units)} (${fS(r.bias_pct, 0)})`} cls={r.accuracy_pct > 0.5 ? 'pos' : r.accuracy_pct > 0.2 ? '' : 'neg'} />)}
      </div>
      <div className="grid g2" style={{ marginBottom: 12 }}>
        <Card title="Launch forecast case — weeks 0-25" note="Planned launch 2 Jun 2025, actual 9 Jun (monsoon delay, incumbent counter-promotion).">
          <LineChart cfg={{ id: 'vcs', h: 280, title: 'Launch forecast case', labels: cr.map((r: any) => 'Wk ' + r.weeks_since_launch), tipLabels: cr.map((r: any) => 'Wk ' + r.weeks_since_launch + ' · ' + dlabOf(r.week_start)),
            series: [{ name: 'Actual', color: COL(0), data: cr.map((r: any) => r.actual_units), w: 2.6 }, { name: 'A. Company plan', color: COL(2), data: cr.map((r: any) => r.forecast_a_company_plan), dash: true },
              { name: 'B. Market share at launch', color: COL(1), data: cr.map((r: any) => r.forecast_b_market_share_at_launch) }, { name: 'C. Recalibrated weekly', color: COL(6), data: cr.map((r: any) => r.forecast_c_recalibrated_weekly) }] }} />
        </Card>
        <Card title={'Market panel — ' + M[np.metric][0]} note="All five brands, weekly, from Dec 2024.">
          <LineChart cfg={{ id: 'vmk', h: 280, title: 'Market panel', labels: LABELS.slice(i0, NH), yfmt: M[np.metric][1], tfmt: M[np.metric][1], yzero: np.metric !== 'avg_price_per_refill_inr', marks: [{ i: L - i0, label: 'Launch' }],
            series: brands.map((br, i) => ({ name: br.replace('Eveready mosquito vaporizer line', 'Eveready vaporizer'), color: bcol[br], data: (D.vap[cs + '|' + br]?.[np.metric] || []).slice(i0, NH), w: br.startsWith('Eve') ? 2.8 : 1.8 })) }} />
        </Card>
      </div>
      <div className="grid g2">
        <Card title="Accuracy by window and method">
          <BarChart cfg={{ id: 'vsm', h: 240, ymax: 1, cats: wins, yfmt: (v) => fP(v, 0), tfmt: (v) => fP(v),
            series: mets.map((m, i) => ({ name: m, color: [COL(2), COL(1), COL(6)][i], data: wins.map((w) => sm.find((r: any) => r.window === w && r.method === m)?.accuracy_pct) })) }} />
        </Card>
        <Card title="Pre-launch information pack">
          <div className="ctl" style={{ padding: '4px 6px', border: 0, margin: '0 0 6px' }}>
            <SelectCtl label="Section" all="All sections" items={sections.map((x) => [x, x])} value={np.pack} onChange={(v) => setNp({ pack: v })} />
          </div>
          <DataTable per={9} search rows={D.vpack.filter((r: any) => np.pack === 'ALL' || r.section === np.pack)} cols={[
            { k: 'item', l: 'Item' }, { k: 'geography', l: 'Geo' },
            { k: 'value', l: 'Value', n: true, f: (v, r) => (typeof v === 'number' ? (r.unit.startsWith('share') ? fP(v) : r.unit === 'ratio' ? v.toFixed(3) : Number.isInteger(v) ? fN(v) : v.toFixed(2)) : v) },
            { k: 'unit', l: 'Unit' },
          ]} />
        </Card>
      </div>
    </div>
  );
}
