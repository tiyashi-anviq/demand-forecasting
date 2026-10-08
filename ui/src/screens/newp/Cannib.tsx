import { useData } from '../../data/DataProvider';
import { Card, Ctl, Kpi, SelectCtl } from '../../components/Controls';
import { BarChart } from '../../components/BarChart';
import { DataTable } from '../../components/DataTable';
import { InfoBtn } from '../../components/InfoBtn';
import { COL, fN, fP } from '../../lib/format';
import type { NpProps } from './helpers';

const WHY_I: Record<string, string> = {
  npd01: 'Same festive-lighting use. Buyers who used to pick a plain deco light choose the RGB string instead.',
  npd02: 'Same power-cut use. Buyers pick the rechargeable lantern over the older emergency light or torch.',
  npd03: 'Same alkaline AA cell. Buyers trade up from the cheaper versions in the same shop.',
  npd04: 'A smart upgrade of the plain LED batten, so it replaces the batten it resembles most.',
};
const FIT: [string, string][] = [['category_fit', 'category'], ['season_fit', 'season'], ['price_fit', 'price'], ['channel_fit', 'channels'], ['purchase_type_fit', 'purchase type'], ['trade_fit', 'trade/retail'], ['pack_size_fit', 'pack size']];
const fin = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const short = (s: string) => s.replace(/ \(NPD-0\d\)/, '');

interface Impact {
  weeks: number;                        // weeks of history since launch used for the weekly figures
  actual: number | null; without: number | null; lostWk: number | null; lostPct: number | null;   // per week, first 52 weeks after launch
  pre: number | null; preWeeks: number;  // average weekly demand in the 13 weeks before launch
  peak: number | null; peakWk: string | null;
}

