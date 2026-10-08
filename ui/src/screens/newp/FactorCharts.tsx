import { Card } from '../../components/Controls';
import { BarChart } from '../../components/BarChart';
import { COL } from '../../lib/format';

/** Share of the refined index that comes from the first-13-week sales pattern (the rest is the pre-launch factors). */
export const SHAPE_W = 0.3;
const TOP_N = 8;

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const pts = (v: number) => v.toFixed(3);
const pct = (v: number) => Math.round(v * 100) + '%';

interface Factor { k: string; name: string; q: string; max: number; color: string; fit: (r: any) => number | null; fitLabel: (r: any) => string }
interface Props { rows: any[]; rk: string; ik: string; refined: boolean; weights?: Record<string, unknown>; labels: Record<string, string>; questions: Record<string, string> }

/** One bar chart per similarity factor: how many points each factor adds to the score of the top analogues. */
export function FactorCharts({ rows, rk, ik, refined, weights, labels, questions }: Props) {
  // Factors come from the weights in the data, so a factor added or dropped upstream shows up here without code changes.
  const wts = Object.entries(weights || {}).flatMap(([k, w]) => { const n = num(w); return n != null && n > 0 ? [[k, n] as const] : []; });
  const wsum = wts.reduce((a, [, w]) => a + w, 0);
  const scale = refined ? 1 - SHAPE_W : 1;
  const factors: Factor[] = wts.map(([k, w], i) => ({
    k, name: labels[k] || k.replace(/_fit$/, '').replace(/_/g, ' '), q: questions[k] || '', max: w * scale, color: COL(i),
    fit: (r) => { const v = num(r[k]); return v == null ? null : clamp(v, 0, 1); },
    fitLabel: (r) => { const v = num(r[k]); return v == null ? 'no data' : clamp(v, 0, 1).toFixed(2); },
  }));
  if (refined) factors.push({
    k: 'shape', name: 'Sales pattern', q: 'Did weekly sales move together in the first 13 weeks?', max: SHAPE_W, color: COL(factors.length),
    fit: (r) => { const c = num(r.demand_shape_corr_first13wk); return c == null ? null : (clamp(c, -1, 1) + 1) / 2; },
    fitLabel: (r) => { const c = num(r.demand_shape_corr_first13wk); return c == null ? 'no sales data yet' : `correlation ${c.toFixed(2)}`; },
  });

  // Top analogues on the selected basis; rows with no rank fall back to index order and go last.
  const top = rows.slice().sort((a, b) => (num(a[rk]) ?? Infinity) - (num(b[rk]) ?? Infinity) || (num(b[ik]) ?? -1) - (num(a[ik]) ?? -1)).slice(0, TOP_N);
  if (!factors.length || !top.length) {
    return <Card title="How each factor builds the score" style={{ marginBottom: 12 }}><p className="muted" style={{ margin: 0 }}>{!factors.length ? 'The factor weights are missing from the data, so the breakdown cannot be drawn.' : 'There are no analogues to break down for this product.'}</p></Card>;
  }
  const contrib = (f: Factor, r: any) => (f.fit(r) ?? 0) * f.max;
  const total = (r: any) => factors.reduce((a, f) => a + contrib(f, r), 0);
  const ymax = Math.max(...factors.map((f) => f.max));
  const cats = top.map((r) => String(r.existing_id ?? '?'));
  const t3 = top.slice(0, 3);
  const avg3 = factors.map((f) => t3.reduce((a, r) => a + contrib(f, r), 0) / t3.length);

  return (
    <Card title="How each factor builds the score" style={{ marginBottom: 12 }}
      note={<>One chart per factor, all on the same scale so their roles can be compared. Each bar is the points a factor adds to an analogue's score: how alike the two products are on that factor (0 to 1) × the factor's weight. A bar at the top of its factor's range means a perfect match. Shown for the top {top.length} analogues on the {refined ? 'refined' : 'pre-launch'} basis{refined ? `; in refined mode the attribute factors count for ${pct(scale)} and the sales pattern for ${pct(SHAPE_W)}` : ''}. Hover a bar for the detail.</>}>
      {Math.abs(wsum - 1) > 0.01 && <div className="callout">The factor weights in the data add up to {pct(wsum)}, not 100%, so the bars will not add up exactly to the similarity index.</div>}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>Where the top-{t3.length} score comes from</div>
        <div className="small muted" style={{ margin: '2px 0 4px' }}>Average points each factor adds across the {t3.length === 1 ? 'best analogue' : `${t3.length} best analogues`}. The bars together make up their average score of {pts(t3.reduce((a, r) => a + total(r), 0) / t3.length)}.</div>
        <BarChart cfg={{ id: 'smf-all', title: 'Points added by each factor', unit: 'Points added to the score', w: 820, h: 200, cats: factors.map((f) => f.name), yfmt: (v) => v.toFixed(2), tfmt: pts,
          series: [{ name: 'Average points (top ' + t3.length + ')', color: COL(0), data: avg3 }],
          tipExtra: (c) => <div className="muted">Worth up to {pts(factors[c].max)} · {pct(avg3[c] / factors[c].max)} of its maximum on average</div> }} />
      </div>
      <div className="grid g2">
        {factors.map((f) => {
          const vals = top.map((r) => contrib(f, r)), nodata = top.filter((r) => f.fit(r) == null).length;
          return (
            <div key={f.k} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '10px 12px', minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: f.color, marginRight: 6 }} />{f.name}</span>
                <span className="small muted">worth up to {pts(f.max)} ({pct(f.max)})</span>
              </div>
              {f.q && <div className="small muted" style={{ margin: '2px 0 4px' }}>{f.q}</div>}
              <BarChart cfg={{ id: 'smf-' + f.k, title: f.name + ' — points added', unit: 'Points added', w: 420, h: 200, rot: true, ymax, cats, yfmt: (v) => v.toFixed(2), tfmt: pts,
                series: [{ name: f.name, color: f.color, data: vals }],
                tipExtra: (c) => { const r = top[c], t = total(r); return <div className="muted">{r.existing_product ?? r.existing_id}<br />Match {f.fitLabel(r)} × weight {pts(f.max)}<br />{t > 0 ? `${pct(vals[c] / t)} of this analogue's score (${pts(t)})` : 'This analogue scores 0 overall'}</div>; } }} />
              {nodata === top.length ? <p className="small muted" style={{ margin: '4px 0 0' }}>No data for this factor yet, so it adds nothing.</p>
                : vals.every((v) => v === 0) ? <p className="small muted" style={{ margin: '4px 0 0' }}>None of these analogues match on this factor, so it adds nothing here.</p>
                : nodata > 0 ? <p className="small muted" style={{ margin: '4px 0 0' }}>{nodata} of {top.length} analogues have no data for this factor and count as 0.</p> : null}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
