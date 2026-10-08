import { useData } from '../../data/DataProvider';
import { Card, Ctl, Kpi, SelectCtl, SegCtl } from '../../components/Controls';
import { LineChart } from '../../components/LineChart';
import { DataTable } from '../../components/DataTable';
import { COL, addArr, fN, fP } from '../../lib/format';
import type { NpProps } from './helpers';
import Vap from './Vap';

export default function Launch({ np, setNp, npds }: NpProps) {
  const { D, W, NH, LABELS } = useData();
  const r = D.npdr.find((x: any) => x.product_id === np.id);
  const L = W.indexOf(r.launch_date);
  const i0 = Math.max(0, L - 8), i1 = Math.min(W.length - 1, L + 52), sl = (a: any[]) => a.slice(i0, i1 + 1);
  const A: Record<string, (number | null)[]> = { a: [], bu: [], f1: [] };
  if (np.geo === 'National') ['a', 'bu', 'f1'].forEach((k) => (A[k] = D.nat[np.id][k]));
  else Object.keys(D.dep).forEach((d) => ['a', 'bu', 'f1'].forEach((k) => addArr(A[k], D.kol[d + '|' + np.id][k])));
  return (
    <div>
      <h2 style={{ fontSize: 20, margin: '4px 0 6px' }}>Five new product launches</h2>
      <p className="lead">How each launch ramped against its budget, with launch slip, own-portfolio sourcing and influencer support.</p>
      <Ctl>
        <SelectCtl label="Launch" items={npds.map((p) => [p.id, p.name])} value={np.id} onChange={(v) => setNp({ id: v })} />
        <SegCtl label="Level" items={[['N', 'National'], ['K', 'Kolkata']]} value={np.geo === 'Kolkata' ? 'K' : 'N'} onChange={(v) => { const g = v === 'K' ? 'Kolkata' : 'National'; setNp({ geo: g, case: g }); }} />
      </Ctl>
      <div className="grid g4" style={{ marginBottom: 12 }}>
        <Kpi l="Launch date" v={r.launch_date} d={r.launch_slip_weeks ? `${r.launch_slip_weeks} wk later than planned (${r.planned_launch_date})` : 'On plan'} />
        <Kpi l="First 13 weeks" v={fN(r.national_units_13wk)} d={`Budget ${fN(r.national_budget_units_13wk)} · ${fP(r.achievement_vs_budget_13wk, 0)} achievement`} />
        <Kpi l="First 52 weeks" v={fN(r.national_units_52wk)} d={`Kolkata ${fN(r.kolkata_units_52wk)}`} />
        <Kpi l="Sourced from own portfolio" v={fP(r.sourced_from_own_portfolio_pct_52wk, 0)} d={`Cannibalises: ${r.cannibalised_products || '–'}`} />
      </div>
      <Card title="Weekly demand vs budget" note="Lines start 8 weeks before launch. Forecast shown at M1 (4 weeks ahead)." style={{ marginBottom: 12 }}>
        <LineChart cfg={{ id: 'nch', unit: 'Units per week', labels: LABELS.slice(i0, i1 + 1), h: 280, title: 'Weekly demand vs budget',
          series: [{ name: 'Actual demand', color: COL(0), data: sl(A.a), w: 2.4 }, { name: 'Budget', color: COL(2), data: sl(A.bu), dash: true }, { name: 'Forecast (M1)', color: COL(1), data: sl(A.f1) }],
          bands: [{ i0: Math.max(0, L - i0), i1: Math.max(0, L - i0), fill: 'var(--shade-info)', label: 'Launch', tip: 'Launch week' }, ...(i1 >= NH ? [{ i0: NH - i0, i1: i1 - i0, label: 'Hidden test', tip: 'Hidden test window' }] : [])] }} />
      </Card>
      <Card title="All launches">
        <DataTable per={8} rows={D.npdr} cols={[
          { k: 'product', l: 'Launch', f: (v, row) => <button type="button" className="linkbtn" style={{ all: 'unset', cursor: 'pointer', color: 'var(--accent)', textDecoration: row.product_id === np.id ? 'none' : 'underline', fontWeight: row.product_id === np.id ? 600 : 400 }} onClick={() => setNp({ id: row.product_id })}>{v}</button> },
          { k: 'launch_date', l: 'Launched' },
          { k: 'launch_slip_weeks', l: 'Slip (wk)', n: true },
          { k: 'national_units_13wk', l: '13-wk units', n: true, f: (v) => fN(v) },
          { k: 'achievement_vs_budget_13wk', l: 'vs budget', n: true, f: (v) => fP(v, 0) },
          { k: 'lost_sales_units_13wk', l: 'Lost sales (13 wk)', n: true, f: (v) => fN(v) },
        ]} />
      </Card>
      {np.id === 'npd05' && <div style={{ marginTop: 16 }}><Vap np={np} setNp={setNp} npds={npds} /></div>}
    </div>
  );
}
