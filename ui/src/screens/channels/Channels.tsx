import { useData } from '../../data/DataProvider';
import { useTabState } from '../../state/AppState';
import { SubNav, useView } from '../../components/SubNav';
import { SelectCtl, Ctl, Card, Kpi } from '../../components/Controls';
import { LineChart, type Band } from '../../components/LineChart';
import { BarChart } from '../../components/BarChart';
import { DataTable } from '../../components/DataTable';
import { COL, addArr, fN, fP, fS } from '../../lib/format';
import RowClickTable from './RowClickTable';

const VIEWS: [string, string][] = [['qc', 'Quick commerce'], ['mon', 'Delayed monsoon'], ['fest', 'Kolkata festivals'], ['inf', 'Influencer test'], ['comp', 'Competitor actions']];
const mb = { marginBottom: 12 };

export default function Channels() {
  const [view] = useView('qc');
  return (
    <div>
      <SubNav items={VIEWS} def="qc" />
      <div style={{ marginTop: 12 }}>
        {view === 'qc' && <QuickCommerce />}
        {view === 'mon' && <Monsoon />}
        {view === 'fest' && <Festivals />}
        {view === 'inf' && <Influencer />}
        {view === 'comp' && <Competitor />}
      </div>
    </div>
  );
}
const useHB = (): Band[] => { const { D, NH } = useData(); return [{ i0: NH, i1: D.weeks.length - 1, label: 'Hidden test window', tip: 'Hidden test window (actuals withheld)' }]; };
const prodItems = (D: any): [string, string][] => D.prods.map((p: any) => [p.id, p.name]);

