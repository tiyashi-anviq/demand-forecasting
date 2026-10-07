import type { Dataset } from '../data/types';
export type Lev = { shift: number; scheme: number; fest: number; comp: number; avail: number };
export const LEV0: Lev = { shift: 0, scheme: 0, fest: 0, comp: 0, avail: 100 };
export const LEVDEF: [keyof Lev, string, string, number, number, number, string][] = [
  ['shift', 'Overall demand shift', '%', -20, 20, 2, 'Market-wide swing applied to every forecast week.'],
  ['scheme', 'Extra trade-scheme discount', 'pts', 0, 10, 1, 'Demand uplift = discount points × each product’s price elasticity (1.1–1.8).'],
  ['fest', 'Festive intensity', '%', -30, 30, 5, 'Scales the Durga Puja and Kali Puja / Diwali sell-in weeks only.'],
  ['comp', 'Competitor price-war intensity', '%', 0, 100, 10, 'Cuts the products hit by past competitor actions by up to their historical peak impact (6–15%).'],
  ['avail', 'Supply availability', '%', 80, 100, 2, 'Share of demand that can be shipped. Draws a separate supply-constrained line.'],
];
export const PRESETS: [string, Partial<Lev>][] = [
  ['Base case', {}], ['Weak festive season', { fest: -20, shift: -3 }], ['Competitor price war', { comp: 100 }],
  ['Strong festive + scheme', { fest: 15, scheme: 3 }], ['Supply squeeze', { avail: 88 }],
];
export const levActive = (L: Lev) => (Object.keys(LEV0) as (keyof Lev)[]).some((k) => L[k] !== LEV0[k]);
export const levText = (k: keyof Lev, v: number) => (k === 'scheme' ? `${v} pts` : k === 'shift' || k === 'fest' ? `${v > 0 ? '+' : ''}${v}%` : `${v}%`);
export function compImpact(D: Dataset) {
  const c: Record<string, number> = {};
  D.ecan.forEach((e: any) => { c[e.affected_product_id] = Math.max(c[e.affected_product_id] || 0, e.peak_impact_national_pct); });
  return c;
}
/** Multiplier applied to forecast week i of product pid. Overlays only: the model is not re-run. */
export function levMult(D: Dataset, COMP: Record<string, number>, L: Lev, pid: string, i: number) {
  const pm = D.prods.find((p) => p.id === pid);
  const festWk = D.cal.win[i] || D.cal.fest[i];
  return (1 + L.shift / 100) * (1 + (pm?.el || 1.3) * L.scheme / 100) * (festWk ? 1 + L.fest / 100 : 1) * (COMP[pid] ? 1 - COMP[pid] * L.comp / 100 : 1);
}
/** Apply levers to a weekly array (only forecast weeks i >= nh change). */
export function adjArr(D: Dataset, COMP: Record<string, number>, L: Lev, arr: (number | null)[], pid: string) {
  return levActive(L) ? arr.map((v, i) => (v == null || i < D.nh ? v : v * levMult(D, COMP, L, pid, i))) : arr;
}
