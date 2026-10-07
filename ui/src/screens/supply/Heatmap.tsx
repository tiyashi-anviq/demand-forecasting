import { useData } from '../../data/DataProvider';
import { useTip } from '../../components/Tip';

export default function Heatmap({ week, onPick }: { week: number; onPick: (depot: string, prod: string) => void }) {
  const { D, nameOf } = useData();
  const tip = useTip();
  const ps = D.prods, hd = Object.keys(D.dep);
  return (
    <>
      <div className="legend">
        <span><span className="sw" style={{ background: 'var(--crit)' }} />&lt; 0.6 wk</span>
        <span><span className="sw" style={{ background: 'var(--neutral)' }} />0.6 – 3 wk</span>
        <span><span className="sw" style={{ background: 'var(--s1)' }} />&gt; 3 wk</span>
      </div>
      <div className="tw" style={{ maxHeight: 'none' }}>
        <table className="t">
          <thead><tr><th>Depot</th>{ps.map((p) => <th key={p.id} className="n" title={p.name} style={{ fontSize: 10.5 }}>{p.id}</th>)}</tr></thead>
          <tbody>{hd.map((d) => (
            <tr key={d}><td><b>{D.dep[d]}</b></td>{ps.map((p) => {
              const w = D.kol[d + '|' + p.id].w[week];
              const c = w == null ? '' : w < 0.6 ? 'var(--crit)' : w > 3 ? 'var(--s1)' : 'var(--neutral)';
              return <td key={p.id} className="n hm" style={{ background: c ? `color-mix(in srgb,${c} ${w < 0.6 || w > 3 ? 55 : 14}%,transparent)` : '', cursor: 'pointer', fontSize: 11.5 }}
                onClick={() => onPick(d, p.id)}
                onMouseMove={(ev) => tip.show(<><b>{D.dep[d]} · {nameOf(p.id)}</b><div>{String(w)} weeks of cover</div></>, ev)}
                onMouseLeave={tip.hide}>{w == null ? '' : w.toFixed(1)}</td>;
            })}</tr>))}
          </tbody>
        </table>
      </div>
    </>
  );
}
