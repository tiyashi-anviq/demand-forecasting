import { useData } from '../../data/DataProvider';
import { Card, Ctl, Kpi, SelectCtl, SegCtl } from '../../components/Controls';
import { LineChart } from '../../components/LineChart';
import { BarChart } from '../../components/BarChart';
import { DataTable } from '../../components/DataTable';
import { COL, fN, fP, sum } from '../../lib/format';
import type { NpProps } from './helpers';

const CL: Record<string, string> = { category_fit: 'Category', price_fit: 'Price', pack_size_fit: 'Pack size', channel_fit: 'Channel', weather_sensitivity_fit: 'Weather', supply_fit: 'Supply' };
export default function Sim({ np, setNp, npds }: NpProps) {
  const { D, W, NH, nameOf } = useData();
  const nid = np.id, basis = np.simBasis || 'pre', rows = D.sim.filter((r: any) => r.npd_id === nid);
  const rk = basis === 'pre' ? 'rank_prelaunch' : 'rank_refined', ik = basis === 'pre' ? 'similarity_index_prelaunch' : 'similarity_index_refined';
  const top = rows.slice().sort((x: any, y: any) => x[rk] - y[rk]), t3 = top.slice(0, 3), isV = nid === 'npd05', WT = D.simw;
  const refTop = rows.slice().sort((x: any, y: any) => x.rank_refined - y.rank_refined)[0];
  const t8 = rows.slice().sort((x: any, y: any) => x.rank_prelaunch - y.rank_prelaunch).slice(0, 8);
  const L = W.indexOf(D.npdr.find((r: any) => r.product_id === nid).launch_date), i1 = Math.min(NH - 1, L + 25);
  const idx = (a: (number | null)[]) => { const v = a.slice(L, L + 13).filter((x) => x != null && x > 0) as number[], m = sum(v) / v.length; return a.slice(L, i1 + 1).map((x) => (x == null ? null : (x / m) * 100)); };
  const f2 = (v: number) => v.toFixed(2);
  return (
    <div>
      <h2 style={{ fontSize: 20, margin: '4px 0 6px' }}>Similarity index — which existing products does a new product resemble?</h2>
      <p className="lead">For each new product the index scores all 26 existing products from 0 to 1 and ranks them as analogues. <b>Pre-launch</b> uses attributes known before launch: category, price, pack size, channel, weather sensitivity and supply route. <b>Refined</b> adds 30% weight for how closely the demand shape matched over the first 13 weeks after launch. The top analogues lend their seasonality and volume benchmark to the new-product forecast.</p>
      <Ctl>
        <SelectCtl label="New product" items={npds.map((p) => [p.id, p.name])} value={nid} onChange={(v) => setNp({ id: v })} />
        <SegCtl label="Basis" items={[['pre', 'Pre-launch (attributes)'], ['ref', 'Refined (+ first 13 weeks)']]} value={basis} onChange={(v) => setNp({ simBasis: v })} />
      </Ctl>
      {isV && <div className="callout"><b>Weak internal analogues.</b> Eveready has never sold a liquid vaporizer, so the best existing product scores only {top[0][ik].toFixed(2)} and is a different category. For this launch the market incumbents (below) are the right comparison.</div>}
      <div className="grid g4" style={{ marginBottom: 12 }}>
        <Kpi l="Best analogue" v={t3[0].existing_product} d={`Index ${t3[0][ik].toFixed(2)} · ${t3[0].existing_category}`} />
        <Kpi l="Top-3 average index" v={(sum(t3.map((r: any) => r[ik])) / 3).toFixed(2)} d={t3.map((r: any) => r.existing_id).join(' · ')} />
        <Kpi l="Pre-launch vs refined rank #1" v={top[0].existing_id === refTop.existing_id ? 'Same' : 'Different'} d={basis === 'pre' ? 'Does the first-13-weeks shape confirm the attribute match?' : ''} />
        <Kpi l="Analogue volume benchmark" v={fN(sum(t3.map((r: any) => r.analogue_avg_weekly_units_52wk_before_launch * r.analogue_weight_prelaunch))) + ' / wk'} d="weighted avg of the top-3 analogues, 52 wks before launch" />
      </div>
      <div className="grid g2" style={{ marginBottom: 12 }}>
        <Card title="Top 8 analogues — what drives the score" note={'Weighted pre-launch components: ' + Object.keys(CL).map((k) => CL[k] + ' ' + Math.round(WT[k] * 100) + '%').join(' · ') + '.'}>
          <BarChart cfg={{ id: 'sm1', cats: t8.map((r: any) => r.existing_id), stack: true, h: 260, yfmt: (v) => v.toFixed(1), tfmt: (v) => v.toFixed(3),
            series: Object.keys(CL).map((k, i) => ({ name: CL[k], color: COL(i), data: t8.map((r: any) => r[k] * WT[k]) })),
            tipExtra: (c) => <div className="muted">{t8[c].existing_product} · index {t8[c].similarity_index_prelaunch.toFixed(3)}</div> }} />
        </Card>
        <Card title="Demand since launch: new product vs top-3 analogues" note="Weekly national demand, each line indexed to its own first-13-week average = 100.">
          <LineChart cfg={{ id: 'sm2', labels: Array.from({ length: i1 - L + 1 }, (_, i) => 'Wk ' + i), yfmt: (v) => fN(v, 0), yzero: false, h: 260, title: 'Demand since launch',
            series: [{ name: nameOf(nid).replace(/ \(NPD-0\d\)/, ''), color: COL(0), data: idx(D.nat[nid].a), w: 2.8 }, ...t3.map((r: any, i: number) => ({ name: r.existing_product, color: COL(i + 1), data: idx(D.nat[r.existing_id].a), w: 1.8 }))] }} />
        </Card>
      </div>
      <Card title="All existing products ranked" note="Click a column to sort. Shape correlation is the correlation of detrended weekly demand over the first 13 weeks live (−1 to +1)." style={{ marginBottom: 12 }}>
        <DataTable search per={10} sort={rk} dir={1} rows={rows} cols={[
          { k: rk, l: 'Rank', n: true }, { k: 'existing_product', l: 'Existing product' }, { k: 'existing_category', l: 'Category' },
          { k: 'category_fit', l: 'Category fit', n: true, f: f2 }, { k: 'price_fit', l: 'Price', n: true, f: f2 }, { k: 'pack_size_fit', l: 'Pack', n: true, f: f2 },
          { k: 'channel_fit', l: 'Channel', n: true, f: f2 }, { k: 'weather_sensitivity_fit', l: 'Weather', n: true, f: f2 }, { k: 'supply_fit', l: 'Supply', n: true, f: f2 },
          { k: 'similarity_index_prelaunch', l: 'Pre-launch index', n: true, f: (v) => v.toFixed(3) },
          { k: 'demand_shape_corr_first13wk', l: 'Shape corr.', n: true, f: (v) => (v == null ? '–' : v.toFixed(2)) },
          { k: 'similarity_index_refined', l: 'Refined index', n: true, f: (v) => v.toFixed(3) },
        ]} />
      </Card>
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
