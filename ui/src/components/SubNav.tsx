import { useSearchParams } from 'react-router-dom';
import { SegCtl } from './Controls';
/** Sub-view of a screen, kept in the URL (?view=...). */
export function useView(def: string): [string, (v: string) => void] {
  const [sp, setSp] = useSearchParams();
  return [sp.get('view') || def, (v) => { const n = new URLSearchParams(sp); n.set('view', v); setSp(n, { replace: true }); }];
}
export function SubNav({ items, def }: { items: [string, string][]; def?: string }) {
  const [view, setView] = useView(def || items[0][0]);
  return <div className="ctl" style={{ padding: '6px 8px' }}><SegCtl label="View" items={items} value={view} onChange={setView} /></div>;
}
