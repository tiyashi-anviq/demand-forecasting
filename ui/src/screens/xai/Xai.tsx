import { useMemo } from 'react';
import { InlineLoading, InlineNotification } from '@carbon/react';
import { useData } from '../../data/DataProvider';
import { useApp, useTabState } from '../../state/AppState';
import { Card, Ctl, Kpi, SegCtl, SelectCtl } from '../../components/Controls';
import { BarChart } from '../../components/BarChart';
import { COL, fN, fP } from '../../lib/format';
import { modelLabel, useApiBacktest, useApiModels } from '../../api/forecastApi';
import { kolIds, natIds, useExplain, type ExplainOut } from '../../xai/api';
import { Bars, Facts, Story, fl, pct, sgn } from '../../xai/parts';
import '../../xai/explain.css';

const LV: Record<string, string> = { depot: 'Kolkata depot rows', national: 'National rows', national_total: 'National total' };

/** The explainability module: the same week, explained by every model the API serves, side by side. */
export default function Xai() {
  const { D, W, NH, LABELS, CATS, PM, prodsIn, nameOf } = useData();
  const models = useApiModels();
  const { model } = useApp();                       // the model chosen in the top bar: only this model is explained
  const names = (models.data || []).some((m) => m.model === model) ? [model] : [];
  const [lvl, setLvl] = useTabState('ex:lvl', 'N');
  const [depot, setDepot] = useTabState('ex:depot', 'ALL');
  const [cat, setCat] = useTabState('ex:cat', 'ALL');
  const [prod, setProd] = useTabState('ex:prod', 'ALL');
  const [wk, setWk] = useTabState('ex:wk', W[Math.min(W.length - 1, NH + 4)]);
  const [ref, setRef] = useTabState('ex:ref', 4);

  const ps = prod !== 'ALL' && PM[prod] ? [PM[prod]] : prodsIn('ALL', cat);
  const pids = ps.map((p) => p.id);
  const depKeys = depot === 'ALL' ? Object.keys(D.dep) : [depot];
  const ids = lvl === 'N' ? natIds(pids) : kolIds(depKeys, pids);
  const scope = (prod !== 'ALL' && PM[prod] ? nameOf(prod) : cat === 'ALL' ? 'all products' : cat) + (lvl === 'N' ? ' · national' : depot === 'ALL' ? ' · all depots' : ' · ' + (D.dep as any)[depot]);
  const target = ids.length ? { ids, week: wk, scope } : null;
  const weeks = useMemo(() => W.map((w, i) => i).filter((i) => i >= Math.max(0, NH - 12)), [W, NH]);

  if (models.isError) return <InlineNotification kind="error" lowContrast hideCloseButton title="The API is not reachable" subtitle="Explanations need the forecast API running (uv run uvicorn app:app --reload)." />;
  if (!names.length) return <InlineLoading description="Connecting to the API…" />;
  return (
    <div>
      <p className="lead">Pick any week and see why the selected model ({modelLabel(model)}) forecasts what it does. The bars come from that model itself (SHAP): each driver's share of the difference between that week and the weeks before it. Change the model in the top bar to explain another one; each model is explained only by its own results.</p>
      <Ctl>
        <SegCtl label="Level" items={[['N', 'National'], ['K', 'Kolkata depots']]} value={lvl} onChange={setLvl} />
        {lvl === 'K' && <SelectCtl label="Depot" all="All depots" items={Object.entries(D.dep) as [string, string][]} value={depot} onChange={setDepot} />}
        <SelectCtl label="Category" all="All categories" items={CATS.map((c) => [c, c])} value={cat} onChange={(v) => { setCat(v); setProd('ALL'); }} />
        <SelectCtl label="Product" all="All products" items={prodsIn('ALL', cat).map((p) => [p.id, p.name])} value={prod} onChange={setProd} />
        <label>Week<select value={wk} onChange={(e) => setWk(e.target.value)}>{weeks.map((i) => <option key={W[i]} value={W[i]}>{LABELS[i]}{i >= NH ? ' · forecast' : ''}</option>)}</select></label>
        <label>Compare with the previous<select value={ref} onChange={(e) => setRef(+e.target.value)}>{[1, 2, 4, 8].map((n) => <option key={n} value={n}>{n} week{n > 1 ? 's' : ''}</option>)}</select></label>
      </Ctl>
      <div className="ex-two" style={{ marginTop: 12 }}>{names.map((m) => <ModelPanel key={m} model={m} target={target} refWeeks={ref} />)}</div>
      {names.length > 1 && <Compare names={names} target={target} refWeeks={ref} />}
      <Inputs model={names[0]} target={target} refWeeks={ref} />
      <Overall names={names} />
      <Trust names={names} />
      <p className="note">The data is simulated, so drivers describe how the models use the simulated inputs, not real-world causes. SHAP shows what a model leaned on, which is not the same as what caused demand to move. Scenario levers are not included: this explains each model's own forecast.</p>
    </div>
  );
}

