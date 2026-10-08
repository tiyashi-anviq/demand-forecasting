import { useMemo } from 'react';
import { InlineLoading, InlineNotification } from '@carbon/react';
import { useTabState } from '../../state/AppState';
import { Card, Chip, Ctl, SegCtl, SelectCtl } from '../../components/Controls';
import { InfoBtn } from '../../components/InfoBtn';
import { BarChart } from '../../components/BarChart';
import { LineChart } from '../../components/LineChart';
import { COL, fN, fP, fS } from '../../lib/format';
import { useMetrics, type MetricRow, type MetricsOut } from '../../metrics/api';

const WHERE: [string, string][] = [['depot', 'Kolkata depots'], ['national', 'All India, each product'], ['national_total', 'All India, all products together']];
const WHERE_SHORT: Record<string, string> = { depot: 'the five Kolkata depots', national: 'all India (each product scored separately)', national_total: 'all India (all products added together)' };
const AHEAD: [string, string][] = [['M3', '3 months ahead'], ['M2', '2 months ahead'], ['M1', '1 month ahead']];
const AHEAD_L: Record<string, string> = { M3: '3 months ahead', M2: '2 months ahead', M1: '1 month ahead' };
const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const monthName = (ym: string) => { const [y, m] = ym.split('-'); return `${MON[+m - 1]} ${y}`; };
const SHOW: [string, string][] = [['accuracy', 'How accurate'], ['under', 'Forecast too low'], ['over', 'Forecast too high'], ['bias', 'Which way it leans']];
const fmt = (k: string, v: number | null) => (v == null ? '–' : k === 'bias' ? fS(v) : fP(v));
const H3 = ['M3', 'M2', 'M1'] as const;
const own = (r: { benchmark: boolean; uses_sales_forecast: boolean }) => !r.benchmark && !r.uses_sales_forecast;
const tag = (r: { benchmark: boolean; uses_sales_forecast: boolean }) => r.benchmark ? <Chip>yardstick, not our model</Chip> : r.uses_sales_forecast ? <Chip kind="warn">built on the sales team's number</Chip> : <Chip kind="good">own view</Chip>;

/** How good is each forecast? Plain-language view of the live backtest error metrics. */
export default function Metrics() {
  const [by, setBy] = useTabState<'overall' | 'category' | 'window'>('mt:by', 'overall');
  const [level, setLevel] = useTabState('mt:level', 'depot');
  const [hz, setHz] = useTabState('mt:hz', 'M3');
  const [show, setShow] = useTabState('mt:show', 'accuracy');
  const [month, setMonth] = useTabState('mt:month', '');
  const [mdl, setMdl] = useTabState('mt:mdl', 'stacked');
  const [more, setMore] = useTabState('mt:more', 'no');
  const q = useMetrics(by, month);
  const d = q.data;
  const rows = useMemo(() => (d ? d.rows.filter((r) => r.level === level && r.horizon === hz) : []), [d, level, hz]);

  if (q.isError && !d) return <InlineNotification kind="error" lowContrast hideCloseButton title="The API is not reachable" subtitle={(q.error as Error).message + ' — start the API (uv run uvicorn app:app --reload). This screen needs the /metrics endpoint.'} />;
  if (!d) return <InlineLoading description="Loading forecast accuracy…" />;

  return (
    <div>
      <p className="lead">Each model is tested on past weeks it had not seen, comparing what it predicted with what customers actually bought. Pick where and when to look; the summary below updates.</p>
      <Ctl>
        <SegCtl label="Where" items={WHERE} value={level} onChange={setLevel} />
        <SelectCtl label="Month to look at" items={d.months.map((m) => [m.month, monthName(m.month)] as [string, string])} value={month || 'ALL'} onChange={(v) => setMonth(v === 'ALL' ? '' : v)} all="Whole year (12 months)" />
      </Ctl>
      <Summary d={d} level={level} />
      <Words />
      <ByHorizon d={d} level={level} />
      {d.month && d.origins && <MonthChart d={d} level={level} mdl={mdl} setMdl={setMdl} />}
      <div style={{ margin: '4px 0 12px' }}>
        <button type="button" className="btn-link" onClick={() => setMore(more === 'yes' ? 'no' : 'yes')} aria-expanded={more === 'yes'} style={{ background: 'none', border: 0, color: 'var(--ink-brand)', cursor: 'pointer', font: 'inherit', padding: 0, textDecoration: 'underline' }}>
          {more === 'yes' ? 'Hide the detailed breakdown' : 'Show the detailed breakdown (by product type, by period, with the numbers behind it)'}
        </button>
      </div>
      {more === 'yes' && (
        <>
          <Ctl>
            <SegCtl label="How far ahead" items={AHEAD} value={hz} onChange={setHz} />
            <SegCtl label="Split by" items={[['overall', 'Nothing'], ['category', 'Product type'], ['window', 'Time period']]} value={by} onChange={(v) => setBy(v as any)} />
            {by !== 'overall' && <SegCtl label="Show" items={SHOW} value={show} onChange={setShow} />}
          </Ctl>
          {by === 'overall' ? <Detail rows={rows} /> : <Grouped rows={rows} models={d.models.map((m) => [m.key, m.label])} show={show} by={by} />}
        </>
      )}
      <p className="note" style={{ marginTop: 12 }}>
        Worked out live from {d.files.length} test-results file{d.files.length > 1 ? 's' : ''} ({d.files.map((f) => f.name).join(', ')}); last updated {new Date(d.updated).toLocaleString()}. Each model is tested on the same {d.rows_used.toLocaleString()} past product-weeks{d.rows_dropped ? `; ${d.rows_dropped} were left out because at least one model could not forecast them (new products with no history yet)` : ''}.
        Drop a refreshed file into the API's backtests folder and this page updates.
      </p>
    </div>
  );
}

