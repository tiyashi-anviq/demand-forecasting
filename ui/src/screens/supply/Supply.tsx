import { useData } from '../../data/DataProvider';
import { useTabState } from '../../state/AppState';
import { SubNav, useView } from '../../components/SubNav';
import { SelectCtl, Ctl, Card, Kpi } from '../../components/Controls';
import { LineChart } from '../../components/LineChart';
import { BarChart } from '../../components/BarChart';
import { DataTable } from '../../components/DataTable';
import { COL, fN, fP, mlab, sum } from '../../lib/format';
import Heatmap from './Heatmap';

const VIEWS: [string, string][] = [['cover', 'Depot stock & cover'], ['repl', 'Replenishment & OTIF'], ['plant', 'Plant capacity'], ['trf', 'Depot transfers'], ['moq', 'MOQ & price breaks']];
const mb = { marginBottom: 12 };

export default function Supply() {
  const [view] = useView('cover');
  return (
    <div>
      <SubNav items={VIEWS} def="cover" />
      <div style={{ marginTop: 12 }}>
        {view === 'cover' && <Cover />}
        {view === 'repl' && <Repl />}
        {view === 'plant' && <Plant />}
        {view === 'trf' && <Trf />}
        {view === 'moq' && <Moq />}
      </div>
    </div>
  );
}

function Cover() {
  const { D, NH, LABELS, nameOf } = useData();
  const [depot, setDepot] = useTabState('supply:depot', 'tar');
  const [prod, setProd] = useTabState('supply:prod', 'cvt');
  const [wk, setWk] = useTabState('supply:week', NH - 1);
  const K = D.kol[depot + '|' + prod];
  const HB = [{ i0: NH, i1: D.weeks.length - 1, label: 'Hidden test window', tip: 'Hidden test window (actuals withheld)' }];
  return (<>
    <h2>Depot stock & weeks of cover</h2>
    <p className="lead">Closing stock vs safety stock per depot and product. The heatmap shows weeks of cover for every depot × product at the chosen week; red = below 0.6 weeks (stock-out risk), blue = above 3 weeks (over-stocked).</p>
    <Ctl>
      <SelectCtl label="Depot" items={Object.entries(D.dep) as [string, string][]} value={depot} onChange={setDepot} />
      <SelectCtl label="Product" items={D.prods.map((p) => [p.id, p.name])} value={prod} onChange={setProd} />
      <label>Week for heatmap<input type="range" min={0} max={NH - 1} value={wk} onChange={(e) => setWk(+e.target.value)} style={{ width: 220 }} /><span className="small muted">{LABELS[wk]}</span></label>
    </Ctl>
    <Card style={mb} title={`${D.dep[depot]} · ${nameOf(prod)}`} note="Stock vs safety stock vs demand (units).">
      <LineChart cfg={{ id: 'sch', unit: 'Units', title: 'Stock vs safety stock', labels: LABELS, series: [
        { name: 'Closing stock', color: COL(0), data: K.cl, w: 2.4 }, { name: 'Safety stock', color: COL(1), data: K.ss, dash: true },
        { name: 'Weekly demand', color: COL(2), data: K.a }, { name: 'Opening stock', color: COL(6), data: K.os, dash: true }], bands: HB, h: 260 }} />
    </Card>
    <Card title={`Weeks of cover heatmap — ${LABELS[wk]}`} note="Click a cell to load that depot × product above.">
      <Heatmap week={wk} onPick={(d, p) => { setDepot(d); setProd(p); }} />
    </Card>
  </>);
}