function useBoth(model: string, target: any, refWeeks: number) { return useExplain(target, model, refWeeks); }

function ModelPanel({ model, target, refWeeks }: { model: string; target: any; refWeeks: number }) {
  const q = useBoth(model, target, refWeeks);
  const d = q.data;
  return (
    <Card title={modelLabel(model)} note={d ? `${d.horizon} model · ${d.series_count} series · ${d.in_history ? 'history week (model forecast shown)' : 'forecast week'}` : undefined}>
      {q.isLoading && <InlineLoading description="Explaining…" />}
      {q.isError && <InlineNotification kind="error" lowContrast hideCloseButton title="Couldn't explain" subtitle={(q.error as Error).message + ' — is the API on the latest version (with /explain)?'} />}
      {d && <>
        <div className="ex-kpis">
          <div><span className="muted small">Forecast</span><b>{fN(d.forecast)}</b></div>
          <div><span className="muted small">Previous {refWeeks} wk avg</span><b>{fN(d.reference_value)}</b></div>
          <div><span className="muted small">Change</span><b className={d.change < 0 ? 'neg' : 'pos'}>{pct(d.change_pct)}</b></div>
          {d.actual != null && <div><span className="muted small">Actual</span><b>{fN(d.actual)}</b></div>}
        </div>
        <Story d={d} />
        <Bars d={d} />
      </>}
    </Card>);
}

function Compare({ names, target, refWeeks }: { names: string[]; target: any; refWeeks: number }) {
  const qs = names.map((m) => useBoth(m, target, refWeeks)); // eslint-disable-line react-hooks/rules-of-hooks
  const ok = qs.every((q) => q.data);
  if (!ok) return null;
  const ds = qs.map((q) => q.data as ExplainOut);
  const drivers = [...new Set(ds.flatMap((d) => d.drivers.map((x) => x.driver)))];
  const get = (d: ExplainOut, n: string) => d.drivers.find((x) => x.driver === n)?.impact_units ?? 0;
  const rows = drivers.map((n) => ({ n, v: ds.map((d) => get(d, n)) })).sort((a, b) => Math.max(...b.v.map(Math.abs)) - Math.max(...a.v.map(Math.abs)));
  return (
    <Card title="Where the models agree and differ" note="Impact of each driver on the change in the forecast, in units. A driver with the same sign in both models is a more reliable explanation; opposite signs mean the models read the same inputs differently.">
      <table className="ex-facts ex-cmp"><thead><tr><th>Driver</th>{names.map((m) => <th key={m} className="n">{modelLabel(m)}</th>)}<th>Reading</th></tr></thead>
        <tbody>
          <tr><td><b>Total change</b></td>{ds.map((d, i) => <td key={i} className="n"><b>{sgn(d.change)}</b></td>)}<td /></tr>
          {rows.map((r) => {
            const thr = Math.abs(ds[0].change) * 0.05, big = r.v.map((x) => Math.abs(x) >= thr), nb = big.filter(Boolean).length;
            const read = nb === 0 ? 'minor' : nb < r.v.length ? 'mainly one model' : r.v.every((x) => x >= 0) || r.v.every((x) => x <= 0) ? 'agree' : 'differ';
            return <tr key={r.n}><td>{r.n}</td>{r.v.map((x, i) => <td key={i} className={'n ' + (x < 0 ? 'neg' : 'pos')}>{sgn(x)}</td>)}<td className="muted small">{read}</td></tr>;
          })}
        </tbody></table>
    </Card>);
}

