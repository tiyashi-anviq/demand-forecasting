import { useMemo } from 'react';
import { useData } from '../../data/DataProvider';
import { useLevers, useTabState } from '../../state/AppState';
import { Card, Kpi, SegCtl, SelectCtl, Ctl } from '../../components/Controls';
import { LineChart } from '../../components/LineChart';
import { DataTable } from '../../components/DataTable';
import { COL, addArr, fN, fS, mlab, sum } from '../../lib/format';

/** LightGBM demand outlook (old `outlookCard`). */
export default function OutlookCard() {
  const { D, W, NH, LABELS, CATS, PM, prodsIn } = useData();
  const lv = useLevers();
  const [lvl, setLvl] = useTabState('ov:lvl', 'N');
  const [cat, setCat] = useTabState('ov:cat', 'ALL');
  const [prod, setProd] = useTabState('ov:prod', 'ALL');
  const i0 = NH - 26, i1 = W.length - 1, T0 = NH - i0;
  const dl = (i: number) => LABELS[i];
  const wkEnd = (i: number) => { const d = new Date(W[i] + 'T00:00:00'); d.setDate(d.getDate() + 6); return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); };
  const av = lv.lev.avail / 100;

  const m = useMemo(() => {
    const ps = prod !== 'ALL' && PM[prod] ? [PM[prod]] : prodsIn('ALL', cat);
    const A: Record<string, (number | null)[]> = {};
    ['a', 'lg3', 'lt', 'lt0', 'lt10', 'lt90', 'bu', 'ly'].forEach((k) => (A[k] = []));
    ps.forEach((p) => (lvl === 'N' ? [D.nat[p.id]] : Object.keys(D.dep).map((d) => D.kol[d + '|' + p.id])).forEach((s) => {
      ['a', 'lg3', 'bu', 'ly'].forEach((k) => addArr(A[k], s[k]));
      ['lt', 'lt10', 'lt90'].forEach((k) => addArr(A[k], lv.adj(s[k], p.id)));
      addArr(A.lt0, s.lt);
    }));
    const sl = (a: (number | null)[]) => a.slice(i0, i1 + 1);
    const fc = sl(A.lg3.map((v, i) => (v != null ? v : A.lt[i])));
    const F = A.lt.slice(NH, i1 + 1) as number[], F0 = A.lt0.slice(NH, i1 + 1), LY = A.ly.slice(NH, i1 + 1), BU = A.bu.slice(NH, i1 + 1);
    const Fs = sum(F), pk = F.indexOf(Math.max(...F));
    const ser: any[] = [{ name: 'Actual demand', color: COL(0), data: sl(A.a), w: 2.4 }, { name: 'LightGBM forecast', color: COL(1), data: fc, w: 2.6 }];
    if (lv.active) ser.push({ name: 'LightGBM base case (no levers)', color: COL(1), data: sl(A.a.map((_, i) => (i >= NH - 1 ? (i === NH - 1 ? A.lg3[i] : A.lt0[i]) : null))), dash: true, w: 1.6 });
    ser.push({ name: 'P10 (low case)', color: COL(7), data: sl(A.lt10), dash: true, w: 1.2 }, { name: 'P90 (high case)', color: COL(7), data: sl(A.lt90), dash: true, w: 1.2 },
      { name: 'Budget', color: COL(2), data: sl(A.bu), dash: true }, { name: 'Same weeks last year', color: COL(3), data: sl(A.ly), dash: true });
    if (av < 1) ser.push({ name: 'Supply-constrained sales', color: COL(6), data: sl(A.lt.map((v, i) => (i >= NH && v != null ? v * av : null))), w: 2 });
    const mon: Record<string, any> = {};
    for (let i = NH; i <= i1; i++) {
      const k = W[i].slice(0, 7), r = (mon[k] = mon[k] || { m: k, f: 0, lo: 0, hi: 0, bu: 0, ly: 0 });
      r.f += A.lt[i] || 0; r.lo += A.lt10[i] || 0; r.hi += A.lt90[i] || 0; r.bu += A.bu[i] || 0; r.ly += A.ly[i] || 0;
    }
    const rows = Object.values(mon).map((r: any) => ({ ...r, vb: r.bu ? r.f / r.bu - 1 : null, vl: r.ly ? r.f / r.ly - 1 : null }));
    return { F, F0, LY, BU, Fs, pk, ser, rows };
  }, [D, W, NH, lvl, cat, prod, lv, i0, i1, av]);

  const cols = useMemo(() => [
    { k: 'm', l: 'Month', f: (v: string) => mlab(v) }, { k: 'f', l: 'LightGBM', n: true, f: (v: number) => fN(v) },
    { k: 'lo', l: 'P10', n: true, f: (v: number) => fN(v) }, { k: 'hi', l: 'P90', n: true, f: (v: number) => fN(v) },
    { k: 'bu', l: 'Budget', n: true, f: (v: number) => fN(v) }, { k: 'vb', l: 'vs budget', n: true, f: (v: number) => fS(v) },
    { k: 'ly', l: 'Last year', n: true, f: (v: number) => fN(v) }, { k: 'vl', l: 'vs last year', n: true, f: (v: number) => fS(v) }], []);

  const { F, F0, LY, BU, Fs, pk } = m;
  return (
    <Card id="ovo" style={{ marginBottom: 12 }} title="LightGBM demand outlook, Oct 2026 – 3 Jan 2027"
      note={`Last 26 weeks of actual demand, then the LightGBM forecast for the hidden test window: 13 weeks from ${dl(NH)} to the week ending ${wkEnd(i1)}. Backtest weeks show the forecast made 13 weeks ahead.`}>
      <Ctl style={{ marginBottom: 8 }}>
        <SegCtl label="Level" items={[['N', 'National'], ['K', 'Kolkata depots']]} value={lvl} onChange={setLvl} />
        <SelectCtl label="Category" items={CATS.map((c) => [c, c])} value={cat} all="All categories" onChange={(v) => { setCat(v); setProd('ALL'); }} />
        <SelectCtl label="Product" items={prodsIn('ALL', cat).map((p) => [p.id, p.name])} value={prod} all="All products" onChange={setProd} />
      </Ctl>
      <div className="grid g4" style={{ marginBottom: 10 }}>
        <Kpi l="Forecast, next 13 weeks" v={fN(Fs)} d={lv.active ? `base case ${fN(sum(F0))} (${fS(Fs / sum(F0) - 1)})` : `${dl(NH)} – ${wkEnd(i1)}`} />
        <Kpi l="vs budget" v={fS(Fs / sum(BU) - 1)} d={`budget ${fN(sum(BU))}`} cls={Fs >= sum(BU) ? 'pos' : 'neg'} />
        <Kpi l="vs same weeks last year" v={fS(Fs / sum(LY) - 1)} d={`last year ${fN(sum(LY))}`} cls={Fs >= sum(LY) ? 'pos' : 'neg'} />
        <Kpi l={av < 1 ? 'Shippable demand' : 'Peak week'} v={av < 1 ? fN(Fs * av) : dl(NH + pk)} d={av < 1 ? `${fN(Fs * (1 - av))} units short at ${lv.lev.avail}% availability` : fN(F[pk]) + ' units'} />
      </div>
      <LineChart cfg={{ id: 'ovch', title: 'LightGBM demand outlook', labels: LABELS.slice(i0, i1 + 1), series: m.ser, h: 220,
        bands: [{ i0: T0, i1: i1 - i0, fill: 'var(--shade-info)', label: 'Forecast: Oct 2026 – 3 Jan 2027', tip: 'LightGBM forecast window' }] }} />
      <div style={{ marginTop: 10 }}>
        <div className="note">By month (weeks grouped by their Monday start; the week of 28 Dec runs into 3 Jan 2027). P10/P90 for a group are summed across series, so the range is wider than a true aggregate range.</div>
        <DataTable cols={cols} rows={m.rows} per={6} />
      </div>
    </Card>
  );
}
