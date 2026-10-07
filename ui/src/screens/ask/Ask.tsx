import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@carbon/react';
import { useData } from '../../data/DataProvider';
import { useTabState } from '../../state/AppState';
import { DataTable } from '../../components/DataTable';
import { Chip } from '../../components/Controls';
import { makeAnswer, type Answer } from './engine';

const ASK_EX = ['Which products have the lowest forecast accuracy?', 'What is the M1 accuracy for Kolkata?', 'How many sales flags did LED batten 20W get in 2026?', 'Which depot products are below 0.6 weeks of cover?', 'Which products are over-stocked?', 'What is the OTIF at Barasat?', 'How much MOQ saving did we miss?', 'What is the quick commerce over-ordering?', 'When is the best launch month for NPD-01?', 'How did the mosquito vaporizer forecast perform?', 'Which launch cannibalised the most?', 'What was the influencer lift?', 'What is the FY26 budget vs actual?', 'Total demand for carbon-zinc AA in 2025', 'When was the monsoon delay?'];
const TAB_ROUTE: Record<string, string> = { overview: '/overview', forecast: '/forecast', newp: '/new-products', supply: '/supply', chan: '/channels', cal: '/calendar', guide: '/guide' };
const VIEW_ROUTES = new Set(['newp', 'supply', 'chan']);
interface Msg { q: string; id: number; a: Answer | null }

export default function Ask() {
  const data = useData();
  const nav = useNavigate();
  const answer = useMemo(() => makeAnswer(data), [data]);
  const [log, setLog] = useTabState<Msg[]>('ask:log', []);
  const [text, setText] = useState('');
  const run = (q: string) => {
    q = q.trim(); if (!q) return;
    let a: Answer | null = null;
    try { a = answer(q); } catch { a = null; }
    setLog((l) => [...l, { q, id: l.length, a }]);
  };
  const go = (g: [string, string?]) => {
    const [t, s] = g; const path = TAB_ROUTE[t] || '/overview';
    nav(path + (s && VIEW_ROUTES.has(t) ? `?view=${s}` : ''));
    document.querySelector('.module-shell-content')?.scrollTo(0, 0);
  };
  return (
    <div>
      <p className="lead">Type a question in plain words about accuracy, flags, stock, OTIF, MOQ, launches, quick commerce, festivals, budgets or demand. Answers are computed live from the dataset in this file. This is a built-in question matcher, not a general chatbot, so if it doesn't understand it will show what it can answer.</p>
      <div className="card" style={{ marginBottom: 12 }}>
        <form onSubmit={(e) => { e.preventDefault(); run(text); setText(''); }} style={{ display: 'flex', gap: 8 }}>
          <input type="text" autoFocus aria-label="Question" value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Which products have the worst forecast accuracy in Kolkata?" style={{ flex: 1, minWidth: 0, font: 'inherit', fontSize: 14, padding: '10px 12px', border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--text)', borderRadius: 0 }} />
          <Button type="submit" size="sm">Ask</Button>
        </form>
        <div className="pill-row" style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {ASK_EX.map((x) => <button key={x} type="button" onClick={() => run(x)} style={{ all: 'unset', cursor: 'pointer' }}><Chip>{x}</Chip></button>)}
        </div>
      </div>
      {log.slice().reverse().map((m) => (
        <div className="card" key={m.id} style={{ marginBottom: 10 }}>
          <div className="small muted">You asked</div>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>{m.q}</div>
          {m.a ? (
            <>
              <div dangerouslySetInnerHTML={{ __html: m.a.t }} />
              {m.a.rows && m.a.cols && <div style={{ marginTop: 8 }}><DataTable cols={m.a.cols} rows={m.a.rows} per={8} /></div>}
              {m.a.go && <div style={{ marginTop: 8 }}><a href="#" onClick={(e) => { e.preventDefault(); go(m.a!.go!); }} style={{ color: 'var(--ink-brand)' }}>Open this screen →</a></div>}
            </>
          ) : <div>I couldn't match that to the data. Try asking about forecast accuracy, challenge flags, depot cover, OTIF, MOQ savings, launches, cannibalisation, quick commerce, influencer lift, budget, festivals, monsoon or total demand — optionally naming a product, category, depot, year or horizon (M1/M2/M3).</div>}
        </div>
      ))}
    </div>
  );
}