function Inputs({ model, target, refWeeks }: { model: string; target: any; refWeeks: number }) {
  const q = useExplain(target, model, refWeeks);
  if (!q.data) return null;
  return <Card title="The inputs behind it" note="The plain data for the chosen week against the previous weeks. These are inputs, not model output."><Facts d={q.data} /></Card>;
}

function Overall({ names }: { names: string[] }) {
  const bts = names.map((m) => useApiBacktest(m)); // eslint-disable-line react-hooks/rules-of-hooks
  if (!bts.every((b) => b.data)) return null;
  const maps = bts.map((b) => new Map<string, number>(b.data!.lgimp.map((r: any) => [r.feature, r.share])));
  const feats = [...new Set(maps.flatMap((m) => [...m.keys()]))].sort((a, b) => Math.max(...maps.map((m) => m.get(b) || 0)) - Math.max(...maps.map((m) => m.get(a) || 0))).slice(0, 12);
  return (
    <Card title={names.length > 1 ? 'How each model behaves overall' : 'How the model behaves overall'} note={`Share of ${names.length > 1 ? "each model's" : modelLabel(names[0]) + "'s"} total gain by feature (top 12), from this model's own training.`}>
      <BarChart cfg={{ id: 'exg', title: 'Feature importance by model', cats: feats.map(fl), rot: true, h: 260, yfmt: (v) => fP(v, 0), tfmt: (v) => fP(v),
        series: names.map((m, i) => ({ name: modelLabel(m), color: COL(i), data: feats.map((f) => maps[i].get(f) || 0) })) }} />
    </Card>);
}

function Trust({ names }: { names: string[] }) {
  const bts = names.map((m) => useApiBacktest(m)); // eslint-disable-line react-hooks/rules-of-hooks
  if (!bts.every((b) => b.data)) return null;
  const pick = (b: any, lv: string, h: string) => b.data.lgsc.find((r: any) => r.level === lv && r.horizon === h) || {};
  const rows: any[] = [];
  ['depot', 'national', 'national_total'].forEach((lv) => ['M3', 'M2', 'M1'].forEach((h) => rows.push({ lv, h, v: bts.map((b) => pick(b, lv, h).lgbm_accuracy), sf: pick(bts[0], lv, h).sales_forecast_accuracy })));
  return (
    <Card title="Can you trust it? Backtest accuracy" note="Accuracy over the last 52 weeks (four 13-week windows, trained only on data before each window). Green = the best of the listed forecasts.">
      <table className="ex-facts ex-cmp"><thead><tr><th>Level</th><th>Horizon</th>{names.map((m) => <th key={m} className="n">{modelLabel(m)}</th>)}<th className="n">Sales forecast</th></tr></thead>
        <tbody>{rows.map((r) => { const best = Math.max(...r.v, r.sf ?? 0); return (
          <tr key={r.lv + r.h}><td>{LV[r.lv]}</td><td>{r.h}</td>{r.v.map((x: number, i: number) => <td key={i} className={'n' + (x === best ? ' pos' : '')}>{fP(x)}</td>)}<td className={'n' + (r.sf === best ? ' pos' : '')}>{fP(r.sf)}</td></tr>); })}</tbody></table>
    </Card>);
}
