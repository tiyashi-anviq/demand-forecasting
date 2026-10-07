import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Dataset, Product } from './types';
import { dlabOf } from '../lib/format';
import { useLiveForecast } from '../api/forecastApi';
import { useApp } from '../state/AppState';
import { SkeletonText, SkeletonPlaceholder, InlineNotification } from '@carbon/react';

export interface DataCtx {
  D: Dataset;            // dataset with the live API forecast already merged in (when available)
  W: string[]; NH: number; LABELS: string[];
  PM: Record<string, Product>; CATS: string[]; SEGS: string[];
  prodsIn: (seg: string, cat: string) => Product[];
  nameOf: (id: string) => string;
  source: { kind: 'live' | 'sample' | 'loading'; model?: string; historyEnd?: string; error?: string };
  refetching: boolean;
}
const Ctx = createContext<DataCtx | null>(null);
export const useData = () => { const c = useContext(Ctx); if (!c) throw new Error('useData outside DataProvider'); return c; };

export function DataProvider({ children }: { children: ReactNode }) {
  const q = useQuery({ queryKey: ['dataset'], staleTime: Infinity, queryFn: async () => {
    const r = await fetch(import.meta.env.BASE_URL + 'data/ui_data.json'); if (!r.ok) throw new Error('Could not load sample data (' + r.status + ')'); return (await r.json()) as Dataset; } });
  const { model } = useApp();
  const live = useLiveForecast(q.data, model);
  const value = useMemo<DataCtx | null>(() => {
    if (!q.data) return null;
    const D = live.merged ?? q.data;
    const PM: Record<string, Product> = {}; D.prods.forEach((p) => (PM[p.id] = p));
    return {
      D, W: D.weeks, NH: D.nh, LABELS: D.weeks.map(dlabOf), PM,
      CATS: [...new Set(D.prods.map((p) => p.cat))], SEGS: [...new Set(D.prods.map((p) => p.seg))],
      prodsIn: (seg, cat) => D.prods.filter((p) => (seg === 'ALL' || p.seg === seg) && (cat === 'ALL' || p.cat === cat)),
      nameOf: (id) => PM[id]?.name || id,
      source: live.source, refetching: live.fetching,
    };
  }, [q.data, live.merged, live.source, live.fetching]);
  if (q.isError) return <div style={{ padding: 24 }}><InlineNotification kind="error" title="Couldn't load the sample data" subtitle={String((q.error as Error)?.message)} lowContrast hideCloseButton /></div>;
  if (!value) return <div style={{ padding: 24, maxWidth: 900 }}><SkeletonText heading width="30%" /><SkeletonPlaceholder style={{ width: '100%', height: 260 }} /></div>;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