function QuickCommerce() {
  const { D, NH, LABELS, nameOf } = useData();
  const HB = useHB();
  const [qc, setQc] = useTabState('chan:qc', 'NATIONAL|QC Partner A');
  const keys = Object.keys(D.qc), Q = D.qc[qc];
  const hubs = [...new Set(keys.map((k) => k.split('|')[0]))], prt = [...new Set(keys.map((k) => k.split('|')[1]))];
  const agg = (k: string) => {
    const q = D.qc[k]; let t = 0, o = 0, s = 0, ln = 0, ot = 0, ls = 0;
    for (let i = 0; i < NH; i++) { if (q.t[i] == null) continue; t += q.t[i]; o += q.o[i]; s += q.s[i]; ls += q.ls[i] || 0; ln += q.ln[i]; ot += q.ot[i]; }
    return { k, hub: k.split('|')[0], partner: k.split('|')[1], t, o, s, ratio: t ? o / t : null, fill: o ? s / o : null, otif: ln ? ot / ln : null, ls };
  };
  const rows = keys.map(agg);
  const [hh, pp] = qc.split('|');
  const me = agg(qc);
  const rt = (k: string) => Q[k].map((v: any, i: number) => (v == null || !Q.ln[i] ? null : v / Q.ln[i]));
  const pl = Object.entries(D.qcprod as Record<string, any>).map(([k, v]) => ({ k: nameOf(k), t: v.t, o: v.o, s: v.s }));
  return (<>
    <h2>Quick commerce — partners × dark-store hubs</h2>
    <p className="lead">QC partners place orders on Eveready hubs and over-order versus true consumer demand (up to ~10× at launch, decaying). OTIF is judged against what the hub could allocate, not the inflated order. Partner D goes live on 2 Nov 2026.</p>
    <Ctl>
      <SelectCtl label="Hub" items={hubs.map((h) => [h, h])} value={hh} onChange={(v) => setQc(v + '|' + pp)} />
      <SelectCtl label="Partner" items={prt.map((p) => [p, p])} value={pp} onChange={(v) => setQc(hh + '|' + v)} />
    </Ctl>
    <div className="grid g4" style={mb}>
      <Kpi l="Over-ordering" v={me.ratio ? me.ratio.toFixed(2) + '×' : '–'} d="orders ÷ true demand" />
      <Kpi l="OTIF vs allocation" v={fP(me.otif)} d="on-time and in-full" />
      <Kpi l="Shipped ÷ ordered" v={fP(me.fill)} d="low because orders are inflated" />
      <Kpi l="Lost sales" v={fN(me.ls)} d="units" />
    </div>
    <div className="grid g2" style={mb}>
      <Card title="Orders vs true demand vs shipped"><LineChart cfg={{ id: 'qa', unit: 'Units per week', title: 'Orders vs true demand vs shipped', labels: LABELS, series: [{ name: 'Orders placed', color: COL(1), data: Q.o }, { name: 'True demand', color: COL(0), data: Q.t, w: 2.4 }, { name: 'Shipped', color: COL(2), data: Q.s }], bands: HB, h: 250 }} /></Card>
      <Card title="OTIF components"><LineChart cfg={{ id: 'qb', unit: '% of orders', title: 'OTIF components', labels: LABELS, series: [{ name: 'OTIF', color: COL(0), data: rt('ot'), w: 2.4 }, { name: 'On time', color: COL(2), data: rt('on') }, { name: 'In full', color: COL(6), data: rt('if') }], yfmt: (v) => fP(v, 0), tfmt: (v) => fP(v), yzero: false, ymax: 1, h: 250 }} /></Card>
    </div>
    <div className="grid g2" style={mb}>
      <Card title="Dark-store stock & returns"><LineChart cfg={{ id: 'qd', unit: 'Units', title: 'Dark-store stock & returns', labels: LABELS, series: [{ name: 'Dark-store closing stock', color: COL(0), data: Q.cl }, { name: 'Returns', color: COL(1), data: Q.rt }], bands: HB, h: 230 }} /></Card>
      <Card title="Units by product (all hubs)"><BarChart cfg={{ id: 'qp', unit: 'Units', title: 'Units by product', cats: pl.map((x) => x.k.slice(0, 16)), rot: true, series: [{ name: 'True demand', color: COL(0), data: pl.map((x) => x.t) }, { name: 'Ordered', color: COL(1), data: pl.map((x) => x.o) }, { name: 'Shipped', color: COL(2), data: pl.map((x) => x.s) }], h: 230 }} /></Card>
    </div>
    <Card title="All partner × hub combinations">
      <RowClickTable rows={rows} rowKey="k" per={12} onRow={(r) => setQc(r.k)} cols={[{ k: 'hub', l: 'Hub' }, { k: 'partner', l: 'Partner' }, { k: 't', l: 'True demand', n: true, f: (v) => fN(v) }, { k: 'o', l: 'Ordered', n: true, f: (v) => fN(v) }, { k: 'ratio', l: 'Over-order', n: true, f: (v) => (v ? v.toFixed(2) + '×' : '–') }, { k: 'otif', l: 'OTIF', n: true, f: (v) => fP(v) }, { k: 'fill', l: 'Fill', n: true, f: (v) => fP(v) }, { k: 'ls', l: 'Lost sales', n: true, f: (v) => fN(v) }]} />
    </Card>
  </>);
}

function Monsoon() {
  const { D, LABELS, nameOf } = useData();
  const HB = useHB();
  const [p, setP] = useTabState('chan:mon', 'cvt');
  const N = D.nat[p];
  const sh: number[] = [], rc: number[] = [];
  D.cal.shock.forEach((v: number, i: number) => { if (v > 0) sh.push(i); }); D.cal.recov.forEach((v: number, i: number) => { if (v > 0) rc.push(i); });
  const rng = (a: number[]) => (a.length ? { i0: a[0], i1: a[a.length - 1] } : null);
  const bands: Band[] = [];
  const s1 = rng(sh), r1 = rng(rc);
  if (s1) bands.push({ ...s1, fill: 'var(--shade-warn)', label: 'Monsoon delay shock', tip: 'Monsoon delay shock' });
  if (r1) bands.push({ ...r1, fill: 'var(--shade-info)', label: 'Recovery', tip: 'Recovery rebound' });
  bands.push(...HB);
  return (<>
    <h2>Delayed monsoon — shock and recovery</h2>
    <p className="lead">When the monsoon arrives late, rain-sensitive demand (torches, rechargeable lights, home care) is pushed back, then partly recovers when it arrives. Shaded: shock weeks (gold) and recovery weeks (green).</p>
    <Ctl><SelectCtl label="Product" items={prodItems(D)} value={p} onChange={setP} /></Ctl>
    <div className="grid g2">
      <Card title={`Demand · ${nameOf(p)}`}><LineChart cfg={{ id: 'mo1', unit: 'Units per week', title: 'Demand', labels: LABELS, series: [{ name: 'Actual demand', color: COL(0), data: N.a, w: 2.4 }, { name: 'Last year', color: COL(3), data: N.ly, dash: true }, { name: 'Budget', color: COL(2), data: N.bu, dash: true }], bands, h: 270 }} /></Card>
      <Card title="Rainfall (mm) and mosquito/dengue index"><LineChart cfg={{ id: 'mo2', unit: 'Rainfall in mm · dengue index ×100', title: 'Rainfall and dengue index', labels: LABELS, series: [{ name: 'Rainfall (mm)', color: COL(0), data: D.cal.rain }, { name: 'Dengue index ×100', color: COL(1), data: D.cal.dengue.map((v: number) => v * 100) }], bands, h: 270, yfmt: (v) => fN(v, 0) }} /></Card>
    </div>
  </>);
}

