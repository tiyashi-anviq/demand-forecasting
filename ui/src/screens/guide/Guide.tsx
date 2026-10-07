import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/Controls';
import { DataTable } from '../../components/DataTable';

const MAP: [string, string, string, string][] = [['Forecast accuracy M3/M2/M1', 'Forecast', 'sales_fc_m3/m2/m1_units, seasonal_baseline, budget_units, last_year_units', 'Weekly national + 5 depots'], ['Challenge flags (sales / procurement)', 'Forecast', 'challenge flag + reason columns', 'Product-weeks'], ['Forecast value add & overrides', 'Forecast', 'FVA tables', 'National / Kolkata'], ['5 launches, timing, slip', 'New products', 'npd_* sheets, launch timing', 'Weekly'], ['Mosquito vaporizer vs incumbents (inside Launches)', 'New products', 'vaporizer_line_* market panel, pack, case', 'Weekly, national/Kolkata'], ['Similarity index (analogues)', 'New products', 'new_product_similarity.csv, vaporizer_incumbent_similarity.csv', 'NPD × existing product'], ['Cannibalisation', 'New products', 'internal/external cannibalisation tables', 'Event / product'], ['Depot stock, cover, safety stock', 'Supply', 'closing_stock, weeks_of_cover, safety_stock', 'Weekly × depot × product'], ['Replenishment, OTIF, Fri/Sat slots', 'Supply', 'replenishment columns (on-time, in-full, delay reason)', 'Order lines'], ['Plant capacity & allocation', 'Supply', 'plant capacity, B2C/P1/P2 allocation', 'Weekly'], ['MOQ & price breaks', 'Supply', 'Procurement MOQ sheet', 'Lots'], ['Quick commerce', 'Channels', 'quick_commerce_weekly', 'Partner × hub'], ['Delayed monsoon / festivals / influencer / competitors', 'Channels', 'calendar covariates, festival, influencer, competitor sheets', 'Weekly']];
const MAP_ROWS = MAP.map((r) => ({ 0: r[0], 1: r[1], 2: r[2], 3: r[3] }));
const MAP_COLS = [{ k: '0', l: 'Use-case' }, { k: '1', l: 'Screen' }, { k: '2', l: 'Main columns / sheets' }, { k: '3', l: 'Grain' }];
const GLOSS: [string, ReactNode][] = [['Accuracy', '1 − (sum of absolute errors ÷ sum of actual). 100% is perfect; floored at 0.'], ['Bias', 'Net over (+) or under (−) forecast. Accuracy can look fine while bias is large.'], ['M3 / M2 / M1', 'Forecast made 13 / 9 / 4 weeks before the week it predicts.'], ['Seasonal baseline', 'A naive forecast from the same weeks last year; what “judgement” must beat.'], ['Forecast value add', 'Accuracy gained by each step: baseline → sales forecast → consensus.'], ['σ (sigma)', 'Standard deviations — how unusual a number is compared with that product’s history.'], ['Weeks of cover', 'Stock ÷ average weekly demand; <0.6 is a stock-out risk, >3 is over-stocked.'], ['OTIF', 'On time AND in full. A truck that is on time but short does not count.'], ['MOQ', 'Minimum order quantity a supplier will make; price breaks reward bigger lots.'], ['CFA', 'Carrying & forwarding agent — the depot operator that receives and ships.'], ['P1 / P2 / B2C', 'Plant 1, Plant 2 and the direct-to-consumer allocation; allocated in that order when capacity is short.'], ['Weighted distribution', 'Share of category sales covered by shops that stock the brand.']];

const Steps = ({ items }: { items: [ReactNode, string][] }) => (
  <ol style={{ margin: 0, paddingLeft: 22, listStyle: 'decimal' }}>
    {items.map(([h, d], i) => <li key={i} style={{ marginBottom: 10 }}><b>{h}</b><span style={{ display: 'block', color: 'var(--text-2)', fontSize: 13 }}>{d}</span></li>)}
  </ol>
);
const L = ({ to, children }: { to: string; children: ReactNode }) => <Link to={to} style={{ color: 'var(--ink-brand)' }}>{children}</Link>;

export default function Guide() {
  return (
    <div>
      <p className="lead">How to read this demo, where each use-case lives, and a suggested 10-minute walk-through.</p>
      <div className="grid g2">
        <Card title="Start here — 6 steps">
          <Steps items={[
            ['Read the Overview tiles', 'Accuracy at 13, 9 and 4 weeks ahead, OTIF and flag rates. Use the Use cases button in the right rail to jump to a use case.'],
            [<>Open <L to="/forecast">Forecast & accuracy</L></>, 'Switch between national and Kolkata depots, pick a category or product, and change the horizon. Click a row in the ranking table to drill down.'],
            ['Review the challenge flags', 'The bottom table lists sales raises/cuts and procurement asks that look unreasonable, with the reason in plain words.'],
            [<>Look at <L to="/new-products">New products</L></>, 'Five launches, the best and worst launch month, cannibalisation, and the vaporizer-vs-incumbents case.'],
            [<>Open <L to="/supply">Supply & inventory</L></>, 'Heatmap of weeks of cover, replenishment OTIF, plant capacity, transfers and MOQ savings.'],
            [<>Finish with <L to="/channels">Channels & events</L></>, 'Quick commerce, delayed monsoon, Kolkata festivals, influencer test and competitor actions.'],
          ]} />
        </Card>
        <Card title="Suggested demo script (≈10 min)">
          <Steps items={[
            ['Why forecasts miss', 'Forecast tab → Category “Flashlights”, horizon M3 vs M1. Show accuracy improving as the horizon shortens.'],
            ['Where judgement helps or hurts', 'Value-add table: sales forecast beats the seasonal baseline; overrides reason-coded.'],
            ['A launch with no history', 'New products → Vaporizer. Method A (plan) overshoots, B (market share) is closer, C (recalibrated) tracks.'],
            ['Supply risk', 'Supply → cover heatmap: red cells are stock-out risks; click one to see stock vs safety stock.'],
            ['Over-ordering', 'Channels → Quick commerce: orders are 2–3× true demand; OTIF is judged vs allocation.'],
          ]} />
        </Card>
      </div>
      <Card title="Use-case → where the data lives" style={{ marginTop: 12 }}><DataTable cols={MAP_COLS} rows={MAP_ROWS} per={12} /></Card>
      <div className="grid g2" style={{ marginTop: 12 }}>
        <Card title="Plain-language glossary">
          <dl style={{ margin: 0 }}>{GLOSS.map(([t, d]) => <div key={t} style={{ marginBottom: 8 }}><dt style={{ fontWeight: 600 }}>{t}</dt><dd style={{ margin: 0, color: 'var(--text-2)', fontSize: 13 }}>{d}</dd></div>)}</dl>
        </Card>
        <Card title="Good to know about this data">
          <div className="callout">All data is <b>synthetic</b>. It mimics Eveready’s patterns but is not Eveready’s real data.</div>
          <div className="callout">The last 13 weeks (Oct–Dec 2026) are a <b>hidden test window</b>: actuals are withheld; forecasts and budgets are shown so a model can be scored later.</div>
          <div className="callout">Accuracy figures come from a simulated sales forecast in the dataset, not from the ensemble model. Load model output later to compare.</div>
          <div className="callout">The vaporizer launch case uses only information available before 26 May 2025; actual launch slipped one week.</div>
          <div className="callout">Plant allocation order (B2C → P1 → P2), MOQ “captured” savings and the vaporizer positioning scores are modelling assumptions.</div>
        </Card>
      </div>
    </div>
  );
}