/** One plain sentence on how good the forecasts are, before any table. */
function Summary({ d, level }: { d: MetricsOut; level: string }) {
  const period = d.month ? monthName(d.month) : 'the last 12 months';
  const at = (m: string, h: string) => d.rows.find((r) => r.level === level && r.model === m && r.horizon === h);
  const ownModels = d.models.filter(own);
  const best = (h: string) => ownModels.map((m) => at(m.key, h)).filter((r): r is MetricRow => !!r).sort((a, b) => (b.accuracy ?? 0) - (a.accuracy ?? 0))[0];
  const b1 = best('M1'), b3 = best('M3'), s1 = at('sales_team', 'M1'), st3 = at('stacked', 'M3');
  if (!b1 || !b3) return null;
  const miss = (a: number | null) => Math.round((1 - (a ?? 0)) * 100);
  return (
    <Card style={{ marginBottom: 12 }} title="In one minute">
      <p style={{ margin: '0 0 8px', fontSize: 16 }}>
        For <b>{WHERE_SHORT[level]}</b> in <b>{period}</b>, the most accurate forecast that works from its own reading of the data was <b>{b1.label}</b>. A month ahead it was about <b>{fP(b1.accuracy, 0)}</b> accurate, which means it missed about {miss(b1.accuracy)} of every 100 units customers bought.
        Looking three months ahead, the best own-view model, <b>{b3.label}</b>, was about <b>{fP(b3.accuracy, 0)}</b> accurate. Looking further ahead is harder, so accuracy falls.
      </p>
      <ul className="small" style={{ margin: 0, paddingLeft: 18, listStyle: 'disc' }}>
        {s1 && <li>The sales team's own forecast, a month ahead, was about {fP(s1.accuracy, 0)} accurate. That is the number to beat.</li>}
        {st3 && b3.model !== 'stacked' && <li><b>LightGBM stacked</b> scores higher ({fP(st3.accuracy, 0)} three months ahead) but it starts from the sales team's number, so it is a better-informed estimate rather than a fully independent one.</li>}
        <li>Most of the misses are <b>{(b1.under ?? 0) > (b1.over ?? 0) ? 'forecasts that were too low' : 'forecasts that were too high'}</b> for {b1.label}: too low means stock could run out, too high means stock is left unsold.</li>
      </ul>
    </Card>
  );
}

/** The four words used on this page, in plain language. */
function Words() {
  return (
    <Card style={{ marginBottom: 12 }} title="What the words mean">
      <p style={{ margin: '0 0 8px' }}>Imagine customers actually bought <b>100 units</b> of a product.</p>
      <ul className="small" style={{ margin: '0 0 8px', paddingLeft: 18, listStyle: 'disc' }}>
        <li><b>Forecast too low</b>: we predicted 80. We were 20 short, so stock could have run out and sales been lost.</li>
        <li><b>Forecast too high</b>: we predicted 130. We were 30 over, so extra stock sits unsold in the warehouse.</li>
        <li><b>How accurate</b>: 100% minus the misses of both kinds, added up over all the weeks. Missing by 20 one week and by 30 another does not cancel out, they both count. A score of 70% means about 30 of every 100 units were missed.</li>
        <li><b>Which way it leans</b>: whether, on balance, a model tends to predict too low (negative) or too high (positive).</li>
      </ul>
      <p className="small muted" style={{ margin: 0 }}>"3 months ahead" means the forecast was made about three months before the weeks it covers. "Own view" models work from the sales history themselves. "Built on the sales team's number" means the model also looks at what the sales team forecast. "Yardstick" means a simple reference forecast to beat, not one of our models.</p>
    </Card>
  );
}

/** Models against 3, 2 and 1 months ahead for the chosen place and month. */
function ByHorizon({ d, level }: { d: MetricsOut; level: string }) {
  const o = d.origins, mo = d.month;
  const rows = d.rows.filter((r) => r.level === level);
  const cell = (m: string, h: string) => rows.find((r) => r.model === m && r.horizon === h);
  const maxOwn = (h: string) => Math.max(...d.models.filter(own).map((m) => cell(m.key, h)?.accuracy ?? 0));
  return (
    <Card style={{ marginBottom: 12 }} title={mo ? `How well ${monthName(mo)} was forecast` : 'How well each model forecast, over the last 12 months'}
      note={mo && o ? `Each column is a forecast made earlier, judged against what really sold in ${monthName(mo)}. The "3 months ahead" forecast was made in ${monthName(o.M3).split(' ')[0]}, "2 months ahead" in ${monthName(o.M2).split(' ')[0]}, and "1 month ahead" in ${monthName(o.M1).split(' ')[0]}. Only ${d.months.find((m) => m.month === mo)?.weeks} weeks are in a month, so treat these numbers as a rough guide.` : 'Higher is better. The green number is the most accurate own-view model in each column.'}>
      <div className="tw thin-scroll">
        <table className="t">
          <thead><tr><th>Model</th>{H3.map((h) => <th key={h} className="n">{AHEAD_L[h]}{mo && o ? <div className="small muted">made in {monthName(o[h]).split(' ')[0]}</div> : null}</th>)}<th /></tr></thead>
          <tbody>{d.models.map((m) => (
            <tr key={m.key}>
              <td>{m.label}</td>
              {H3.map((h) => { const r = cell(m.key, h); const win = r && own(m) && r.accuracy === maxOwn(h);
                return <td key={h} className={'n' + (win ? ' pos' : '')}>{r ? <><b style={{ fontSize: 15 }}>{fP(r.accuracy, 0)}</b><div className="small muted">too low {fP(r.under, 0)} · too high {fP(r.over, 0)}</div></> : '–'}</td>; })}
              <td>{tag(m)}</td>
            </tr>))}</tbody>
        </table>
      </div>
    </Card>
  );
}

function MonthChart({ d, level, mdl, setMdl }: { d: MetricsOut; level: string; mdl: string; setMdl: (v: string) => void }) {
  const mo = d.month!, o = d.origins!;
  const wk = (d.weekly || []).filter((w) => w.level === (level === 'depot' ? 'depot' : 'national_total'));
  const weeks = [...new Set(wk.map((w) => w.week))].sort();
  const at = (h: string) => weeks.map((w) => { const x = wk.find((r) => r.week === w && r.horizon === h); return x ? (x[mdl] as number) : null; });
  const actual = weeks.map((w) => wk.find((r) => r.week === w)?.actual ?? null);
  const lab = d.models.find((m) => m.key === mdl)?.label || mdl;
  return (
    <Card style={{ marginBottom: 12 }} title={`${monthName(mo)}: what was predicted against what sold`} note="The white line is what customers actually bought. The coloured lines are what the model had predicted, 3, 2 and 1 months earlier. The closer a line is to the white one, the better the forecast.">
      <Ctl><SelectCtl label="Model" items={d.models.map((m) => [m.key, m.label] as [string, string])} value={mdl} onChange={setMdl} /></Ctl>
      <LineChart cfg={{ id: 'mt-month', yzero: false, unit: 'Units per week, ' + (level === 'depot' ? 'all 5 Kolkata depots' : 'all products'), labels: weeks.map((w) => 'Week of ' + w.slice(5)), h: 260, title: `${lab}: ${monthName(mo)}`,
        series: [{ name: 'What customers bought', color: 'var(--text)', data: actual, w: 3 }, ...H3.map((h, i) => ({ name: `${AHEAD_L[h]} (made in ${monthName(o[h]).split(' ')[0]})`, color: COL(i), data: at(h), w: 2, dash: i === 0 }))] }} />
    </Card>
  );
}

function Detail({ rows }: { rows: MetricRow[] }) {
  if (!rows.length) return <InlineNotification kind="info" lowContrast hideCloseButton title="Nothing to show" subtitle="There is nothing to show for this selection." />;
  const best = Math.max(...rows.filter(own).map((r) => r.accuracy ?? 0));
  return (
    <>
      <Card title="Where each forecast goes wrong" note="Each bar is the share of real demand that was missed. Shorter is better. Blue means the forecast was too low, which risks running out of stock. Amber means it was too high, which leaves stock unsold.">
        <BarChart cfg={{ id: 'mt-split', unit: '% of real demand missed', title: 'Too low and too high, by model', cats: rows.map((r) => r.label), h: 280, stack: true, yfmt: (v) => fP(v, 0), tfmt: (v) => fP(v),
          series: [{ name: 'Forecast too low (stock could run out)', color: COL(0), data: rows.map((r) => r.under) }, { name: 'Forecast too high (stock left unsold)', color: COL(3), data: rows.map((r) => r.over) }] }} />
      </Card>
      <Card title="The numbers behind it">
        <div className="tw thin-scroll">
          <table className="t">
            <thead><tr><th>Model</th>
              <th className="n">How accurate <InfoBtn title="How accurate"><p>100% minus the share of real demand that was missed, whether too low or too high. Higher is better.</p></InfoBtn></th>
              <th className="n">Too low <InfoBtn title="Forecast too low"><p>Units that sold above the forecast, as a share of real demand. Risk: running out of stock and losing sales.</p></InfoBtn></th>
              <th className="n">Too high <InfoBtn title="Forecast too high"><p>Units forecast above what sold, as a share of real demand. Risk: excess stock tied up in the warehouse.</p></InfoBtn></th>
              <th className="n">Leans <InfoBtn title="Which way it leans"><p>Too high minus too low. Negative: the model tends to predict too low. Positive: too high.</p></InfoBtn></th>
              <th className="n">Typical miss <InfoBtn title="Typical miss"><p>How many units off the forecast usually is for one product at one depot in one week.</p></InfoBtn></th><th /></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.model}>
                <td>{r.label}</td>
                <td className={'n' + (own(r) && r.accuracy === best ? ' pos' : '')}>{fP(r.accuracy)}</td>
                <td className="n">{fP(r.under)}</td><td className="n">{fP(r.over)}</td>
                <td className="n">{(r.bias ?? 0) < 0 ? 'too low ' : 'too high '}{fS(r.bias)}</td>
                <td className="n">{fN(r.mae)} units</td>
                <td>{tag(r)}</td>
              </tr>))}</tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