function Festivals() {
  const { D, LABELS, nameOf } = useData();
  const HB = useHB();
  const [p, setP] = useTabState('chan:fest', 'bt20');
  const [K, setK] = useTabState('chan:fdep', 'ALL');
  const A: (number | null)[] = [];
  (K === 'ALL' ? Object.keys(D.dep) : [K]).forEach((d) => addArr(A, D.kol[d + '|' + p].a));
  const bands: Band[] = [];
  D.cal.fest.forEach((f: string, i: number) => { if (f) bands.push({ i0: i, i1: i, fill: 'var(--shade-info)', tip: f }); });
  return (<>
    <h2>Kolkata festivals</h2>
    <p className="lead">Durga Puja, Kali Puja/Diwali, Poila Baisakh and more. Depot sell-in builds before each festival. Green bars mark festival weeks; hover for the name.</p>
    <Ctl>
      <SelectCtl label="Product" items={prodItems(D)} value={p} onChange={setP} />
      <SelectCtl label="Depot" items={Object.entries(D.dep) as [string, string][]} value={K} onChange={setK} all="All 5 depots" />
    </Ctl>
    <Card style={mb} title={`Kolkata demand · ${nameOf(p)}`}><LineChart cfg={{ id: 'fe1', unit: 'Units per week', title: 'Kolkata demand', labels: LABELS, series: [{ name: 'Actual demand', color: COL(0), data: A, w: 2.4 }], bands: [...bands, ...HB], h: 260 }} /></Card>
    <Card title="Festival calendar & category lifts">
      <DataTable rows={D.fest} sort="date" dir={-1} per={10} search cols={[{ k: 'festival', l: 'Festival' }, { k: 'date', l: 'Date' }, { k: 'scope', l: 'Scope' }, { k: 'categories_lifted', l: 'Categories lifted' }, { k: 'kolkata_intensity', l: 'Kolkata', n: true }, { k: 'national_intensity', l: 'National', n: true }, { k: 'depot_sell_in_window', l: 'Depot sell-in window' }]} />
    </Card>
  </>);
}

