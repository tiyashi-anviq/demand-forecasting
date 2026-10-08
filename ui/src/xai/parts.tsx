import { useState } from 'react';
import { fK, fN } from '../lib/format';
import type { ExplainOut } from './api';

export const sgn = (v: number) => (v >= 0 ? '+' : '−') + fK(Math.abs(v));
export const pct = (v: number | null) => (v == null ? '–' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(1) + '%');
const FEAT: Record<string, string> = {
  iso_week: 'week of the year', days_to_durga_puja: 'days to Durga Puja', days_to_diwali: 'days to Diwali', festival_in_week: 'festival in the week', festival_sell_in_window: 'festival sell-in window',
  budget_units: 'budget units', log_budget: 'budget', budget_vs_mean13: 'budget vs recent demand', log_sales_fc: 'sales forecast', sf_vs_mean13: 'sales forecast vs recent demand', sf_vs_budget: 'sales forecast vs budget',
  sf_vs_ly: 'sales forecast vs last year', sf_vs_bl: 'sales forecast vs baseline', log_baseline_fc: 'seasonal baseline', y_ly: 'same week last year', y_ly_avg3: 'last year (3-week average)', yoy_trend13: 'year-on-year trend',
  y_mean4: '4-week average demand', y_mean13: '13-week average demand', y_mean26: '26-week average demand', y_lag_c0: 'latest week demand', y_lag_c1: 'demand 1 week earlier', y_lag_c2: 'demand 2 weeks earlier',
  trade_scheme_discount_pct: 'trade scheme discount', asp_inr: 'selling price', rainfall_mm_c: 'rainfall', competitor_price_index_c: 'competitor prices', rural_income_index_c: 'rural income', power_cut_hrs_c: 'power cuts',
  weeks_since_launch: 'weeks since launch', influencer_campaign_active: 'influencer campaign',
};
export const fl = (f: string) => FEAT[f] || f.replace(/_/g, ' ');

export function Story({ d }: { d: ExplainOut }) {
  const dn = d.drivers.filter((x) => x.impact_units < 0 && Math.abs(x.impact_units) > Math.abs(d.change) * 0.05), up = d.drivers.filter((x) => x.impact_units > 0 && x.impact_units > Math.abs(d.change) * 0.05);
  const names = (a: typeof dn) => a.slice(0, 3).map((x) => `${x.driver.toLowerCase()} (${sgn(x.impact_units)})`).join(', ');
  const lead = d.change < 0 ? 'lower' : 'higher';
  return (
    <p className="ex-story">
      The forecast for this week is <b>{fN(d.forecast)}</b>, <b>{pct(d.change_pct == null ? null : Math.abs(d.change_pct)).replace(/^\+/, '')}</b> {lead} than the {d.reference} ({fN(d.reference_value)}).
      {d.change < 0 && dn.length > 0 && <> The main reasons are {names(dn)}.</>}{d.change >= 0 && up.length > 0 && <> The main reasons are {names(up)}.</>}
      {d.change < 0 && up.length > 0 && <> Pushing the other way: {names(up)}.</>}{d.change >= 0 && dn.length > 0 && <> Pushing the other way: {names(dn)}.</>}
      {d.festival_this_week.length > 0 && <> This week contains <b>{d.festival_this_week.join(', ')}</b>{d.festival_reference.length ? '' : ', which the earlier weeks do not'}.</>}
    </p>);
}

export function Bars({ d }: { d: ExplainOut }) {
  const max = Math.max(1, ...d.drivers.map((x) => Math.abs(x.impact_units)));
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="ex-bars" role="list">
      {d.drivers.filter((x) => Math.abs(x.impact_units) > Math.abs(d.change) * 0.01 || Math.abs(x.impact_units) > max * 0.02).map((x) => {
        const w = (Math.abs(x.impact_units) / max) * 50, neg = x.impact_units < 0, o = open === x.driver;
        return (
          <div key={x.driver} role="listitem">
            <button type="button" className="ex-row" aria-expanded={o} onClick={() => setOpen(o ? null : x.driver)} title={x.about}>
              <span className="ex-name">{x.driver}</span>
              <span className="ex-track"><i className="ex-mid" /><i className={'ex-bar ' + (neg ? 'neg' : 'pos')} style={neg ? { right: '50%', width: w + '%' } : { left: '50%', width: w + '%' }} /></span>
              <span className={'ex-val ' + (neg ? 'neg' : 'pos')}>{sgn(x.impact_units)}</span>
            </button>
            {o && <div className="ex-detail"><div className="muted small">{x.about}</div>{x.features.length > 0 && <ul>{x.features.map((f) => <li key={f.feature}>{fl(f.feature)}: <b className={f.impact_units < 0 ? 'neg' : 'pos'}>{sgn(f.impact_units)}</b></li>)}</ul>}</div>}
          </div>);
      })}
    </div>);
}

export function Facts({ d }: { d: ExplainOut }) {
  const rows = d.facts.filter((f) => f.reference != null);
  return (
    <table className="ex-facts"><thead><tr><th>Input</th><th className="n">This week</th><th className="n">Previous weeks</th><th className="n">Change</th></tr></thead>
      <tbody>
        <tr><td>Festival</td><td colSpan={3}>{d.festival_this_week.join(', ') || 'none'}{d.festival_reference.length ? <span className="muted"> · earlier: {d.festival_reference.join(', ')}</span> : null}</td></tr>
        {rows.map((f) => <tr key={f.label}><td>{f.label}</td><td className="n">{f.unit === 'units' ? fN(f.this_week) : f.this_week.toFixed(1) + (f.unit === '%' ? '%' : '')}</td><td className="n">{f.unit === 'units' ? fN(f.reference!) : f.reference!.toFixed(1) + (f.unit === '%' ? '%' : '')}</td>
          <td className={'n ' + ((f.change_pct ?? 0) < 0 ? 'neg' : 'pos')}>{pct(f.change_pct)}</td></tr>)}
      </tbody></table>);
}

