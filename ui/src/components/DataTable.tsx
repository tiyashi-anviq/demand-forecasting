import { useMemo, useState, type ReactNode } from 'react';
export interface Col<R = any> { k: string; l: string; n?: boolean; f?: (v: any, row: R) => ReactNode | string }
export function DataTable<R extends Record<string, any>>({ cols, rows, per = 12, search, maxh, sort: s0, dir: d0 = -1 }: { cols: Col<R>[]; rows: R[]; per?: number; search?: boolean; maxh?: number; sort?: string; dir?: 1 | -1 }) {
  const [sort, setSort] = useState<string | null>(s0 ?? null);
  const [dir, setDir] = useState<number>(d0);
  const [pg, setPg] = useState(0);
  const [q, setQ] = useState('');
  const view = useMemo(() => {
    let r = rows.slice();
    if (q) { const ql = q.toLowerCase(); r = r.filter((x) => cols.some((c) => String(c.f ? (typeof c.f(x[c.k], x) === 'string' ? c.f(x[c.k], x) : x[c.k]) : x[c.k]).toLowerCase().includes(ql))); }
    if (sort) r.sort((a, b) => { const x = a[sort], y = b[sort]; return (x == null ? -1e18 : x) > (y == null ? -1e18 : y) ? dir : -dir; });
    return r;
  }, [rows, q, sort, dir, cols]);
  const pages = Math.max(1, Math.ceil(view.length / per)), page = Math.min(pg, pages - 1), vis = view.slice(page * per, page * per + per);
  return (
    <div>
      {search && <div style={{ marginBottom: 8 }}><input type="search" placeholder="Search table…" value={q} onChange={(e) => { setQ(e.target.value); setPg(0); }} style={{ font: 'inherit', fontSize: 13, padding: '6px 8px', border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--text)' }} /></div>}
      <div className="tw thin-scroll" style={maxh ? { maxHeight: maxh } : undefined}>
        <table className="t">
          <thead><tr>{cols.map((c) => <th key={c.k} className={(c.n ? 'n ' : '') + 's'} onClick={() => { setDir(sort === c.k ? -dir : -1); setSort(c.k); }}>{c.l}{sort === c.k ? (dir < 0 ? ' ▾' : ' ▴') : ''}</th>)}</tr></thead>
          <tbody>{vis.map((r, i) => <tr key={i}>{cols.map((c) => <td key={c.k} className={c.n ? 'n' : ''}>{c.f ? c.f(r[c.k], r) : r[c.k] ?? '–'}</td>)}</tr>)}</tbody>
        </table>
      </div>
      {view.length > per && <div className="pg"><button type="button" disabled={page === 0} onClick={() => setPg(page - 1)}>‹ Prev</button><span>Page {page + 1} of {pages} · {view.length} rows</span><button type="button" disabled={page >= pages - 1} onClick={() => setPg(page + 1)}>Next ›</button></div>}
    </div>
  );
}
