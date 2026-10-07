import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { LEV0, adjArr as adjArrRaw, compImpact, levActive, levMult as levMultRaw, type Lev } from '../lib/levers';
import { useData } from '../data/DataProvider';

type Theme = 'dark' | 'light';
interface AppCtx {
  theme: Theme; toggleTheme: () => void;
  railCollapsed: boolean; setRailCollapsed: (v: boolean | ((b: boolean) => boolean)) => void;
  lev: Lev; levBusy: boolean; applyLev: (l: Lev) => void;
  drawerOpen: boolean; setDrawerOpen: (v: boolean) => void;
  ucOpen: boolean; setUcOpen: (v: boolean) => void;
  model: string; setModel: (m: string) => void;
  tabStore: React.MutableRefObject<Record<string, unknown>>;
}
const Ctx = createContext<AppCtx | null>(null);
const useApp = () => { const c = useContext(Ctx); if (!c) throw new Error('useApp outside AppState'); return c; };

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => { try { return (localStorage.getItem('ev-theme') as Theme) || 'dark'; } catch { return 'dark'; } });
  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); try { localStorage.setItem('ev-theme', theme); } catch { /* ignore */ } }, [theme]);
  // collapse state is deliberately NOT persisted (reference §1): seeded once from the viewport
  const [railCollapsed, setRailCollapsed] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 672px)').matches);
  const [lev, setLev] = useState<Lev>({ ...LEV0 });
  const [levBusy, setLevBusy] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [ucOpen, setUcOpen] = useState(false);
  const [model, setModel] = useState('lightgbm_stacked');   // forecast model served by the API (kept in memory only)
  const tabStore = useRef<Record<string, unknown>>({});
  const applyLev = useCallback((l: Lev) => { setLevBusy(true); window.setTimeout(() => { setLev({ ...l }); setLevBusy(false); }, 350); }, []);
  const value = useMemo(() => ({ theme, toggleTheme: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), railCollapsed, setRailCollapsed, lev, levBusy, applyLev, drawerOpen, setDrawerOpen, ucOpen, setUcOpen, model, setModel, tabStore }),
    [theme, railCollapsed, lev, levBusy, applyLev, drawerOpen, ucOpen, model]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export { useApp };

/** useState that survives switching screens (kept in memory only), like the old demo's global state S. */
export function useTabState<T>(key: string, initial: T): [T, (v: T | ((p: T) => T)) => void] {
  const { tabStore } = useApp();
  const [v, setV] = useState<T>(() => (key in tabStore.current ? (tabStore.current[key] as T) : initial));
  const set = useCallback((n: T | ((p: T) => T)) => setV((p) => { const nv = typeof n === 'function' ? (n as (p: T) => T)(p) : n; tabStore.current[key] = nv; return nv; }), [key, tabStore]);
  return [v, set];
}

/** Scenario levers bound to the current dataset. `adj(arr, pid)` multiplies forecast weeks; `mult(pid, i)` is the per-week factor. */
export function useLevers() {
  const { D, NH } = useData();
  const { lev, levBusy } = useApp();
  const COMP = useMemo(() => compImpact(D), [D]);
  return useMemo(() => ({
    lev, busy: levBusy, active: levActive(lev), COMP,
    mult: (pid: string, i: number) => levMultRaw(D, COMP, lev, pid, i),
    adj: (arr: (number | null)[], pid: string) => adjArrRaw(D, COMP, lev, arr, pid),
    NH,
  }), [D, COMP, lev, levBusy, NH]);
}
