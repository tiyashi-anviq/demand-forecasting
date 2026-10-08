import { natIds, kolIds } from '../../xai/api';
import { useMemo } from 'react';
import { useData } from '../../data/DataProvider';
import { useLevers, useTabState } from '../../state/AppState';
import { Card, Chip, Ctl, Kpi, SegCtl, SelectCtl } from '../../components/Controls';
import { LineChart } from '../../components/LineChart';
import { BarChart } from '../../components/BarChart';
import { COL, addArr, fN, fP, fS, sum } from '../../lib/format';
import { RowTable } from './RowTable';
import { ReportButton } from '../../report/ReportButton';

const LGK = ['a', 'f3', 'f2', 'f1', 'sb', 'bu', 'ly', 'fl', 'sfl', 'lg3', 'lg2', 'lg1', 'lt', 'lt10', 'lt90'];
const LEVK = new Set(['lt', 'lt10', 'lt90']);
const HLG: Record<string, string> = { f3: 'lg3', f2: 'lg2', f1: 'lg1' };
const HN: Record<string, string> = { f3: 'M3 · 13 wk ahead', f2: 'M2 · 9 wk ahead', f1: 'M1 · 4 wk ahead' };
const LV: Record<string, string> = { depot: 'Kolkata depot rows', national: 'National rows', national_total: 'National total (sum of products)' };

/** accuracy over the LightGBM backtest weeks only (rows where lg data exists), so all methods are scored on the same weeks */
function accOf(a: any[], fc: any[], NH: number, mask?: any[]) {
  let e = 0, t = 0, u = 0, o = 0;
  for (let i = 0; i < NH; i++) {
    if (a[i] == null || fc[i] == null || (mask && mask[i] == null)) continue;
    const d = fc[i] - a[i]; e += Math.abs(d); t += a[i]; d < 0 ? (u -= d) : (o += d);
  }
  return { acc: t ? Math.max(0, 1 - e / t) : null, bias: t ? (o - u) / t : null, u, o, t };
}
const gainCell = (v: number | null) => v == null ? '–' : <span className={v >= 0 ? 'pos' : 'neg'}>{v >= 0 ? '+' : ''}{(v * 100).toFixed(1)}</span>;

