import { useQuery } from '@tanstack/react-query';
import { API_URL } from '../api/forecastApi';

export interface ExplainTarget { ids: string[]; week: string; scope: string }
export interface Driver { driver: string; about: string; impact_units: number; features: { feature: string; impact_units: number }[] }
export interface Fact { label: string; this_week: number; reference: number | null; change_pct: number | null; unit: string }
export interface ExplainOut {
  week_start: string; horizon: string; series_count: number; reference: string; forecast: number; reference_value: number; change: number; change_pct: number | null;
  explained: number; actual: number | null; in_history: boolean; festival_this_week: string[]; festival_reference: string[]; drivers: Driver[]; facts: Fact[];
}
/** national: `nat|ALL|<product>`; depots: `kol|<depot>|<product>`; the dataset keys are `<product>` and `<depot>|<product>`. */
export const natIds = (prodIds: string[]) => prodIds.map((p) => `nat|ALL|${p}`);
export const kolIds = (depots: string[], prodIds: string[]) => depots.flatMap((d) => prodIds.map((p) => `kol|${d}|${p}`));

export function useExplain(t: ExplainTarget | null, model: string, refWeeks = 4) {
  return useQuery({
    enabled: !!t, retry: 0, staleTime: 5 * 60_000,
    queryKey: ['explain', model, refWeeks, t?.week, t?.ids.join(',')],
    queryFn: async () => {
      const r = await fetch(API_URL + '/explain', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ series_ids: t!.ids, week_start: t!.week, model, ref_weeks: refWeeks }) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || `API /explain returned ${r.status}`);
      return (await r.json()) as ExplainOut;
    },
  });
}
