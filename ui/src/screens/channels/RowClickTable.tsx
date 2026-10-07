import { DataTable, type Col } from '../../components/DataTable';

/** DataTable whose rows are clickable. Column 0 renders a hidden marker carrying the row key, so clicks survive sorting/paging. */
export default function RowClickTable({ cols, rows, rowKey, onRow, ...rest }: { cols: Col[]; rows: any[]; rowKey: string; onRow: (row: any) => void; per?: number; sort?: string; dir?: 1 | -1 }) {
  const c0 = cols[0];
  const cols2: Col[] = [{ ...c0, f: (v, r) => <span data-rk={String(r[rowKey])}>{c0.f ? c0.f(v, r) : v}</span> }, ...cols.slice(1)];
  return (
    <div className="rowclick" onClick={(e) => {
      const tr = (e.target as HTMLElement).closest('tbody tr'); const k = tr?.querySelector('[data-rk]')?.getAttribute('data-rk');
      const row = rows.find((r) => String(r[rowKey]) === k); if (row) onRow(row);
    }}>
      <style>{'.rowclick tbody tr{cursor:pointer}'}</style>
      <DataTable cols={cols2} rows={rows} {...rest} />
    </div>
  );
}
