import { useMemo } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { Dataset } from '../data/types';

export const API_URL: string = (import.meta.env.VITE_API_URL as string) || 'http://127.0.0.1:8000';
export interface ApiPoint { week_start: string; horizon: string; weeks_ahead: number; p50: number; p10: number; p90: number; sales_forecast?: number; seasonal_baseline?: number }
export interface ApiAll { model: string; history_end: string; series: Record<string, ApiPoint[]> }
export interface ApiModelInfo { model: string; history_end: string; series: number; features: number; horizons: string[]; forecast_weeks: string[] }

async function getJson<T>(path: string): Promise<T> {
  const r = await fetch(API_URL + path);
  if (!r.ok) throw new Error(`API ${path} returned ${r.status}`);
  return r.json() as Promise<T>;
}
export const useApiModels = () => useQuery({ queryKey: ['api-models'], queryFn: () => getJson<ApiModelInfo[]>('/models'), retry: 1, staleTime: 60_000 });
export const BUNDLED_BACKTEST_MODEL = 'lightgbm_stacked';   // the model whose backtest figures are bundled in ui_data.json
export const modelLabel = (m: string) => m.replace(/_/g, ' ').replace(/\blightgbm\b/i, 'LightGBM').replace(/\btft\b/i, 'TFT').replace(/^./, (c) => c.toUpperCase());
export const useApiForecastAll = (model = 'lightgbm_stacked') =>
  useQuery({ queryKey: ['api-forecast-all', model], queryFn: () => getJson<ApiAll>(`/forecast/all?model=${encodeURIComponent(model)}`), retry: 1, staleTime: 5 * 60_000, placeholderData: keepPreviousData });

/** Overlay the API's P50/P10/P90 onto the bundled dataset (indexes >= nh). Series keys: nat|ALL|<product>, kol|<depot>|<product>. */
export function mergeApi(D: Dataset, api: ApiAll): Dataset {
  const idx = new Map<string, number>(); D.weeks.forEach((w, i) => idx.set(w, i));
  const patch = (target: Record<string, (number | null)[]>, pts: ApiPoint[]) => {
    for (const k of ['lt', 'lt10', 'lt90']) target[k] = target[k].slice();
    for (const p of pts) { const i = idx.get(p.week_start); if (i == null || i < D.nh) continue; target.lt[i] = p.p50; target.lt10[i] = p.p10; target.lt90[i] = p.p90; }
  };
  const nat = { ...D.nat }, kol = { ...D.kol };
  for (const pid of Object.keys(D.nat)) { const pts = api.series[`nat|ALL|${pid}`]; if (pts) { nat[pid] = { ...D.nat[pid] }; patch(nat[pid], pts); } }
  for (const key of Object.keys(D.kol)) { const pts = api.series[`kol|${key}`]; if (pts) { kol[key] = { ...D.kol[key] }; patch(kol[key], pts); } }
  return { ...D, nat, kol };
}

export interface ApiBacktest { weeks: string[]; series: Record<string, Record<string, (number | null)[]>>; lgsc: any[]; lgwin: any[]; lgimp: any[] }
export const useApiBacktest = (model = 'lightgbm_stacked') =>
  useQuery({ queryKey: ['api-backtest', model], queryFn: () => getJson<ApiBacktest>(`/backtest?model=${encodeURIComponent(model)}`), retry: 0, staleTime: 5 * 60_000, placeholderData: keepPreviousData });

/** Overlay the model's own backtest (lg3/lg2/lg1 per series, accuracy tables, window scores, feature importance). */
export function mergeBacktest(D: Dataset, bt: ApiBacktest): Dataset {
  const idx = new Map<string, number>(); D.weeks.forEach((w, i) => idx.set(w, i));
  const HK: Record<string, string> = { M3: 'lg3', M2: 'lg2', M1: 'lg1' };
  const patch = (cur: any, byH?: Record<string, (number | null)[]>) => {
    if (!byH) return cur;
    const out = { ...cur };
    for (const h of Object.keys(HK)) {
      const arr = (cur[HK[h]] || []).slice(); const src = byH[h];
      if (src) bt.weeks.forEach((w, j) => { const i = idx.get(w); if (i != null) arr[i] = src[j]; });
      out[HK[h]] = arr;
    }
    return out;
  };
  const nat = { ...D.nat }, kol = { ...D.kol };
  for (const pid of Object.keys(D.nat)) nat[pid] = patch(D.nat[pid], bt.series[`nat|ALL|${pid}`]);
  for (const key of Object.keys(D.kol)) kol[key] = patch(D.kol[key], bt.series[`kol|${key}`]);
  return { ...D, nat, kol, lgsc: bt.lgsc, lgwin: bt.lgwin, lgimp: bt.lgimp };
}

export function useLiveForecast(base: Dataset | undefined, model: string) {
  const q = useApiForecastAll(model);
  const b = useApiBacktest(model);
  const merged = useMemo(() => {
    if (!base || !q.data) return undefined;
    const withBt = b.data && !b.isPlaceholderData ? mergeBacktest(base, b.data) : base;
    return mergeApi(withBt, q.data);
  }, [base, q.data, b.data, b.isPlaceholderData]);
  const backtestFrom = b.data && !b.isPlaceholderData ? model : BUNDLED_BACKTEST_MODEL;
  const source = q.data
    ? ({ kind: 'live', model: q.data.model, historyEnd: q.data.history_end, backtestFrom } as const)
    : q.isError ? ({ kind: 'sample', error: (q.error as Error).message, backtestFrom: BUNDLED_BACKTEST_MODEL } as const) : ({ kind: 'loading', backtestFrom: BUNDLED_BACKTEST_MODEL } as const);
  return { merged, source, fetching: q.isFetching || q.isPlaceholderData || b.isFetching };
}
