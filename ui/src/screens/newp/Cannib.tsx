import { useData } from '../../data/DataProvider';
import { Card } from '../../components/Controls';
import { BarChart } from '../../components/BarChart';
import { DataTable } from '../../components/DataTable';
import { COL, fN, fP } from '../../lib/format';

export default function Cannib() {
  const { D, nameOf } = useData();
  const VB = [...new Set<string>(D.vext.map((r: any) => r.brand))], VG = ['Kolkata', 'National'];
  const val = (g: string, b: string, k: string) => (D.vext.find((r: any) => r.geography === g && r.brand === b) || {})[k];
  return (
    <div>
      <h2 style={{ fontSize: 20, margin: '4px 0 6px' }}>Cannibalisation</h2>
      <p className="lead">Internal: new products taking volume from Eveready's own portfolio. External: competitor actions taking volume from Eveready, and — for the mosquito vaporizer, a new category with no Eveready product to cannibalise — the volume a new product takes from competitor brands.</p>
      <div className="grid g2">
        <Card title="Internal — units lost to new products (national)">
          <BarChart cfg={{ id: 'ci', rot: true, h: 300, cats: D.ican.map((r: any) => nameOf(r.cannibalised_product_id) + ' ← ' + r.npd_id.toUpperCase()), series: [{ name: 'Units lost', color: COL(1), data: D.ican.map((r: any) => r.national_units_lost_to_npd) }] }} />
        </Card>
        <Card title="External — units lost to competitor actions (national)">
          <BarChart cfg={{ id: 'ce', rot: true, h: 300, cats: D.ecan.map((r: any) => r.event_id + ' ' + r.affected_product_id), series: [{ name: 'Units lost', color: COL(0), data: D.ecan.map((r: any) => r.national_units_lost) }],
            tipExtra: (c) => <div className="muted">{D.ecan[c].competitor}: {D.ecan[c].action}</div> }} />
        </Card>
      </div>
      <Card style={{ marginTop: 12 }} title="External — mosquito vaporizer: volume taken from competitor brands"
        note="The vaporizer is a category Eveready has never sold, so it cannibalises none of its own products (internal = 0). Its volume comes from competitors. For each competitor brand: its pre-launch share (average of the 13 weeks before launch) against its share once the vaporizer is established (week 26+). “Units taken” compares the brand’s actual volume since launch (9 Jun 2025) with what its pre-launch share of the category would have given. It assumes the category would not have grown without the launch, so it is an upper bound, and the four brands add up to the vaporizer’s own volume.">
        <BarChart cfg={{ id: 'vx1', cats: VB, h: 230, yfmt: (v) => v.toFixed(1) + ' pts', series: VG.map((g, i) => ({ name: g, color: COL(i), data: VB.map((br) => val(g, br, 'share_pts_lost')) })) }} />
        <div style={{ marginTop: 12 }}>
          <DataTable per={8} sort="units_taken" rows={D.vext} cols={[
            { k: 'geography', l: 'Geography' }, { k: 'brand', l: 'Competitor brand' },
            { k: 'share_pre', l: 'Share before launch', n: true, f: (v) => fP(v, 1) },
            { k: 'share_established', l: 'Share, established', n: true, f: (v) => fP(v, 1) },
            { k: 'share_pts_lost', l: 'Share points lost', n: true, f: (v) => v.toFixed(2) },
            { k: 'units_taken', l: 'Units taken', n: true, f: (v) => fN(v) },
            { k: 'pct_of_taken', l: '% of units taken', n: true, f: (v) => v.toFixed(1) + '%' },
          ]} />
        </div>
      </Card>
      <Card style={{ marginTop: 12 }} title="Internal detail">
        <DataTable per={10} sort="national_units_lost_to_npd" rows={D.ican} cols={[
          { k: 'npd', l: 'New product' }, { k: 'cannibalised_product', l: 'Cannibalised' },
          { k: 'cannibalisation_rate_of_npd_volume', l: 'Share of NPD volume', n: true, f: (v) => fP(v, 0) },
          { k: 'national_units_lost_to_npd', l: 'Units lost', n: true, f: (v) => fN(v) },
          { k: 'national_value_lost_inr_cr', l: 'Value lost (₹ Cr)', n: true },
          { k: 'pct_of_incumbent_demand_post_launch', l: '% of incumbent demand', n: true, f: (v) => fP(v) },
        ]} />
      </Card>
      <Card style={{ marginTop: 12 }} title="External detail">
        <DataTable per={8} rows={D.ecan} cols={[
          { k: 'event_id', l: 'Event' }, { k: 'competitor', l: 'Competitor' }, { k: 'action', l: 'Action' }, { k: 'start', l: 'From' }, { k: 'end', l: 'To' }, { k: 'affected_product', l: 'Product' },
          { k: 'peak_impact_kolkata_pct', l: 'Peak hit, Kolkata', n: true, f: (v) => fP(v, 0) },
          { k: 'peak_impact_national_pct', l: 'Peak hit, national', n: true, f: (v) => fP(v, 0) },
          { k: 'national_units_lost', l: 'Units lost', n: true, f: (v) => fN(v) },
        ]} />
      </Card>
    </div>
  );
}