export default function Forecast() {
  const { D, W, NH, LABELS, CATS, SEGS, PM, prodsIn, nameOf } = useData();
  const lv = useLevers();
  const [lvl, setLvl] = useTabState('fc:lvl', 'N');
  const [depot, setDepot] = useTabState('fc:depot', 'ALL');
  const [seg, setSeg] = useTabState('fc:seg', 'ALL');
  const [cat, setCat] = useTabState('fc:cat', 'ALL');
  const [prod, setProd] = useTabState('fc:prod', 'ALL');
  const [h, setH] = useTabState('fc:h', 'f3');
  const BT = D.lgbt, lgk = HLG[h];
  const ps = prodsIn(seg, cat);
  const dep = Object.entries(D.dep) as [string, string][];
  const depKeys = depot === 'ALL' ? Object.keys(D.dep) : [depot];
  const seriesOf = (id: string) => (lvl === 'N' ? [D.nat[id]] : depKeys.map((d) => D.kol[d + '|' + id]));

  const reportIds = (() => { const pids = (prod !== 'ALL' && PM[prod] ? [PM[prod]] : ps).map((p: any) => p.id); return lvl === 'N' ? natIds(pids) : kolIds(depKeys, pids); })();

  const A = useMemo(() => {
    const sel = prod !== 'ALL' && PM[prod] ? [PM[prod]] : prodsIn(seg, cat);
    const out: Record<string, any> = { lt0: [] };
    LGK.forEach((k) => (out[k] = []));
    sel.forEach((p) => seriesOf(p.id).forEach((o) => {
      LGK.forEach((k) => addArr(out[k], LEVK.has(k) ? lv.adj(o[k], p.id) : o[k]));
      addArr(out.lt0, o.lt);
    }));
    out.n = sel.length;
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [D, lvl, depot, seg, cat, prod, lv]);

  const M = A[lgk], acc = (k: string) => accOf(A.a, A[k], NH, M);
  const L = acc(lgk), SF = acc(h), SB = acc('sb');
  const flc = sum(A.fl.slice(0, NH)), sfc = sum(A.sfl.slice(0, NH)), den = A.n * NH * (lvl === 'K' && depot === 'ALL' ? 5 : 1);
  const gain = ((L.acc ?? 0) - (SF.acc ?? 0)) * 100;

  const lgLine = A[lgk].map((v: any, i: number) => (v != null ? v : A.lt[i]));
  const ser: any[] = [{ name: 'Actual demand', color: COL(0), data: A.a, w: 2.4 }, { name: 'LightGBM forecast (' + h.replace('f', 'M') + ')', color: COL(1), data: lgLine, w: 2.4 }];
  if (lv.active) ser.push({ name: 'LightGBM base case (no levers)', color: COL(1), data: A.a.map((_: any, i: number) => (i >= NH ? A.lt0[i] : null)), dash: true, w: 1.6 });
  ser.push({ name: 'LightGBM P10', color: COL(7), data: A.lt10, dash: true, w: 1.2 }, { name: 'LightGBM P90', color: COL(7), data: A.lt90, dash: true, w: 1.2 },
    { name: 'Sales forecast', color: COL(5), data: A[h].map((v: any, i: number) => (i >= BT.i0 ? v : null)), dash: true },
    { name: 'Seasonal baseline', color: COL(6), data: A.sb.map((v: any, i: number) => (i >= BT.i0 ? v : null)), dash: true },
    { name: 'Budget', color: COL(2), data: A.bu.map((v: any, i: number) => (i >= BT.i0 ? v : null)), dash: true });
  if (lv.lev.avail < 100) ser.push({ name: 'Supply-constrained sales', color: COL(3), data: A.lt.map((v: any, i: number) => (i >= NH && v != null ? v * lv.lev.avail / 100 : null)), w: 2 });

  const hk = ['f3', 'f2', 'f1'];
  const uo = hk.map((k) => accOf(A.a, A[HLG[k]], NH, A[HLG[k]]));

  const catRows = CATS.map((c) => {
    const ids = D.prods.filter((p: any) => p.cat === c && (seg === 'ALL' || p.seg === seg)).map((p: any) => p.id);
    if (!ids.length) return null;
    const o: Record<string, any> = {}; LGK.forEach((k) => (o[k] = []));
    ids.forEach((id: string) => seriesOf(id).forEach((s) => LGK.forEach((k) => addArr(o[k], s[k]))));
    return { c, l: accOf(o.a, o[lgk], NH, o[lgk]).acc, s: accOf(o.a, o[h], NH, o[lgk]).acc };
  }).filter(Boolean) as { c: string; l: number | null; s: number | null }[];

  const rows = prodsIn(seg, cat).map((p) => {
    const o: Record<string, any> = {}; LGK.forEach((k) => (o[k] = []));
    seriesOf(p.id).forEach((s) => LGK.forEach((k) => addArr(o[k], s[k])));
    const x = accOf(o.a, o[lgk], NH, o[lgk]), y = accOf(o.a, o[h], NH, o[lgk]), z = accOf(o.a, o.sb, NH, o[lgk]);
    return { id: p.id, name: p.name, cat: p.cat, units: x.t, acc: x.acc, bias: x.bias, sales: y.acc, seas: z.acc, gain: x.acc == null || y.acc == null ? null : x.acc - y.acc };
  }).filter((r) => r.acc != null);
  const prCols = useMemo(() => [
    { k: 'name', l: 'Product' }, { k: 'cat', l: 'Category' }, { k: 'units', l: 'Actual units', n: true, f: (v: number) => fN(v) },
    { k: 'acc', l: 'LightGBM', n: true, f: (v: number) => fP(v) }, { k: 'bias', l: 'Bias', n: true, f: (v: number) => fS(v) },
    { k: 'sales', l: 'Sales forecast', n: true, f: (v: number) => fP(v) }, { k: 'seas', l: 'Seasonal', n: true, f: (v: number) => fP(v) },
    { k: 'gain', l: 'Gain (pts)', n: true, f: gainCell }], []);

  const sc = D.lgsc.map((r: any) => ({ lv: LV[r.level], h: r.horizon, l: r.lgbm_accuracy, s: r.sales_forecast_accuracy, b: r.seasonal_accuracy, g: r.lgbm_accuracy - r.sales_forecast_accuracy }));
  const vaCols = useMemo(() => [{ k: 'lv', l: 'Level' }, { k: 'h', l: 'Horizon' }, { k: 'l', l: 'LightGBM', n: true, f: (v: number) => fP(v) },
    { k: 's', l: 'Sales fcst', n: true, f: (v: number) => fP(v) }, { k: 'b', l: 'Seasonal', n: true, f: (v: number) => fP(v) }, { k: 'g', l: 'Gain (pts)', n: true, f: gainCell }], []);
  const wk = [1, 2, 3, 4].map((w) => {
    const a = D.lgwin.find((x: any) => x.window === w);
    const r: any = { win: `Window ${w} · ${LABELS[W.indexOf(a.from)]} – ${LABELS[W.indexOf(a.to)]}` };
    ['M3', 'M2', 'M1'].forEach((hh) => (r[hh] = D.lgwin.find((x: any) => x.window === w && x.horizon === hh).acc));
    return r;
  }).reverse();
  const wkCols = useMemo(() => [{ k: 'win', l: 'Window' }, { k: 'M3', l: 'M3', n: true, f: (v: number) => fP(v) }, { k: 'M2', l: 'M2', n: true, f: (v: number) => fP(v) }, { k: 'M1', l: 'M1', n: true, f: (v: number) => fP(v) }], []);

  const fr = (D.rs as any[]).filter((r) => r[0] === lvl && (prod === 'ALL' || r[1] === prod) && ((seg === 'ALL' && cat === 'ALL') || ps.some((p) => p.id === r[1])) && (lvl === 'N' || depot === 'ALL' || r[2] === depot))
    .map((r) => ({ week: W[r[3]], wi: r[3], prod: nameOf(r[1]), dep: r[2] === 'ALL' ? 'National' : (D.dep[r[2]] || r[2]), kind: r[4] ? 'Sales' : 'Procurement', why: r[4] || r[5] }));
  const flCols = useMemo(() => [{ k: 'week', l: 'Week' }, { k: 'kind', l: 'Type', f: (v: string) => <span className={'chip ' + (v === 'Sales' ? 'warn' : 'bad')}>{v}</span>, txt: (v: string) => v },
    { k: 'prod', l: 'Product' }, { k: 'dep', l: 'Grain' }, { k: 'why', l: 'Reason' }], []);

  return (
    <div>
      <p className="lead">A LightGBM model forecasts every product at national level and at each Kolkata depot, 13, 9 and 4 weeks ahead. It was backtested on the last 52 weeks of history ({LABELS[BT.i0]} – {LABELS[BT.i1]}), always trained only on data before each window, and then forecasts the hidden Oct–Dec 2026 window. The sales team's forecast and a seasonal baseline are scored on the same weeks for comparison.</p>
      <Ctl>
        <SegCtl label="Level" items={[['N', 'National'], ['K', 'Kolkata depots']]} value={lvl} onChange={(v) => { setLvl(v); setDepot('ALL'); }} />
        {lvl === 'K' && <SelectCtl label="Depot" items={dep} value={depot} all="All 5 depots" onChange={setDepot} />}
        <SelectCtl label="Segment" items={SEGS.map((s) => [s, s])} value={seg} all="All segments" onChange={(v) => { setSeg(v); setCat('ALL'); setProd('ALL'); }} />
        <SelectCtl label="Category" items={CATS.filter((c) => seg === 'ALL' || D.prods.some((p: any) => p.cat === c && p.seg === seg)).map((c) => [c, c])} value={cat} all="All categories" onChange={(v) => { setCat(v); setProd('ALL'); }} />
        <SelectCtl label="Product" items={ps.map((p) => [p.id, p.name])} value={prod} all="All products" onChange={setProd} />
        <SegCtl label="Horizon" items={[['f3', 'M3 · 13 wk'], ['f2', 'M2 · 9 wk'], ['f1', 'M1 · 4 wk']]} value={h} onChange={setH} />
        <ReportButton ids={reportIds} title={lvl === 'N' ? 'National' : depot === 'ALL' ? 'Kolkata depots (all 5)' : 'Kolkata · ' + (D.dep[depot] || depot)}
          scope={prod !== 'ALL' && PM[prod] ? PM[prod].name : cat !== 'ALL' ? cat : seg !== 'ALL' ? seg : 'All products'} />
      </Ctl>
      <div className="grid g4" style={{ marginBottom: 12 }}>
        <Kpi l="LightGBM accuracy" v={fP(L.acc)} d={HN[h] + ' · backtest'} />
        <Kpi l="Sales forecast, same weeks" v={fP(SF.acc)} d={<span className={gain >= 0 ? 'pos' : 'neg'}>LightGBM {gain >= 0 ? '+' : ''}{gain.toFixed(1)} pts</span>} />
        <Kpi l="Seasonal baseline, same weeks" v={fP(SB.acc)} d={`LightGBM bias ${fS(L.bias)}`} />
        <Kpi l="Sales / procurement flags" v={`${fP(flc / den)} / ${fP(sfc / den)}`} d="share of product-weeks flagged" />
      </div>
      <Card id="fch" style={{ marginBottom: 12 }} title={<>Actual vs LightGBM forecast <Chip>{prod !== 'ALL' ? nameOf(prod) : 'selection'}</Chip></>}
        note="LightGBM is shown for the backtest weeks (last 52) and for the hidden test window, where actuals are withheld and the P10–P90 range is shown. Click legend items to hide lines.">
        <LineChart cfg={{ id: 'fc2', title: 'Actual vs LightGBM forecast', labels: LABELS, series: ser, h: 220,
          explain: { weeks: W, scope: (prod !== 'ALL' ? nameOf(prod) : 'selection') + (lvl === 'N' ? ' · national' : depot === 'ALL' ? ' · all depots' : ' · ' + depot), ids: (() => { const pids = (prod !== 'ALL' && PM[prod] ? [PM[prod]] : prodsIn(seg, cat)).map((x: any) => x.id); return lvl === 'N' ? natIds(pids) : kolIds(depKeys, pids); })() },
          bands: [{ i0: BT.i0, i1: BT.i1, fill: 'var(--shade-info)', label: 'Backtest', tip: 'LightGBM backtest week' }, { i0: NH, i1: W.length - 1, label: 'Hidden test window', tip: 'Hidden test window (actuals withheld)' }] }} />
      </Card>
      <div className="grid g2" style={{ marginBottom: 12 }}>
        <Card title="Under- vs over-forecast by horizon" note="LightGBM units missed, backtest weeks.">
          <BarChart cfg={{ id: 'fuo2', title: 'Under- vs over-forecast', cats: ['M3', 'M2', 'M1'], stack: true, h: 220,
            series: [{ name: 'Under-forecast (missed demand)', color: COL(1), data: uo.map((x) => x.u) }, { name: 'Over-forecast (excess)', color: COL(0), data: uo.map((x) => x.o) }] }} />
        </Card>
        <Card title={`Accuracy by category · ${HN[h]}`} note="LightGBM vs the sales forecast, backtest weeks.">
          <BarChart cfg={{ id: 'fcat2', title: 'Accuracy by category', cats: catRows.map((r) => r.c.replace('Batteries — ', 'Bat. ').replace('Lighting — ', 'Ltg. ')), rot: true, h: 260, ymax: 1, yfmt: (v) => fP(v, 0), tfmt: (v) => fP(v),
            series: [{ name: 'LightGBM', color: COL(1), data: catRows.map((r) => r.l) }, { name: 'Sales forecast', color: COL(5), data: catRows.map((r) => r.s) }] }} />
        </Card>
      </div>
      <Card style={{ marginBottom: 12 }} title={<>Product ranking <span className="muted small">— click a row to drill down</span></>}
        note={'Backtest accuracy at the selected horizon; lowest first by default. "Gain" = LightGBM minus the sales forecast, in percentage points. The five new products (NPD) score poorly because there is no history; they need the new-product method.'}>
        <RowTable cols={prCols} rows={rows} sort="acc" dir={1} per={10} search onRow={(r) => { setProd(r.id); }} />
      </Card>
      <div className="grid g2" style={{ marginBottom: 12 }}>
        <Card id="fva" title="Does LightGBM beat the sales forecast?" note="Accuracy over the 52-week rolling backtest.">
          <RowTable cols={vaCols} rows={sc} per={9} />
        </Card>
        <Card title="Stability across four 13-week windows" note="LightGBM accuracy, all depot and national rows, by backtest window.">
          <RowTable cols={wkCols} rows={wk} per={6} />
        </Card>
      </div>
      <Card style={{ marginBottom: 12 }} title="What drives the LightGBM forecast" note="Share of total model gain, all horizons. The stacked model leans mostly on the sales team's own forecast (log_sales_fc), then the budget and the seasonal baseline, so treat accuracy as a best case: it is only as good as the plan it corrects. Test it without those columns before trusting it on real data.">
        <BarChart cfg={{ id: 'fim', title: 'Feature importance', cats: D.lgimp.map((r: any) => r.feature), rot: true, h: 240, yfmt: (v) => fP(v, 0), tfmt: (v) => fP(v),
          series: [{ name: 'Share of gain', color: COL(0), data: D.lgimp.map((r: any) => r.share) }] }} />
      </Card>
      <Card id="ffl" title={<>Challenge flags <span className="muted small">— sales and procurement</span></>}
        note="Flags are raised on the sales team's forecast, not on LightGBM. Sales flag: >2.5σ off budget and last year, or a stock rule. Procurement flag: 4-week ask >2.5σ above max(budget, last year) or >5 weeks cover.">
        <RowTable cols={flCols} rows={fr} sort="week" dir={-1} per={12} search />
      </Card>
    </div>
  );
}