function Repl() {
  const { D } = useData();
  const R = D.rep, T = R.total;
  const dl: [string, number][] = Object.entries(R.delay as Record<string, number>).sort((a, b) => b[1] - a[1]);
  const short = (s: string) => s.replace(/^; /, '').replace("Missed slot — moved to next week's slot", 'Missed slot').replace('Truck slot slipped Fri→Sat', 'Fri→Sat slip').replace('short-shipped at CFA', 'short-shipped').replace('plant capacity constrained (allocated pro-rata after P1)', 'plant capacity').slice(0, 30);
  const bars = (id: string, rows: any[]) => <BarChart cfg={{ id, unit: '% of orders', cats: rows.map((r) => r.k), series: [{ name: 'OTIF', color: COL(0), data: rows.map((r) => r.otif) }, { name: 'Fill rate', color: COL(2), data: rows.map((r) => r.fill) }], yfmt: (v) => fP(v, 0), tfmt: (v) => fP(v), ymax: 1, h: 220 }} />;
  return (<>
    <h2>Replenishment & OTIF</h2>
    <p className="lead">Depot replenishment orders on the Friday/Saturday truck schedule. OTIF = on time AND in full. Delay reasons come from missed slots, Fri→Sat slips, plant capacity and short-shipping at the CFA.</p>
    <div className="grid g4" style={mb}>
      <Kpi l="OTIF" v={fP(T.otif)} d={`${fN(T.n)} order lines`} /><Kpi l="On time" v={fP(T.on_time)} d="" />
      <Kpi l="In full" v={fP(T.in_full)} d="" /><Kpi l="Fill rate" v={fP(T.fill)} d={`Lead time ${T.lead} wk avg`} />
    </div>
    <div className="grid g2" style={mb}>
      <Card title="Monthly OTIF, on-time and in-full">
        <LineChart cfg={{ id: 'rm', unit: '% of orders', title: 'Monthly OTIF', labels: R.monthly.map((r: any) => mlab(r.m)), series: [
          { name: 'OTIF', color: COL(0), data: R.monthly.map((r: any) => r.otif), w: 2.4 }, { name: 'On time', color: COL(2), data: R.monthly.map((r: any) => r.on_time) },
          { name: 'In full', color: COL(1), data: R.monthly.map((r: any) => r.in_full) }], yfmt: (v) => fP(v, 0), tfmt: (v) => fP(v), yzero: false, h: 260 }} />
      </Card>
      <Card title="Why orders were late or short" note="Count of order lines by delay reason.">
        <BarChart cfg={{ id: 'rd', unit: 'Order lines', title: 'Delay reasons', cats: dl.map((x) => short(x[0])), series: [{ name: 'Order lines', color: COL(1), data: dl.map((x) => x[1]) }], rot: true, h: 260,
          tipExtra: (c) => <div className="muted">{dl[c][0].replace(/^; /, '')}</div> }} />
      </Card>
    </div>
    <div className="grid g3" style={mb}>
      <Card title="By depot">{bars('rdp', R.depot)}</Card>
      <Card title="By truck slot">{bars('rsl', R.slot)}</Card>
      <Card title="Planned vs actual day"><BarChart cfg={{ id: 'rdy', unit: 'Order lines', title: 'Planned vs actual day', cats: R.day.map((r: any) => r[0] + '→' + r[1]), series: [{ name: 'Order lines', color: COL(6), data: R.day.map((r: any) => r[2]) }], h: 220, rot: true }} /></Card>
    </div>
    <Card title="By category">
      <DataTable rows={R.cat} sort="otif" dir={1} per={11} cols={[{ k: 'k', l: 'Category' }, { k: 'n', l: 'Lines', n: true, f: (v) => fN(v) }, { k: 'otif', l: 'OTIF', n: true, f: (v) => fP(v) }, { k: 'on_time', l: 'On time', n: true, f: (v) => fP(v) }, { k: 'in_full', l: 'In full', n: true, f: (v) => fP(v) }, { k: 'fill', l: 'Fill', n: true, f: (v) => fP(v) }]} />
    </Card>
  </>);
}

function Plant() {
  const { D, NH, LABELS, nameOf } = useData();
  const [p, setP] = useTabState('supply:prod', 'cvt');
  const N = D.nat[p];
  const idx = LABELS.map((_, i) => i).filter((i) => i % 8 === 0 && i < NH);
  const stk = (id: string, ser: [string, any[], number][]) => <BarChart cfg={{ id, unit: 'Units', title: id, stack: true, cats: idx.map((i) => LABELS[i]), series: ser.map(([n, a, c]) => ({ name: n, color: COL(c), data: idx.map((i) => a[i]) })), h: 240, rot: true }} />;
  const HB = [{ i0: NH, i1: D.weeks.length - 1, label: 'Hidden test window', tip: 'Hidden test window (actuals withheld)' }];
  return (<>
    <h2>Plant capacity & allocation</h2>
    <p className="lead">When asks exceed plant capacity, supply is allocated B2C first, then Plant 1 (P1), then Plant 2 (P2) — an assumption in the model. The gap shows up as lost sales.</p>
    <Ctl><SelectCtl label="Product" items={D.prods.map((x) => [x.id, x.name])} value={p} onChange={setP} /></Ctl>
    <Card style={mb} title={`Production vs capacity · ${nameOf(p)}`}>
      <LineChart cfg={{ id: 'pc1', unit: 'Units per week', title: 'Production vs capacity', labels: LABELS, series: [
        { name: 'Production ask', color: COL(1), data: N.pr }, { name: 'Capacity', color: COL(0), data: N.pc, dash: true },
        { name: 'Allocated', color: COL(2), data: N.pa, w: 2.4 }, { name: 'Demand', color: COL(6), data: N.a }], bands: HB, h: 260 }} />
    </Card>
    <div className="grid g2">
      <Card title="Allocation by channel">{stk('pc2', [['B2C', N.b2c, 0], ['P1', N.p1, 1], ['P2', N.p2, 2]])}</Card>
      <Card title="Lost sales by channel">{stk('pc3', [['B2C', N.lb2c, 0], ['P1', N.lp1, 1], ['P2', N.lp2, 2]])}</Card>
    </div>
  </>);
}

