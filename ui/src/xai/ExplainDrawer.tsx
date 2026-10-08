import { useEffect, useRef, useState } from 'react';
import { InlineLoading, InlineNotification, Tag } from '@carbon/react';
import { Close } from '@carbon/icons-react';
import { useApp } from '../state/AppState';
import { fN } from '../lib/format';
import { modelLabel } from '../api/forecastApi';
import { useExplain } from './api';
import { Story, Bars, Facts, pct } from './parts';
import '../layouts/LeversDrawer.css';
import './explain.css';

/** Right-side drawer: why is the forecast for the clicked week different from the weeks before it? */
export function ExplainDrawer() {
  const { explain, setExplain, model, lev } = useApp();
  const [refWeeks, setRefWeeks] = useState(4);
  const q = useExplain(explain, model, refWeeks);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!explain) return;
    const kd = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setExplain(null); } };
    window.addEventListener('keydown', kd, true); setTimeout(() => panel.current?.querySelector<HTMLElement>('button')?.focus(), 0);
    return () => window.removeEventListener('keydown', kd, true);
  }, [explain, setExplain]);
  if (!explain) return null;
  const d = q.data, wkLabel = new Date(explain.week + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const levers = Object.values(lev).some((v) => v !== 0 && v !== 100);
  return (
    <div className="drawer-backdrop" role="presentation" onClick={() => setExplain(null)}>
      <div ref={panel} className="drawer-panel ex-panel" role="dialog" aria-modal="true" aria-label="Why this forecast" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <div><h2 className="drawer-title">Why this week?</h2><p className="drawer-sub">Week of {wkLabel} · {explain.scope} · {modelLabel(model)}{d ? ` · ${d.horizon} model` : ''}</p></div>
          <button type="button" className="drawer-close" aria-label="Close" onClick={() => setExplain(null)}><Close size={20} /></button>
        </div>
        <div className="drawer-body thin-scroll thin-scroll-strong">
          {q.isLoading && <InlineLoading description="Explaining the forecast…" />}
          {q.isError && <InlineNotification kind="error" lowContrast hideCloseButton title="Couldn't explain this week" subtitle={(q.error as Error).message + ' — is the API running with the latest version?'} />}
          {d && <>
            <div className="ex-kpis">
              <div><span className="muted small">{d.in_history ? 'Model forecast' : 'Forecast'}</span><b>{fN(d.forecast)}</b></div>
              <div><span className="muted small">Previous {refWeeks} weeks (avg)</span><b>{fN(d.reference_value)}</b></div>
              <div><span className="muted small">Change</span><b className={d.change < 0 ? 'neg' : 'pos'}>{pct(d.change_pct)}</b></div>
              {d.actual != null && <div><span className="muted small">Actual demand</span><b>{fN(d.actual)}</b></div>}
            </div>
            <label className="ex-ref small">Compare with the previous <select value={refWeeks} onChange={(e) => setRefWeeks(+e.target.value)}>{[1, 2, 4, 8].map((n) => <option key={n} value={n}>{n} week{n > 1 ? 's' : ''}</option>)}</select></label>
            <Story d={d} />
            <h3 className="ex-h">What moved the forecast <Tag size="sm" type="cool-gray">units, add up to the change</Tag></h3>
            <Bars d={d} />
            <p className="muted small">Bars come from the model itself (SHAP): each driver's share of the difference between this week and the previous weeks. Click a bar for the inputs behind it.</p>
            <h3 className="ex-h">The inputs behind it</h3>
            <Facts d={d} />
            {d.in_history && <p className="muted small">This week is in the history period, so the model forecast is shown for explanation; the model has seen this week's data in training.</p>}
            {levers && <p className="muted small">Scenario levers are not included here — this explains the model's base forecast.</p>}
            <p className="muted small">The data is simulated, so drivers describe how the model uses the simulated inputs, not real-world causes.</p>
          </>}
        </div>
      </div>
    </div>
  );
}