export default function Cannib({ np, setNp, npds }: NpProps) {
  const { D, W, NH, LABELS, nameOf } = useData();
  const ICAN: any[] = D.ican || [], nid = np.id;
  const r = (D.npdr || []).find((x: any) => x.product_id === nid);
  const pairs = ICAN.filter((x) => x.npd_id === nid).sort((a, b) => (fin(b.national_units_lost_to_npd) ?? 0) - (fin(a.national_units_lost_to_npd) ?? 0));
  const simOf = (npd: string, ex: string) => (D.sim || []).find((x: any) => x.npd_id === npd && x.existing_id === ex) || {};
  const strong = (sm: any) => FIT.filter(([k]) => fin(sm[k]) != null && sm[k] >= 0.8).map(([, l]) => l);
  const weak = (sm: any) => FIT.filter(([k]) => fin(sm[k]) != null && sm[k] <= 0.5).map(([, l]) => l);

  // First-52-week figures come from npdr, the same numbers as the Launches tab.
  const u52 = fin(r?.national_units_52wk), pct = fin(r?.sourced_from_own_portfolio_pct_52wk) ?? (pairs.length ? null : 0);
  const taken = u52 != null && pct != null ? u52 * pct : null, net = u52 != null && taken != null ? u52 - taken : null;
  const lostTot = pairs.reduce((a, x) => a + (fin(x.national_units_lost_to_npd) ?? 0), 0);
  // Each existing product's share of what was taken; equal split if the per-product totals are missing.
  const shareOf = (x: any) => (lostTot > 0 ? (fin(x.national_units_lost_to_npd) ?? 0) / lostTot : 1 / pairs.length);

  /** How this new product changed one existing product's weekly sales. */
  const impact = (x: any): Impact | null => {
    const L = W.indexOf(x.launch_date || r?.launch_date), inc = D.nat?.[x.cannibalised_product_id];
    if (L < 0 || !inc?.a) return null;
    // If several new products hit the same existing product, its weekly loss series covers all of them: keep this one's share.
    const same = ICAN.filter((y) => y.cannibalised_product_id === x.cannibalised_product_id);
    const sameTot = same.reduce((a, y) => a + (fin(y.national_units_lost_to_npd) ?? 0), 0);
    const sh = same.length <= 1 ? 1 : sameTot > 0 ? (fin(x.national_units_lost_to_npd) ?? 0) / sameTot : 1 / same.length;
    const ic = (i: number) => (fin(inc.ic?.[i]) ?? 0) * sh;
    const end = Math.min(L + 52, NH);
    let a = 0, lost = 0, n = 0, peak: number | null = null, peakI = -1;
    for (let i = L; i < end; i++) { const v = fin(inc.a[i]); if (v == null) continue; a += v; lost += ic(i); n++; }
    for (let i = L; i < NH; i++) { const v = ic(i); if (v > 0 && (peak == null || v > peak)) { peak = v; peakI = i; } }
    let pre = 0, pn = 0;
    for (let i = Math.max(0, L - 13); i < L; i++) { const v = fin(inc.a[i]); if (v != null) { pre += v; pn++; } }
    const without = n ? (a + lost) / n : null;
    return { weeks: n, actual: n ? a / n : null, without, lostWk: n ? lost / n : null, lostPct: without ? lost / n / without : null,
      pre: pn ? pre / pn : null, preWeeks: pn, peak, peakWk: peakI >= 0 ? LABELS[peakI] : null };
  };

  const npdName = r ? short(r.product || nameOf(nid)) : short(nameOf(nid));
  return (
    <div>
      <h2 style={{ fontSize: 20, margin: '4px 0 6px' }}>Cannibalisation — what each new product adds, and what it takes from Eveready's own products</h2>
      <p className="lead">A new product's sales are not all new to Eveready: some buyers simply switch from an existing Eveready product. This tab splits each launch's volume into what it took from the existing range and what is genuinely new. Use the <b>i</b> on each affected product to see how the launch changed that product's sales.</p>
      <Ctl><SelectCtl label="New product" items={npds.map((p) => [p.id, p.name])} value={nid} onChange={(v) => setNp({ id: v })} /></Ctl>
      {!r ? <Card style={{ marginBottom: 12 }}><p className="muted" style={{ margin: 0 }}>No launch results are available for this product yet.</p></Card> : <>
        <div className="grid g4" style={{ marginBottom: 12 }}>
          <Kpi l="First 52 weeks" v={u52 == null ? '–' : fN(u52)} d={fin(r.achievement_vs_budget_13wk) != null ? `First 13 weeks at ${fP(r.achievement_vs_budget_13wk, 0)} of budget` : 'units sold'} />
          <Kpi l="Taken from Eveready products" v={taken == null ? '–' : fN(taken)} d={pct == null ? 'share not available' : pairs.length ? `${fP(pct, 0)} of its volume · from ${pairs.length} product${pairs.length > 1 ? 's' : ''}` : 'none'}
            info={{ title: 'Taken from Eveready products', body: <p>Units of the new product, over its first 52 weeks, that would otherwise have been bought as an existing Eveready product.</p> }} />
          <Kpi l="Net new to Eveready" v={net == null ? '–' : fN(net)} cls={net != null && net < 0 ? 'neg' : 'pos'} d={net == null ? '' : net < 0 ? 'replaced more than it added' : `${fP(1 - (pct ?? 0), 0)} of its volume is new business`}
            info={{ title: 'Net new to Eveready', body: <p>First-52-week units minus the units taken from existing Eveready products: the volume the launch really added.</p> }} />
          <Kpi l="Hardest-hit product" v={pairs.length ? short(pairs[0].cannibalised_product) : 'None'} d={pairs.length ? `lost ${fP(pairs[0].pct_of_incumbent_demand_post_launch)} of its demand after launch` : 'no Eveready product affected'} />
        </div>
        {!pairs.length ? (
          <div className="callout" style={{ marginBottom: 12 }}><b>No internal cannibalisation.</b> {npdName} takes no volume from Eveready's own products{/vapori/i.test(npdName) ? ' — it opens a category Eveready has never sold' : ''}, so all {u52 == null ? 'of its' : fN(u52)} first-52-week units are new to Eveready.</div>
        ) : <>
          {u52 != null && taken != null && net != null && (
            <Card style={{ marginBottom: 12 }} title={`Where ${npdName}'s first-52-week volume came from`} note="Each bar is the units that came from one existing Eveready product; the last bar is what was new to Eveready. Together they add up to the first-52-week units.">
              <BarChart cfg={{ id: 'cs', unit: 'Units, first 52 weeks', h: 240, title: 'Where its volume came from', cats: [...pairs.map((x) => short(x.cannibalised_product)), 'Net new to Eveready'],
                series: [{ name: 'Units', color: COL(1), data: [...pairs.map((x) => taken * shareOf(x)), net] }],
                tipExtra: (c) => <div className="muted">{fP((c < pairs.length ? taken * shareOf(pairs[c]) : net) / u52, 0)} of {npdName}'s volume</div> }} />
            </Card>
          )}
          <div className="grid g3" style={{ marginBottom: 12 }}>
            {pairs.map((x) => {
              const im = impact(x), sm = simOf(nid, x.cannibalised_product_id), al = strong(sm), df = weak(sm), rate = fin(x.cannibalisation_rate_of_npd_volume);
              return (
                <div key={x.cannibalised_product_id} className="card" style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', fontWeight: 600, fontSize: 14 }}>
                    <span>{short(x.cannibalised_product)}</span>
                    <InfoBtn title={`How ${npdName} affected ${short(x.cannibalised_product)}`}>
                      {!im ? <p>Weekly sales are not available for this product, so only the totals are shown: {fN(x.national_units_lost_to_npd)} units lost since launch ({fP(x.pct_of_incumbent_demand_post_launch)} of its demand).</p> : <>
                        {im.weeks > 0 && im.actual != null && im.without != null ? (
                          <p>Over the first {im.weeks} weeks after launch{im.weeks < 52 ? ' (all the history so far)' : ''}, {short(x.cannibalised_product)} sold <b style={{ display: 'inline' }}>{fN(im.actual)}</b> a week. Without {npdName} it would have sold about {fN(im.without)}: <span className="neg">{fN(im.lostWk ?? 0)} a week lost ({fP(im.lostPct ?? 0)})</span>.</p>
                        ) : <p>The launch is after the last week of history, so there are no weekly sales to compare yet.</p>}
                        <p>Before launch it averaged {im.pre == null ? '– (no pre-launch history)' : `${fN(im.pre)} a week (${im.preWeeks < 13 ? `${im.preWeeks} weeks before launch` : 'the 13 weeks before launch'})`}.</p>
                        <p>Since launch: {fN(x.national_units_lost_to_npd)} units lost nationally{fin(x.kolkata_units_lost_to_npd) != null ? `, ${fN(x.kolkata_units_lost_to_npd)} of them in Kolkata` : ''}{im.peak != null ? `. The biggest weekly loss was ${fN(im.peak)} units, in the week of ${im.peakWk}` : ''}.</p>
                        {rate != null && <p>For every 100 units of {npdName}, about {Math.round(rate * 100)} came from {short(x.cannibalised_product)}.</p>}
                        {WHY_I[nid] && <p className="muted">{WHY_I[nid]}</p>}
                      </>}
                    </InfoBtn>
                  </div>
                  <div className="small" style={{ marginTop: 6, lineHeight: 1.6 }}>
                    <div>Units lost, first 52 weeks: <b>{taken == null ? '–' : fN(taken * shareOf(x))}</b></div>
                    <div>Share of its demand lost: <b>{fP(x.pct_of_incumbent_demand_post_launch)}</b></div>
                    <div>Value lost since launch: <b>₹{fin(x.national_value_lost_inr_cr) == null ? '–' : x.national_value_lost_inr_cr.toFixed(2)} Cr</b></div>
                    <div className="muted">Alike on {al.length ? al.join(', ') : 'little'}{df.length ? `; differs on ${df.join(', ')}` : ''}.</div>
                  </div>
                </div>
              );
            })}
          </div>
        </>}
      </>}
      <Card style={{ marginBottom: 12 }} title="All launches — units lost by existing products (national, since launch)" note="Every new product and the existing Eveready products it takes volume from. Hover a bar for the detail.">
        {ICAN.length ? <BarChart cfg={{ id: 'ci', unit: 'Units lost', rot: true, h: 300, title: 'Units lost to new products', cats: ICAN.map((x) => short(nameOf(x.cannibalised_product_id)) + ' ← ' + String(x.npd_id).toUpperCase()), series: [{ name: 'Units lost', color: COL(1), data: ICAN.map((x) => fin(x.national_units_lost_to_npd)) }],
          tipExtra: (c) => { const x = ICAN[c], sm = simOf(x.npd_id, x.cannibalised_product_id); return <div className="muted">{short(x.npd)} · takes {fP(x.cannibalisation_rate_of_npd_volume, 0)} of its volume from here. Alike on: {strong(sm).join(', ') || '–'}.</div>; } }} />
          : <p className="muted" style={{ margin: 0 }}>No new product takes volume from Eveready's own products.</p>}
      </Card>
      <Card title="Internal detail">
        <DataTable per={10} sort="national_units_lost_to_npd" rows={ICAN} cols={[
          { k: 'npd', l: 'New product' }, { k: 'cannibalised_product', l: 'Cannibalised' },
          { k: 'npd_id', l: 'Why it happens', f: (v) => WHY_I[v] || '' },
          { k: 'cannibalisation_rate_of_npd_volume', l: 'Share of NPD volume', n: true, f: (v) => fP(v, 0) },
          { k: 'national_units_lost_to_npd', l: 'Units lost', n: true, f: (v) => fN(v) },
          { k: 'national_value_lost_inr_cr', l: 'Value lost (₹ Cr)', n: true },
          { k: 'pct_of_incumbent_demand_post_launch', l: '% of incumbent demand', n: true, f: (v) => fP(v) },
        ]} />
      </Card>
    </div>
  );
}
