import type { ReactNode } from 'react';
/** Segmented control (single choice). */
export function SegCtl({ label, items, value, onChange }: { label?: string; items: [string, string][]; value: string; onChange: (v: string) => void }) {
  const body = <span className="seg">{items.map(([v, l]) => <button key={v} type="button" aria-pressed={v === value} onClick={() => onChange(v)}>{l}</button>)}</span>;
  return label ? <label>{label}{body}</label> : body;
}
/** Native select with a label, in the .ctl row. `all` adds an "All …" option with value ALL. */
export function SelectCtl({ label, items, value, onChange, all }: { label: string; items: [string, string][]; value: string; onChange: (v: string) => void; all?: string }) {
  return (
    <label>{label}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {all && <option value="ALL">{all}</option>}
        {items.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}
export const Ctl = ({ children, style }: { children: ReactNode; style?: React.CSSProperties }) => <div className="ctl" style={style}>{children}</div>;
export function Card({ title, note, children, style, id }: { title?: ReactNode; note?: ReactNode; children?: ReactNode; style?: React.CSSProperties; id?: string }) {
  return <div className="card" style={style} id={id}>{title && <h3>{title}</h3>}{note && <div className="note">{note}</div>}{children}</div>;
}
export function Kpi({ l, v, d, cls = '' }: { l: ReactNode; v: ReactNode; d?: ReactNode; cls?: string }) {
  return <div className="card kpi"><div className="l">{l}</div><div className={'v ' + cls}>{v}</div><div className="d">{d}</div></div>;
}
export const Chip = ({ kind = '', children }: { kind?: '' | 'good' | 'bad' | 'warn'; children: ReactNode }) => <span className={'chip ' + kind}>{children}</span>;