function Influencer() {
  const { D, NH, LABELS } = useData();
  const [id, setId] = useTabState('chan:inf', 'npd01');
  const W2 = D.infw[id], r = D.inf.find((x: any) => x.product_id === id);
  const i0 = Math.max(0, W2.w0 - 6), i1 = Math.min(NH - 1, W2.w1 + 8);
  return (<>
    <h2>Influencer test vs control depots</h2>
    <p className="lead">Influencer campaigns ran only in test depots (Taratala, Barasat). Control depots (Dankuni, Barrackpore, Baruipur) show what would have happened anyway; the gap is the lift.</p>
    <Ctl><SelectCtl label="Campaign" items={D.inf.filter((x: any, i: number, a: any[]) => a.findIndex((y) => y.product_id === x.product_id) === i).map((x: any) => [x.product_id, x.product])} value={id} onChange={setId} /></Ctl>
    <div className="grid g4" style={mb}>
      <Kpi l="Lift vs control" v={fS(r.influencer_lift_pct, 0)} d="units per share point" />
      <Kpi l="Incremental units" v={fN(r.incremental_units_test_depots)} d="test depots" />
      <Kpi l="Spend" v={r.kolkata_influencer_spend_inr_lakh + ' L ₹'} d="" />
      <Kpi l="Cost / incremental unit" v={fN(r.cost_per_incremental_unit_inr) + ' ₹'} d={`Incremental value ${r.incremental_value_inr_lakh} L ₹`} />
    </div>
    <Card style={mb} title="Units per depot-share point — test vs control">
      <LineChart cfg={{ id: 'in1', unit: 'Units per week', title: 'Test vs control', labels: LABELS.slice(i0, i1 + 1), series: [{ name: 'Test depots', color: COL(1), data: W2.t.slice(i0, i1 + 1), w: 2.4 }, { name: 'Control depots', color: COL(0), data: W2.c.slice(i0, i1 + 1) }], bands: [{ i0: W2.w0 - i0, i1: W2.w1 - i0, fill: 'var(--shade-info)', label: 'Campaign', tip: 'Campaign window' }], h: 260, yfmt: (v) => fN(v, 0) }} />
    </Card>
    <Card title="All campaigns">
      <RowClickTable rows={D.inf} rowKey="product_id" per={8} onRow={(x) => setId(x.product_id)} cols={[{ k: 'product', l: 'Campaign' }, { k: 'campaign_start', l: 'Start' }, { k: 'campaign_weeks', l: 'Weeks', n: true }, { k: 'influencer_lift_pct', l: 'Lift', n: true, f: (v) => fS(v, 0) }, { k: 'incremental_units_test_depots', l: 'Incremental units', n: true, f: (v) => fN(v) }, { k: 'kolkata_influencer_spend_inr_lakh', l: 'Spend (L ₹)', n: true }, { k: 'cost_per_incremental_unit_inr', l: '₹ / unit', n: true, f: (v) => fN(v) }]} />
    </Card>
  </>);
}

function Competitor() {
  const { D, W, LABELS } = useData();
  const HB = useHB();
  const [ce, setCe] = useTabState('chan:comp', 'EXT-01');
  const e = D.ecan.find((x: any) => x.event_id === ce), N = D.nat[e.affected_product_id];
  const i0 = W.indexOf(e.start), i1 = Math.min(W.length - 1, W.indexOf(e.end));
  return (<>
    <h2>Competitor actions & macro scenarios</h2>
    <p className="lead">Pick a competitor event to see its effect on the affected product. The shaded window is the action period.</p>
    <Ctl><SelectCtl label="Event" items={D.ecan.map((x: any) => [x.event_id, `${x.event_id} · ${x.competitor} · ${x.affected_product}`])} value={ce} onChange={setCe} /></Ctl>
    <div className="grid g4" style={mb}>
      <Kpi l="Peak hit, Kolkata" v={fP(e.peak_impact_kolkata_pct, 0)} d={e.action} />
      <Kpi l="Peak hit, national" v={fP(e.peak_impact_national_pct, 0)} d={`${e.start} → ${e.end}`} />
      <Kpi l="Units lost" v={fN(e.national_units_lost)} d="national" />
      <Kpi l="Value lost" v={e.national_value_lost_inr_cr + ' ₹ Cr'} d="" />
    </div>
    <Card title={`${e.affected_product} — national demand vs last year`}>
      <LineChart cfg={{ id: 'co1', unit: 'Units per week', title: 'National demand', labels: LABELS, series: [{ name: 'Actual demand', color: COL(0), data: N.a, w: 2.4 }, { name: 'Budget', color: COL(2), data: N.bu, dash: true }, { name: 'Seasonal baseline', color: COL(6), data: N.sb, dash: true }], bands: [{ i0, i1, fill: 'var(--shade-warn)', label: 'Competitor action', tip: e.action }, ...HB], h: 280 }} />
    </Card>
  </>);
}