function Trf() {
  const { D } = useData();
  const rows = D.trf.map((r: any) => ({ week: r[0], pid: r[1], prod: r[2], from: r[3], fcov: r[4], to: r[5], tcov: r[6], units: r[7], val: r[8], exp: r[9], slot: r[10] }));
  return (<>
    <h2>Depot-to-depot transfers</h2>
    <p className="lead">Surplus stock at one depot is moved to a depot running short, rather than waiting for the next plant order. {fN(rows.length)} transfers in the history window.</p>
    <div className="grid g3" style={mb}><Kpi l="Transfers" v={fN(rows.length)} /><Kpi l="Units moved" v={fN(sum(rows.map((r: any) => r.units)))} /><Kpi l="Value moved" v={fN(sum(rows.map((r: any) => r.val))) + ' ₹'} /></div>
    <Card><DataTable rows={rows} sort="week" dir={-1} per={14} search cols={[{ k: 'week', l: 'Week' }, { k: 'prod', l: 'Product' }, { k: 'from', l: 'From' }, { k: 'fcov', l: 'Cover (wk)', n: true }, { k: 'to', l: 'To' }, { k: 'tcov', l: 'Cover (wk)', n: true }, { k: 'units', l: 'Units', n: true, f: (v) => fN(v) }, { k: 'val', l: 'Value ₹', n: true, f: (v) => fN(v) }, { k: 'slot', l: 'Day' }]} /></Card>
  </>);
}

function Moq() {
  const { D } = useData();
  const M = D.moq, cap = sum(M.src.map((r: any) => r.captured)), fg = sum(M.src.map((r: any) => r.foregone)), ms = sum(M.src.map((r: any) => r.missed)), lots = sum(M.src.map((r: any) => r.lots));
  return (<>
    <h2>MOQ and price-break economics</h2>
    <p className="lead">Minimum order quantity (MOQ) is the smallest lot a supplier will make. A bigger lot (the price-break quantity) earns a discount. <b>Captured</b> = discount earned on lots at or above the break; <b>foregone</b> = discount missed when a lot fell short of the break.</p>
    <div className="grid g4" style={mb}>
      <Kpi l="Captured" v={fN(cap) + ' ₹'} /><Kpi l="Foregone" v={fN(fg) + ' ₹'} />
      <Kpi l="Lots taken at break" v={fP(1 - ms / lots)} d={`${fN(ms)} of ${fN(lots)} lots missed`} /><Kpi l="Capture rate" v={fP(cap / (cap + fg))} d="by value" />
    </div>
    <div className="grid g2" style={mb}>
      <Card title="Monthly savings (₹)"><BarChart cfg={{ id: 'mm', unit: 'Savings (₹)', title: 'Monthly savings', cats: M.month.map((r: any) => mlab(r.m)), rot: true, stack: true, h: 260, series: [{ name: 'Captured', color: COL(2), data: M.month.map((r: any) => r.captured) }, { name: 'Foregone', color: COL(1), data: M.month.map((r: any) => r.foregone) }] }} /></Card>
      <Card title="By supply source"><BarChart cfg={{ id: 'ms', unit: 'Savings (₹)', title: 'By supply source', cats: M.src.map((r: any) => r.k), h: 260, series: [{ name: 'Captured', color: COL(2), data: M.src.map((r: any) => r.captured) }, { name: 'Foregone', color: COL(1), data: M.src.map((r: any) => r.foregone) }] }} /></Card>
    </div>
    <Card title="By product"><DataTable rows={M.prod} sort="foregone" per={10} search cols={[{ k: 'name', l: 'Product' }, { k: 'src', l: 'Source' }, { k: 'moq', l: 'MOQ', n: true, f: (v) => fN(v) }, { k: 'brk', l: 'Price-break qty', n: true, f: (v) => fN(v) }, { k: 'disc', l: 'Discount', n: true, f: (v) => fP(v) }, { k: 'lots', l: 'Lots', n: true }, { k: 'missed', l: 'Missed', n: true }, { k: 'captured', l: 'Captured ₹', n: true, f: (v) => fN(v) }, { k: 'foregone', l: 'Foregone ₹', n: true, f: (v) => fN(v) }]} /></Card>
  </>);
}
