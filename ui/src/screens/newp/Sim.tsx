import { useData } from '../../data/DataProvider';
import { Card, Ctl, Kpi, SelectCtl, SegCtl } from '../../components/Controls';
import { LineChart } from '../../components/LineChart';
import { DataTable } from '../../components/DataTable';
import { InfoBtn } from '../../components/InfoBtn';
import { COL, fN, fP, sum } from '../../lib/format';
import type { NpProps } from './helpers';
import { FactorCharts, SHAPE_W } from './FactorCharts';

const CL: Record<string, string> = { category_fit: 'Category', season_fit: 'Season', price_fit: 'Price', channel_fit: 'Channel', purchase_type_fit: 'Purchase type', trade_fit: 'Trade/retail', pack_size_fit: 'Pack size' };
const Q: Record<string, string> = { category_fit: 'Same kind of product, or used for the same thing?', season_fit: 'Peaks in the same season?', price_fit: 'Similar price?', channel_fit: 'Sold through the same shops and channels?', purchase_type_fit: 'Both bought again and again, or both bought once?', trade_fit: 'Both sold mainly to trade/projects, or both mainly retail?', pack_size_fit: 'Similar pack size?' };
const SHORT: Record<string, string> = { category_fit: 'product type', season_fit: 'season', price_fit: 'price', channel_fit: 'shops and channels', purchase_type_fit: 'how often it is bought', trade_fit: 'trade vs retail', pack_size_fit: 'pack size' };
const fcls = (v: number | null) => (v == null ? '' : v >= 0.8 ? 'pos' : v <= 0.5 ? 'neg' : '');
const fin = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const fx = (v: unknown, d = 2) => { const n = fin(v); return n == null ? '–' : n.toFixed(d); };
export default function Sim({ np, setNp, npds }: NpProps) {
  const { D, W, NH, nameOf } = useData();
  const nid = np.id, basis = np.simBasis || 'pre', rows = (D.sim || []).filter((r: any) => r.npd_id === nid);
  const rk = basis === 'pre' ? 'rank_prelaunch' : 'rank_refined', ik = basis === 'pre' ? 'similarity_index_prelaunch' : 'similarity_index_refined';
  const top = rows.slice().sort((x: any, y: any) => x[rk] - y[rk]), t3 = top.slice(0, 3), isV = nid === 'npd05', WT: Record<string, number> = D.simw || {};
  const wt = (k: string) => fin(WT[k]) ?? 0, FK = Object.keys(CL).filter((k) => wt(k) > 0);
  const refTop = rows.slice().sort((x: any, y: any) => x.rank_refined - y.rank_refined)[0];
  const t8 = rows.slice().sort((x: any, y: any) => x.rank_prelaunch - y.rank_prelaunch).slice(0, 8);
  const lr = (D.npdr || []).find((r: any) => r.product_id === nid), L = lr ? W.indexOf(lr.launch_date) : -1, i1 = Math.min(NH - 1, L + 25);
  // Index each series to its own first-13-week average; null when there is no positive demand to scale by.
  const idx = (a?: (number | null)[]) => { if (!a) return null; const v = a.slice(L, L + 13).filter((x) => x != null && x > 0) as number[], m = sum(v) / v.length; return v.length && m > 0 ? a.slice(L, i1 + 1).map((x) => (x == null ? null : (x / m) * 100)) : null; };
  const shapeSeries = L >= 0 && i1 >= L ? [{ name: nameOf(nid).replace(/ \(NPD-0\d\)/, ''), color: COL(0), data: idx(D.nat[nid]?.a), w: 2.8 }, ...t3.map((r: any, i: number) => ({ name: r.existing_product, color: COL(i + 1), data: idx(D.nat[r.existing_id]?.a), w: 1.8 }))].filter((x) => x.data) : [];
  const f2 = (v: number) => v.toFixed(2), me = D.prods.find((x) => x.id === nid);
  return (
    <div>
      <h2 style={{ fontSize: 20, margin: '4px 0 6px' }}>Similarity index — which existing products does a new product resemble?</h2>
      <p className="lead">For each new product the index scores all {rows.length} existing products from 0 to 1 and ranks them as analogues. <b>Pre-launch</b> uses attributes known before launch: category and use, peak season, price, channel, consumable or durable, trade or retail, and pack size. <b>Refined</b> adds 30% weight for how closely the demand shape matched over the first 13 weeks after launch. The top analogues lend their seasonality and volume benchmark to the new-product forecast.</p>
      <Ctl>
        <SelectCtl label="New product" items={npds.map((p) => [p.id, p.name])} value={nid} onChange={(v) => setNp({ id: v })} />
        <SegCtl label="Basis" items={[['pre', 'Pre-launch (attributes)'], ['ref', 'Refined (+ first 13 weeks)']]} value={basis} onChange={(v) => setNp({ simBasis: v })} />
      </Ctl>
      {!rows.length ? <Card><p className="muted" style={{ margin: 0 }}>No similarity scores are available for this product yet. Pick another new product above.</p></Card> : <>
      {isV && <div className="callout"><b>Weak internal analogues.</b> Eveready has never sold a liquid vaporizer, so the best existing product scores only {fx(top[0][ik])} and is a different category. For this launch the market incumbents (below) are the right comparison.</div>}
      <Card style={{ marginBottom: 12 }} title="In plain words">
        <p style={{ margin: '0 0 6px' }}>A new product has no sales history, so we look for existing Eveready products that are most like it and borrow their sales pattern. Each existing product gets a score from 0 (nothing in common) to 1 (identical), built from {FK.length} questions, each worth a different share:</p>
        <p className="small" style={{ margin: '0 0 6px' }}>{FK.map((k) => `${Q[k].replace('?', '')} (${Math.round(wt(k) * 100)}%)`).join(' · ')}.</p>
        <p style={{ margin: 0 }}><b>Pre-launch</b> uses only these answers, which are known before the product goes on sale. <b>Refined</b> then checks the first 13 weeks of real sales: do the new product's weekly ups and downs follow the existing product's? That counts for {Math.round(SHAPE_W * 100)}% and the answers above for {Math.round((1 - SHAPE_W) * 100)}%, so a product that looks alike on paper but behaves differently drops down the ranking. The three best matches lend their sales pattern and volume to the new-product forecast.</p>
      </Card>
      <div className="grid g4" style={{ marginBottom: 12 }}>
        <Kpi info={{ title: 'Best analogue', body: <p>The existing product with the highest similarity score on the basis chosen above (1 = identical, 0 = nothing in common).</p> }} l="Best analogue" v={t3[0].existing_product} d={`Index ${fx(t3[0][ik])} · ${t3[0].existing_category}`} />
        <Kpi info={{ title: 'Top-3 average', body: <p>The average score of the three closest existing products. A low value means the new product is unlike anything Eveready sells, so the analogues are a weak guide.</p> }} l="Top-3 average index" v={fx(sum(t3.map((r: any) => fin(r[ik]) ?? 0)) / t3.length)} d={t3.map((r: any) => r.existing_id).join(' · ')} />
        <Kpi info={{ title: 'Same or different?', body: <p>Whether the closest product on paper (pre-launch) is also the closest once the first 13 weeks of real sales are taken into account. "Different" means the attributes matched but the sales pattern did not.</p> }} l="Pre-launch vs refined rank #1" v={t8[0]?.existing_id === refTop?.existing_id ? 'Same' : 'Different'} d={basis === 'pre' ? 'Does the first-13-weeks shape confirm the attribute match?' : ''} />
        <Kpi info={{ title: 'Volume benchmark', body: <p>Average weekly units of the three closest products over the 52 weeks before the new product launched, weighted by how similar each is (a closer match counts more). It is the volume estimate lent to the new product.</p> }} l="Analogue volume benchmark" v={fN(sum(t8.slice(0, 3).map((r: any) => r.analogue_avg_weekly_units_52wk_before_launch * r.analogue_weight_prelaunch))) + ' / wk'} d="weighted avg of the pre-launch top-3 analogues, 52 wks before launch" />
      </div>
      <Card style={{ marginBottom: 12 }} title="Why these three?" note="Each score is 0 (nothing in common) to 1 (identical). Green = alike, red = different. The last row is what real sales showed in the new product's first 13 weeks.">
        <div className="tw thin-scroll">
          <table className="t">
            <thead><tr><th>Question</th><th className="n">Share of score</th>{t3.map((r: any) => <th key={r.existing_id} className="n">{r.existing_product}</th>)}</tr></thead>
            <tbody>
              {FK.map((k) => (
                <tr key={k}><td>{Q[k]}</td><td className="n">{Math.round(wt(k) * 100)}%</td>{t3.map((r: any) => <td key={r.existing_id} className={'n ' + fcls(fin(r[k]))}>{fx(r[k])}</td>)}</tr>))}
              <tr><td>Product type, use, season and price</td><td className="n muted">for reference<br />new: {me ? `${me.cat} · ${me.use} · ${me.season} · ₹${fN(me.asp)}` : ''}</td>{t3.map((r: any) => { const pr = D.prods.find((x) => x.id === r.existing_id); return <td key={r.existing_id} className="n muted small">{r.existing_category}{pr ? ` · ${pr.use} · ${pr.season} · ₹${fN(pr.asp)}` : ''}</td>; })}</tr>
              <tr><td><b>Similarity score</b></td><td className="n" />{t3.map((r: any) => <td key={r.existing_id} className="n"><b>{fx(r.similarity_index_prelaunch)}</b> pre-launch · <b>{fx(r.similarity_index_refined)}</b> refined</td>)}</tr>
              <tr><td>Did the sales pattern match after launch?</td><td className="n muted">{Math.round(SHAPE_W * 100)}% of refined</td>{t3.map((r: any) => { const c = fin(r.demand_shape_corr_first13wk); return c == null ? <td key={r.existing_id} className="n muted">no sales data yet</td> : <td key={r.existing_id} className={'n ' + (c >= 0.7 ? 'pos' : c < 0.4 ? 'neg' : '')}>{c.toFixed(2)} · {c >= 0.7 ? 'moves together' : c < 0.4 ? 'does not move together' : 'partly'}</td>; })}</tr>
            </tbody>
          </table>
        </div>
        <ul className="small" style={{ margin: '10px 0 0', paddingLeft: 18, listStyle: 'disc' }}>
          {t3.map((r: any) => {
            const v = (k: string) => fin(r[k]), ks = FK.filter((k) => v(k) != null).sort((x, y) => v(y)! - v(x)!), alike = ks.filter((k) => v(k)! >= 0.8).map((k) => SHORT[k]), diff = ks.filter((k) => v(k)! <= 0.5).map((k) => SHORT[k]);
            return <li key={r.existing_id}><b>{r.existing_product}</b>: alike on {alike.length ? alike.join(', ') : 'nothing much'}{diff.length ? `; different on ${diff.join(', ')}` : ''}.</li>;
          })}
        </ul>
      </Card>
      <FactorCharts rows={rows} rk={rk} ik={ik} refined={basis !== 'pre'} weights={WT} labels={CL} questions={Q} />
      <Card style={{ marginBottom: 12 }} title="Demand since launch: new product vs top-3 analogues" note="Compare the shapes, not the heights. Each line is weekly national demand scaled so that its own average over the first 13 weeks = 100 (200 means twice its typical level). The existing products are shown over the same calendar weeks as the new product’s launch.">
        {shapeSeries.length > 1
          ? <LineChart cfg={{ id: 'sm2', unit: 'Index (each line’s own first-13-week average = 100)', labels: Array.from({ length: i1 - L + 1 }, (_, i) => 'Wk ' + i), yfmt: (v) => fN(v, 0), yzero: false, h: 260, title: 'Demand since launch', series: shapeSeries as any }} />
          : <p className="muted" style={{ margin: 0 }}>Not enough sales since launch to compare demand shapes yet.</p>}
      </Card>
      <Card title="All existing products ranked" note="Click a column to sort. Shape correlation is the correlation of detrended weekly demand over the first 13 weeks live (−1 to +1)." style={{ marginBottom: 12 }}>
        <DataTable key={basis} search per={10} sort={rk} dir={1} rows={rows} cols={[
          { k: rk, l: 'Rank', n: true }, { k: 'existing_product', l: 'Existing product' }, { k: 'existing_category', l: 'Category' },
          { k: 'category_fit', l: 'Category fit', n: true, f: f2 }, { k: 'price_fit', l: 'Price', n: true, f: f2 }, { k: 'pack_size_fit', l: 'Pack', n: true, f: f2 },
          { k: 'season_fit', l: 'Season', n: true, f: f2 }, { k: 'channel_fit', l: 'Channel', n: true, f: f2 },
          { k: 'purchase_type_fit', l: 'Purchase type', n: true, f: f2 }, { k: 'trade_fit', l: 'Trade/retail', n: true, f: f2 },
          { k: 'similarity_index_prelaunch', l: 'Pre-launch index', n: true, f: (v) => v.toFixed(3) },
          { k: 'demand_shape_corr_first13wk', l: 'Shape corr.', n: true, f: (v) => (v == null ? '–' : v.toFixed(2)) },
          { k: 'similarity_index_refined', l: 'Refined index', n: true, f: (v) => v.toFixed(3) },
        ]} />
      </Card>
      </>}
      {isV && (
        <Card title="Vaporizer vs market incumbents" note="Similarity to each competing brand at the planned launch, from the pre-launch pack (price, refill life, fragrance variants, device included, weighted distribution). Positioning scores are illustrative. A high index means the new brand competes head-on with that incumbent.">
          <DataTable per={6} sort="similarity_index" rows={D.simv} cols={[
            { k: 'incumbent', l: 'Incumbent' }, { k: 'price_inr', l: 'Price ₹', n: true }, { k: 'volume_share', l: 'Volume share', n: true, f: (v) => fP(v) },
            { k: 'weighted_distribution', l: 'Weighted dist.', n: true, f: (v) => fP(v, 0) },
            { k: 'price_fit', l: 'Price fit', n: true, f: f2 }, { k: 'refill_life_fit', l: 'Refill life', n: true, f: f2 }, { k: 'fragrance_variants_fit', l: 'Variants', n: true, f: f2 },
            { k: 'device_fit', l: 'Device', n: true, f: f2 }, { k: 'distribution_reach_fit', l: 'Reach', n: true, f: f2 },
            { k: 'similarity_index', l: 'Similarity', n: true, f: (v) => <b>{v.toFixed(3)}</b> },
          ]} />
        </Card>
      )}
    </div>
  );
}
