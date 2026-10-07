import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, InlineLoading, Tag } from '@carbon/react';
import { Close } from '@carbon/icons-react';
import { useApp } from '../state/AppState';
import { useData } from '../data/DataProvider';
import { LEV0, LEVDEF, PRESETS, compImpact, levActive, levMult, levText, type Lev } from '../lib/levers';
import { fN, fS } from '../lib/format';
import './LeversDrawer.css';

/** Right-side drawer, hand-rolled (reference §4): scrim, Escape to close, focus restored, one scroll body, pinned footer. */
export function LeversDrawer() {
  const { drawerOpen, setDrawerOpen, lev, levBusy, applyLev } = useApp();
  const { D, NH, W } = useData();
  const [draft, setDraft] = useState<Lev>({ ...lev });
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);
  const COMP = useMemo(() => compImpact(D), [D]);
  useEffect(() => { if (drawerOpen) { setDraft({ ...lev }); opener.current = document.activeElement; setTimeout(() => panel.current?.querySelector<HTMLElement>('button,input')?.focus(), 0); } else (opener.current as HTMLElement | null)?.focus?.(); }, [drawerOpen]); // eslint-disable-line
  useEffect(() => {
    if (!drawerOpen) return;
    const kd = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setDrawerOpen(false); } };
    window.addEventListener('keydown', kd, true); return () => window.removeEventListener('keydown', kd, true);
  }, [drawerOpen, setDrawerOpen]);
  const dirty = (Object.keys(LEV0) as (keyof Lev)[]).some((k) => draft[k] !== lev[k]);
  // national total over the forecast weeks, base vs adjusted by the DRAFT (live preview)
  const tot = useMemo(() => {
    let base = 0, adj = 0;
    D.prods.forEach((p) => { const s = D.nat[p.id]; for (let i = NH; i < W.length; i++) { const v = s.lt[i]; if (v == null) continue; base += v; adj += v * levMult(D, COMP, draft, p.id, i); } });
    return { base, adj };
  }, [D, COMP, draft, NH, W.length]);
  if (!drawerOpen) return null;
  return (
    <div className="drawer-backdrop" role="presentation" onClick={() => setDrawerOpen(false)}>
      <div ref={panel} className="drawer-panel" role="dialog" aria-modal="true" aria-label="Scenario levers" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <div><h2 className="drawer-title">Scenario levers</h2><p className="drawer-sub">What-if overlays on the LightGBM P10 / P50 / P90 forecast. The model is not re-run.</p></div>
          <button type="button" className="drawer-close" aria-label="Close" onClick={() => setDrawerOpen(false)}><Close size={20} /></button>
        </div>
        <div className="drawer-body thin-scroll thin-scroll-strong">
          <div className="lv-presets">
            {PRESETS.map(([n, v]) => <button key={n} type="button" className="lv-preset" onClick={() => setDraft({ ...LEV0, ...v })}>{n}</button>)}
          </div>
          {LEVDEF.map(([k, label, , min, max, step, help]) => (
            <div key={k} className="lv-row">
              <div className="lv-row-h"><label htmlFor={'lv-' + k}>{label}</label><b>{levText(k, draft[k])}</b></div>
              <input id={'lv-' + k} type="range" min={min} max={max} step={step} value={draft[k]} onChange={(e) => setDraft({ ...draft, [k]: +e.target.value })} />
              <div className="note">{help}</div>
            </div>
          ))}
          <div className="lv-sum">
            <div className="note" style={{ margin: 0 }}>National demand, Oct 2026 – 3 Jan 2027</div>
            <div className="lv-sum-v">{fN(tot.adj)} <Tag size="sm" type={tot.adj >= tot.base ? 'green' : 'red'}>{fS(tot.base ? tot.adj / tot.base - 1 : 0)}</Tag></div>
            <div className="note" style={{ margin: 0 }}>Base case {fN(tot.base)} units{draft.avail < 100 ? ` · shippable at ${draft.avail}%: ${fN(tot.adj * draft.avail / 100)}` : ''}</div>
          </div>
        </div>
        <div className="drawer-footer">
          {levBusy ? <InlineLoading description="Applying scenario…" /> : <Button size="sm" kind="primary" disabled={!dirty} onClick={() => applyLev(draft)}>Apply</Button>}
          <Button size="sm" kind="tertiary" onClick={() => { setDraft({ ...LEV0 }); if (levActive(lev)) applyLev({ ...LEV0 }); }}>Reset to base case</Button>
          <span className="muted small">{dirty ? 'Unapplied changes' : ''}</span>
        </div>
      </div>
    </div>
  );
}
