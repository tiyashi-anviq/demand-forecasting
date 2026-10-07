import { useMemo, useState, type ReactNode } from 'react';
export interface RCol { k: string; l: string; n?: boolean; f?: (v: any, row: any) => ReactNode | string; txt?: (v: any, row: any) => string }
/** DataTable variant with row click (old `table(..., {onRow})`) and html cells. Same markup/classes as components/DataTable. */
export function RowTable({ cols, rows, per = 12, search, sort: s0, dir: d0 = -1, onRow }: { cols: RCol[]; rows: any[]; per?: number; search?: boolean; sort?: string; dir?: 1 | -1; onRow?: (r: any) => void }) {
  const [sort, setSort] = useState<string | null>(s0 ?? null);
  const [dir, setDir] = useState<number>(d0);
  const [pg, setPg] = useState(0);
  const [q, setQ] = useState('');
  const view = useMemo(() => {
    let r = rows.slice();
    if (q) { const ql = q.toLowerCase(); r = r.filter((x) => cols.some((c) => String(c.txt ? c.txt(x[c.k], x) : x[c.k]).toLowerCase().includes(ql))); }
    if (sort) r.sort((a, b) => { const x = a[sort], y = b[sort]; return (x == null ? -1e18 : x) > (y == null ? -1e18 : y) ? dir : -dir; });
    return r;
  }, [rows, q, sort, dir, cols]);
  const pages = Math.max(1, Math.ceil(view.length / per)), page = Math.min(pg, pages - 1), vis = view.slice(page * per, page * per + per);
  return (
    <div>
      {search && <div style={{ marginBottom: 8 }}><input type="search" placeholder="Search table…" value={q} onChange={(e) => { setQ(e.target.value); setPg(0); }} style={{ font: 'inherit', fontSize: 13, padding: '6px 8px', border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--text)' }} /></div>}
      <div className="tw thin-scroll">
        <table className="t">
          <thead><tr>{cols.map((c) => <th key={c.k} className={(c.n ? 'n ' : '') + 's'} onClick={() => { setDir(sort === c.k ? -dir : -1); setSort(c.k); }}>{c.l}{sort === c.k ? (dir < 0 ? ' ▾' : ' ▴') : ''}</th>)}</tr></thead>
          <tbody>
            {vis.map((r, i) => <tr key={i} style={onRow ? { cursor: 'pointer' } : undefined} onClick={onRow ? () => onRow(r) : undefined}>{cols.map((c) => <td key={c.k} className={c.n ? 'n' : ''}>{c.f ? c.f(r[c.k], r) : r[c.k] ?? ''}</td>)}</tr>)}
            {!vis.length && <tr><td colSpan={cols.length} className="muted">No rows match.</td></tr>}
          </tbody>
        </table>
      </div>
      {(pages > 1 || search) && <div className="pg"><button type="button" disabled={page === 0} onClick={() => setPg(page - 1)}>‹ Prev</button><span>Page {page + 1} / {pages} · {view.length} rows</span><button type="button" disabled={page >= pages - 1} onClick={() => setPg(page + 1)}>Next ›</button></div>}
    </div>
  );
}
