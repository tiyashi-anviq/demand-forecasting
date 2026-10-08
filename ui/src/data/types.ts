/** The bundled sample dataset (public/data/ui_data.json). Sub-objects are loosely typed on purpose: the
 *  shape is documented by the old demo. Key facts:
 *  - weeks: ISO dates (Monday), 170 of them; nh = 157 = number of history weeks; index >= nh is the hidden test window.
 *  - nat[productId] and kol["<depot>|<productId>"] hold weekly arrays (length 170) such as a (actual), f3/f2/f1 (sales forecast),
 *    sb (seasonal baseline), lg3/lg2/lg1 (LightGBM backtest), lt/lt10/lt90 (LightGBM test forecast P50/P10/P90, filled for i >= nh).
 *  - lt/lt10/lt90 are replaced with live values from the API when it is reachable (see api/forecastApi.ts). */
export interface Product { id: string; name: string; cat: string; seg: string; npd: boolean | number; asp: number; slot: string; b2b: boolean | number; el: number; season?: string; use?: string; purchase_type?: string; channel_type?: string }
export type Series = Record<string, (number | null)[]>;
export interface Dataset {
  weeks: string[]; nh: number; prods: Product[]; dep: Record<string, string>;
  nat: Record<string, Series>; kol: Record<string, Series>;
  cal: Record<string, any>; [k: string]: any;
}
