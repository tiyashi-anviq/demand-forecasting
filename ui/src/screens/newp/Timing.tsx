import { useData } from '../../data/DataProvider';
import { Card, Ctl, SelectCtl, Chip } from '../../components/Controls';
import { BarChart } from '../../components/BarChart';
import { DataTable } from '../../components/DataTable';
import { COL, fN, fP } from '../../lib/format';
import type { NpProps } from './helpers';

const MS = 'JanFebMarAprMayJunJulAugSepOctNovDec';
export default function Timing({ np, setNp, npds }: NpProps) {
  const { D } = useData();
  const rows = D.lt.filter((x: any) => x.product_id === np.id).sort((a: any, b: any) => MS.indexOf(a.launch_month) - MS.indexOf(b.launch_month));
  return (
    <div>
      <h2 style={{ fontSize: 20, margin: '4px 0 6px' }}>Launch timing — best and worst month</h2>
      <p className="lead">Each launch was re-simulated as if it had launched in every month. Bars show first-52-week units; the actual launch month is flagged.</p>
      <Ctl><SelectCtl label="Launch" items={npds.map((p) => [p.id, p.name])} value={np.id} onChange={(v) => setNp({ id: v })} /></Ctl>
      <Card style={{ marginBottom: 12 }}>
        <BarChart cfg={{ id: 'tch', h: 260, cats: rows.map((r: any) => r.launch_month), title: 'Launch timing',
          series: [{ name: 'Units, first 52 weeks', color: COL(0), data: rows.map((r: any) => r.units_first_52wk) }, { name: 'Units, first 13 weeks', color: COL(2), data: rows.map((r: any) => r.units_first_13wk) }],
          tipExtra: (c) => <div className="muted">{rows[c].verdict} · rank {rows[c].rank_52wk}/12 · {rows[c].key_demand_events_in_first_13wk || ''}{rows[c].is_actual_launch_month ? <> · <b>actual launch month</b></> : null}</div> }} />
      </Card>
      <Card>
        <DataTable per={12} rows={rows} cols={[
          { k: 'launch_month', l: 'Month' },
          { k: 'units_first_13wk', l: '13-wk units', n: true, f: (v) => fN(v) },
          { k: 'units_first_52wk', l: '52-wk units', n: true, f: (v) => fN(v) },
          { k: 'value_first_52wk_inr_cr', l: '52-wk value (₹ Cr)', n: true },
          { k: 'index_vs_best_52wk', l: 'vs best', n: true, f: (v) => fP(v, 0) },
          { k: 'verdict', l: 'Verdict', f: (v) => <Chip kind={/Best|Good/.test(v) ? 'good' : /Poor|Worst/.test(v) ? 'bad' : ''}>{v}</Chip> },
          { k: 'is_actual_launch_month', l: 'Actual', f: (v) => (v ? <b>★ actual</b> : '') },
          { k: 'key_demand_events_in_first_13wk', l: 'Events in first 13 wk' },
        ]} />
      </Card>
    </div>
  );
}
