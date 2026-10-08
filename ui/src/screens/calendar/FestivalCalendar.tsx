import { useMemo } from 'react';
import { useData } from '../../data/DataProvider';
import { useApp, useLevers, useTabState } from '../../state/AppState';
import { natIds } from '../../xai/api';
import { useTip } from '../../components/Tip';
import { Card, Ctl, Kpi, SegCtl, SelectCtl } from '../../components/Controls';
import { LineChart } from '../../components/LineChart';
import { DataTable } from '../../components/DataTable';
import { COL, addArr, dlabOf, fN, fS, sum } from '../../lib/format';
import './calendar.css';

const MN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const fid = (f: any) => f.festival + '|' + f.date;
const monOf = (ds: string) => { const d = new Date(ds + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); };
const dshort = (ds: string) => new Date(ds + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const short = (s: string) => s.replace(/ \(.*\)/, '');

export default function FestivalCalendar() {
  const { D, W, NH, LABELS, CATS } = useData();
  const { lev, adj } = useLevers();
  const tip = useTip();
  const [c, setC] = useTabState<{ year: number; sel: string | null; cat: string }>('cal:state', { year: 2026, sel: null, cat: 'ALL' });
  const FEST = useMemo(() => (D.fest || []).filter((f: any) => f.year && f.date && !/season|exam/i.test(f.festival)).sort((a: any, b: any) => (a.date < b.date ? -1 : 1)), [D]);
  const wIdx = (ds: string) => W.indexOf(ds);
  const calSeries = (cat: string) => {
    const A: any[] = [], B: any[] = [], F: any[] = [], LY: any[] = [], PL: any[] = [], PH: any[] = [];
    D.prods.filter((p) => cat === 'ALL' || p.cat === cat).forEach((p) => { const s = D.nat[p.id]; addArr(A, s.a); addArr(B, s.lg3); addArr(LY, s.ly); addArr(F, adj(s.lt, p.id)); addArr(PL, adj(s.lt10, p.id)); addArr(PH, adj(s.lt90, p.id)); });
    const V = A.map((v, i) => (i < NH ? v : F[i])), FC = A.map((_, i) => (i < NH ? B[i] : F[i]));
    return { A, B, F, LY, PL, PH, V, FC };
  };
  const sr = useMemo(() => calSeries(c.cat), [D, c.cat, lev]); // eslint-disable-line react-hooks/exhaustive-deps
  const sel = FEST.find((f: any) => fid(f) === c.sel) || FEST.find((f: any) => f.festival.startsWith('Kali Puja') && f.year === '2026') || FEST[0];
  const fy = FEST.filter((f: any) => f.year === String(c.year));
  const setYear = (v: string) => { const y = +v, f = FEST.filter((x: any) => x.year === String(y)); setC((o) => ({ ...o, year: y, sel: f.some((x: any) => fid(x) === o.sel) ? o.sel : fid(f[0] || FEST[0]) })); };
  const V = sr.V, med = [...V.slice(0, NH)].filter((x) => x > 0).sort((a, b) => a - b)[Math.floor(NH / 2)] || 1;
  const fmap: Record<string, any[]> = {}; FEST.forEach((f: any) => { (fmap[f.date] = fmap[f.date] || []).push(f); });

  const months = [];
  for (let m = 0; m < 12; m++) {
    const first = new Date(Date.UTC(c.year, m, 1)), dim = new Date(Date.UTC(c.year, m + 1, 0)).getUTCDate(), lead = (first.getUTCDay() + 6) % 7;
    const cells: JSX.Element[] = [];
    for (let k = 0; k < lead; k++) cells.push(<span key={'l' + k} />);
    for (let d = 1; d <= dim; d++) {
      const ds = `${c.year}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, wi = wIdx(monOf(ds)), v = wi >= 0 ? V[wi] : null;
      const t = v != null ? Math.max(0, Math.min(1, v / med - 0.7)) : 0, fs = fmap[ds] || [], inF = wi >= NH && wi < W.length;
      const st = v != null ? { background: `color-mix(in srgb,var(--accent) ${Math.round(t * 58)}%,transparent)` } : undefined;
      if (fs.length) {
        const f = fs[0], pan = /pan/i.test(f.scope), pick = fs.find((x) => fid(x) === c.sel) || f;
        cells.push(
          <button key={d} type="button" className={'cd fd' + (inF ? ' fw' : '') + (fs.some((x) => fid(x) === c.sel) ? ' sel' : '')} style={st}
            aria-label={fs.map((x) => x.festival).join(', ') + ', ' + dshort(ds)} onClick={() => setC((o) => ({ ...o, sel: fid(pick) }))}
            onMouseMove={(ev) => tip.show(<><b>{pick.festival}</b><div className="muted">{dshort(ds)} · {pick.scope}</div></>, ev)} onMouseLeave={tip.hide}>
            <b>{d}</b><i className={pan ? 'p1' : 'p2'} />{fs.length > 1 && <em>+{fs.length - 1}</em>}
          </button>);
      } else cells.push(<span key={d} className={'cd' + (inF ? ' fw' : '')} style={st}>{d}</span>);
    }
    months.push(<div key={m} className="cm card"><div className="cmh">{MN[m]}</div><div className="cdw">{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((x, i) => <span key={i}>{x}</span>)}</div><div className="cdg">{cells}</div></div>);
  }

  return (
    <div>
      <p className="lead">Every holiday and festival that moves Eveready demand, on a year calendar. Colour under each date shows that week's national demand: actual for past weeks, the LightGBM forecast for 5 Oct 2026 – 3 Jan 2027. Click a marked day, or pick a holiday below, to see demand and forecast around it.</p>
      <Ctl>
        <SegCtl label="Year" items={[['2024', '2024'], ['2025', '2025'], ['2026', '2026'], ['2027', '2027']]} value={String(c.year)} onChange={setYear} />
        <SelectCtl label="Category" all="All categories" items={CATS.map((x) => [x, x])} value={c.cat} onChange={(v) => setC((o) => ({ ...o, cat: v }))} />
        <span className="cleg"><i className="lg1" />Pan-India<i className="lg2" />Kolkata-centric<i className="lg3" />Forecast window<span className="cscale">Demand <i className="ramp" /> low → high</span></span>
      </Ctl>
      <div className="cal-grid">{months}</div>
      <div className="fchips" id="fch" role="list">
        {fy.length ? fy.map((f: any) => (
          <button key={fid(f)} type="button" role="listitem" className={'fc' + (fid(f) === fid(sel) ? ' on' : '')} onClick={() => setC((o) => ({ ...o, sel: fid(f) }))}>
            <i className={/pan/i.test(f.scope) ? 'p1' : 'p2'} /><span>{short(f.festival)}</span><small>{dshort(f.date).replace(/ \d{4}$/, '')}</small>
          </button>)) : <div className="note">No festivals recorded for this year.</div>}
      </div>
      <Detail f={sel} sr={sr} cat={c.cat} FEST={FEST} calSeries={calSeries} />
    </div>
  );
}

function Detail({ f, sr, cat, FEST, calSeries }: { f: any; sr: any; cat: string; FEST: any[]; calSeries: (c: string) => any }) {
  const { D, W, NH, LABELS, CATS } = useData();
  const { setExplain } = useApp();
  const wIdx = (ds: string) => W.indexOf(ds);
  const i = wIdx(monOf(f.date)), hist = i >= 0 && i < NH;
  const head = (
    <div className="card cdet-h">
      <div><h3 style={{ margin: 0 }}>{f.festival}</h3><div className="note" style={{ margin: '2px 0 0' }}>{dshort(f.date)} · {f.scope} · week of {i >= 0 && i < W.length ? dlabOf(W[i]) : dshort(monOf(f.date))}</div></div>
      <div className="small muted"><b>Categories lifted:</b> {f.categories_lifted || '–'}<br /><b>Intensity:</b> Kolkata {f.kolkata_intensity} · national {f.national_intensity}</div>
    </div>);
  if (i < 0 || i >= W.length) return <div id="cdet">{head}<div className="callout" style={{ marginTop: 12 }}><b>Outside the forecast window.</b> The data and the LightGBM forecast run to the week ending 3 Jan 2027, so there is no forecast for this date yet.</div></div>;
  const cur = sr.V[i], pre = sum(sr.V.slice(Math.max(0, i - 4), i)) / Math.max(1, Math.min(4, i)), up = pre ? cur / pre - 1 : null;
  const pf = FEST.find((x) => x.festival === f.festival && x.year === String(+f.year - 1)), pi = pf ? wIdx(monOf(pf.date)) : -1, ly = pi >= 0 ? sr.V[pi] : null;
  const eIds = natIds(D.prods.filter((p) => cat === 'ALL' || p.cat === cat).map((p) => p.id));
  const i0 = Math.max(0, i - 8), i1 = Math.min(W.length - 1, i + 8), sl = (a: any[]) => a.slice(i0, i1 + 1);
  const cats = CATS.map((ct) => { const s = calSeries(ct), v = s.V[i], pr = sum(s.V.slice(Math.max(0, i - 4), i)) / Math.max(1, Math.min(4, i)); return { cat: ct, v, pr, up: pr ? v / pr - 1 : null, fc: s.FC[i] }; });
  const prevIdx = Array.from({ length: Math.min(4, i) }, (_, k) => i - Math.min(4, i) + k);
  const prevFest = FEST.filter((x) => prevIdx.some((j) => W[j] === monOf(x.date)) && x.festival !== f.festival).map((x) => `${short(x.festival)} (${dshort(x.date).replace(/ \d{4}$/, '')})`);
  const movers = cats.map((c2) => ({ ...c2, du: c2.v - c2.pr })).filter((c2) => c2.pr > 0).sort((a, b) => Math.abs(b.du) - Math.abs(a.du)).slice(0, 3);
  const preLY = pi >= 0 ? sum(sr.V.slice(Math.max(0, pi - 4), pi)) / Math.max(1, Math.min(4, pi)) : null, lvlYoY = preLY && pre ? pre / preLY - 1 : null;
  const info = {
    cur: { title: 'Demand in the holiday week', body: <>
      <p>National demand (all products{cat === 'ALL' ? '' : ', ' + cat}) for the Monday-to-Sunday week that contains the festival: {hist ? 'actual' : 'forecast'}.</p>
      <p>How much of it this festival should move: <b>{f.categories_lifted || 'nothing specific'}</b>. At national level the effect is scaled by the national intensity ({f.national_intensity}), and the lifted categories are a small part of national volume (batteries are most of it), so a festival effect rarely shows in this total.</p></> },
    prev: { title: 'Why this number', body: <>
      <p>This week's demand ÷ the average of the {prevIdx.length} weeks before it, minus 1. Those weeks ran: {prevIdx.map((j) => `${dlabOf(W[j])} ${fN(sr.V[j])}`).join(' · ')}.</p>
      {prevFest.length > 0 && <p>Festivals inside those weeks: <b>{prevFest.join(', ')}</b>. A festival just before can inflate the average, so a drop may really be that boost wearing off.</p>}
      {movers.length > 0 && <><p>Biggest movers against the average:</p><ul>{movers.map((c2) => <li key={c2.cat}>{c2.cat}: {fS(c2.up)} ({c2.du >= 0 ? '+' : '−'}{fN(Math.abs(c2.du))} units)</li>)}</ul></>}
      <p>The data builds each festival as a depot sell-in peak in the ~4 weeks before it (peaking ~10 days ahead), so the festival week itself often sits after the peak and reads lower.</p></> },
    fc: { title: 'The model forecast', body: <p>What the LightGBM model forecast for this week 13 weeks earlier, using only data up to then. The percentage is how far that forecast was from what happened.</p> },
    ly: { title: 'Compared with last year', body: <>
      <p>This week against the week of {pf ? `${pf.festival.split(' (')[0]}, ${dshort(pf.date)}` : 'the same festival last year'}. Festival dates move each year, so the two are matched by festival, not by calendar week.</p>
      {lvlYoY != null && <p>Level check: the 4 weeks before the festival are {fS(lvlYoY)} against the 4 weeks before it last year, so {Math.abs(lvlYoY) > 0.1 ? 'most of this gap is the general level of demand, not the festival' : 'the general level is similar and the gap is mostly the festival week'}.</p>}</> },
  };
  return (
    <div id="cdet">
      {head}
      <div className="grid g4" style={{ margin: '12px 0' }}>
        <Kpi info={info.cur} l={hist ? 'Demand in holiday week (actual)' : 'Forecast for holiday week'} v={fN(cur)} d={hist ? `Week of ${dlabOf(W[i])}` : `P10–P90: ${fN(sr.PL[i])} – ${fN(sr.PH[i])}`} />
        <Kpi info={info.prev} l="vs previous 4 weeks" v={fS(up)} d={`average ${fN(pre)} a week`} cls={up != null && up >= 0 ? 'pos' : 'neg'} />
        {hist
          ? <Kpi info={info.fc} l="LightGBM forecast, made 13 wks ahead" v={sr.FC[i] != null ? fN(sr.FC[i]) : '–'} d={sr.FC[i] != null ? `${fS(sr.FC[i] / cur - 1)} vs actual` : 'Forecast made before this week; no backtest for this week'} />
          : <Kpi l="Forecast window" v="Yes" d="This week is inside the 5 Oct 2026 – 3 Jan 2027 forecast" />}
        <Kpi info={info.ly} l="vs same festival last year" v={ly != null ? fS(cur / ly - 1) : '–'} d={pf ? `${pf.festival.split(' (')[0]} ${dshort(pf.date)}: ${fN(ly)}` : 'No earlier occurrence in the data'} cls={ly != null && cur >= ly ? 'pos' : 'neg'} />
      </div>
      <div style={{ margin: '-4px 0 12px' }}><button type="button" className="zbtn" style={{ position: 'static' }} onClick={() => setExplain({ ids: eIds, week: W[i], scope: short(f.festival) + ' week · ' + (cat === 'ALL' ? 'all products' : cat) + ' · national' })}>Why is this week different? →</button></div>
      <Card style={{ marginBottom: 12 }} title={'Demand around ' + short(f.festival)} note={`Eight weeks either side of the holiday week${cat === 'ALL' ? ', all products' : ', ' + cat}. Past weeks show actual demand and the 13-week-ahead LightGBM backtest forecast; later weeks show the forecast.`}>
        <LineChart cfg={{ id: 'cch', unit: 'Units per week', title: 'Demand around ' + f.festival, labels: LABELS.slice(i0, i1 + 1), h: 240,
          explain: { weeks: W.slice(i0, i1 + 1), ids: eIds, scope: short(f.festival) + ' · ' + (cat === 'ALL' ? 'all products' : cat) + ' · national' },
          series: [{ name: 'Actual demand', color: COL(0), data: sl(sr.A), w: 2.4 }, { name: 'LightGBM forecast', color: COL(1), data: sl(sr.FC), w: 2.4 }, { name: 'Same weeks last year', color: COL(3), data: sl(sr.LY), dash: true },
            ...(i1 >= NH ? [{ name: 'P10', color: COL(7), data: sl(sr.PL.map((v: any, k: number) => (k >= NH ? v : null))), dash: true, w: 1.1 }, { name: 'P90', color: COL(7), data: sl(sr.PH.map((v: any, k: number) => (k >= NH ? v : null))), dash: true, w: 1.1 }] : [])],
          bands: i1 >= NH ? [{ i0: Math.max(0, NH - i0), i1: i1 - i0, fill: 'var(--shade-info)', label: 'Forecast window', tip: 'LightGBM forecast window' }] : [],
          marks: [{ i: i - i0, label: 'Holiday week' }] }} />
      </Card>
      <Card title="By category in the holiday week">
        <DataTable per={12} sort="up" rows={cats} cols={[
          { k: 'cat', l: 'Category' }, { k: 'v', l: (hist ? 'Actual' : 'Forecast') + ' (units)', n: true, f: (v) => fN(v) }, { k: 'pr', l: 'Prior 4-wk avg (units)', n: true, f: (v) => fN(v) },
          { k: 'up', l: 'Change', n: true, f: (v) => <span className={v >= 0 ? 'pos' : 'neg'}>{fS(v)}</span> },
          ...(hist ? [{ k: 'fc', l: 'LightGBM, 13 wks ahead (units)', n: true, f: (v: any) => fN(v) }] : [])]} />
      </Card>
    </div>
  );
}