function Grouped({ rows, models, show, by }: { rows: MetricRow[]; models: [string, string][]; show: string; by: string }) {
  const groups = [...new Set(rows.map((r) => r.group))].sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
  const cell = (g: unknown, m: string) => rows.find((r) => r.group === g && r.model === m);
  return (
    <Card title={`${SHOW.find((s) => s[0] === show)![1]}, by ${by === 'window' ? 'time period (1 = the latest 13 weeks, 4 = the oldest)' : 'product type'}`} note={show === 'accuracy' ? 'Higher is better. Green marks the most accurate own-view model in each row.' : show === 'bias' ? 'Negative = tends to predict too low, positive = too high.' : 'Share of real demand. Lower is better.'}>
      <div className="tw thin-scroll">
        <table className="t">
          <thead><tr><th>{by === 'window' ? 'Time period' : 'Product type'}</th>{models.map(([k, l]) => <th key={k} className="n">{l}</th>)}</tr></thead>
          <tbody>{groups.map((g) => {
            const vals = models.map(([k]) => { const r = cell(g, k); return r && own(r) ? (r as any)[show] as number : null; }).filter((x): x is number => x != null);
            const pick = show === 'accuracy' ? Math.max(...vals) : show === 'bias' ? null : Math.min(...vals);
            return <tr key={String(g)}><td>{String(g)}</td>{models.map(([k]) => { const r = cell(g, k); const v = r ? ((r as any)[show] as number | null) : null; return <td key={k} className={'n' + (pick != null && r && own(r) && v === pick ? ' pos' : '')}>{fmt(show, v)}</td>; })}</tr>;
          })}</tbody>
        </table>
      </div>
    </Card>
  );
}
