import { useState } from 'react';
import { fK, fN, niceTicks } from '../lib/format';
import { Legend } from './LineChart';
import { useTip } from './Tip';

export interface BarSeries { name: string; color: string; data: (number | null)[] }
export interface BarCfg { id: string; cats: string[]; series: BarSeries[]; stack?: boolean; yfmt?: (v: number) => string; tfmt?: (v: number) => string; h?: number; ymax?: number; rot?: boolean; title?: string; tipExtra?: (c: number) => React.ReactNode }
export function BarChart({ cfg }: { cfg: BarCfg }) {
  const tip = useTip();
  const [off, setOff] = useState<Set<number>>(new Set());
  const Wd = 820, H = cfg.h || 260, m = { l: 54, r: 12, t: 10, b: cfg.rot ? 58 : 30 }, nc = cfg.cats.length;
  const act = cfg.series.filter((_, i) => !off.has(i));
  let hi = 0, lo = 0;
  for (let c = 0; c < nc; c++) {
    if (cfg.stack) { let p = 0, q = 0; act.forEach((s) => { const v = s.data[c] || 0; v >= 0 ? (p += v) : (q += v); }); hi = Math.max(hi, p); lo = Math.min(lo, q); }
    else act.forEach((s) => { const v = s.data[c] || 0; hi = Math.max(hi, v); lo = Math.min(lo, v); });
  }
  if (cfg.ymax != null) hi = cfg.ymax;
  const tk = niceTicks(lo, hi || 1, 5), y0 = tk[0], y1 = tk[tk.length - 1];
  const Y = (v: number) => m.t + (1 - (v - y0) / (y1 - y0 || 1)) * (H - m.t - m.b);
  const bw = (Wd - m.l - m.r) / nc, k = act.length, inner = Math.min(bw * 0.78, cfg.stack ? 44 : Math.max(10, bw * 0.78));
  const yf = cfg.yfmt || fK;
  const bars: React.ReactNode[] = [];
  for (let c = 0; c < nc; c++) {
    const cx = m.l + bw * c + bw / 2; let top = 0, bot = 0;
    act.forEach((s, j) => {
      const v = s.data[c] || 0;
      if (cfg.stack) {
        const w = inner, x = cx - w / 2, a = v >= 0 ? top : bot, b = a + v; if (v >= 0) top = b; else bot = b;
        const ya = Y(Math.max(a, b)), yb = Y(Math.min(a, b));
        bars.push(<rect key={`${c}-${j}`} x={x} y={ya} width={w} height={Math.max(0, yb - ya - 1.5)} fill={s.color} />);
      } else {
        const w = Math.min(26, inner / k - 2), x = cx - (k * (w + 2)) / 2 + j * (w + 2), ya = Y(Math.max(0, v)), yb = Y(Math.min(0, v));
        bars.push(<rect key={`${c}-${j}`} x={x} y={ya} width={w} height={Math.max(0, yb - ya)} fill={s.color} />);
      }
    });
    bars.push(cfg.rot
      ? <text key={`l${c}`} transform={`translate(${cx},${H - m.b + 12}) rotate(-35)`} textAnchor="end">{cfg.cats[c]}</text>
      : <text key={`l${c}`} x={cx} y={H - 10} textAnchor="middle">{cfg.cats[c]}</text>);
    bars.push(<rect key={`h${c}`} x={m.l + bw * c} y={m.t} width={bw} height={H - m.t - m.b} fill="transparent"
      onMouseMove={(ev) => tip.show(<><b>{cfg.cats[c]}</b>{cfg.series.map((s, i) => off.has(i) ? null : <div className="r" key={i}><span><i style={{ background: s.color }} />{s.name}</span><b>{(cfg.tfmt || cfg.yfmt || fN)(s.data[c] as number)}</b></div>)}{cfg.tipExtra?.(c)}</>, ev)}
      onMouseLeave={tip.hide} />);
  }
  return (
    <div>
      {cfg.series.length > 1 && <Legend series={cfg.series} off={off} setOff={setOff} />}
      <svg className="ch" viewBox={`0 0 ${Wd} ${H}`} role="img" aria-label={cfg.title || 'chart'}>
        {tk.map((t) => <g key={t}><line className="grid" x1={m.l} x2={Wd - m.r} y1={Y(t)} y2={Y(t)} /><text x={m.l - 6} y={Y(t) + 4} textAnchor="end">{yf(t)}</text></g>)}
        <line className="axis" x1={m.l} x2={Wd - m.r} y1={Y(0)} y2={Y(0)} />
        {bars}
      </svg>
    </div>
  );
}
