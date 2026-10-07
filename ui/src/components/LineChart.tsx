import { useMemo, useState } from 'react';
import { ComposedModal, ModalHeader, ModalBody } from '@carbon/react';
import { fK, fN, niceTicks } from '../lib/format';
import { useTip } from './Tip';

export interface LineSeries { name: string; color: string; data: (number | null)[]; dash?: boolean; w?: number }
export interface Band { i0: number; i1: number; fill?: string; label?: string; tip?: string }
export interface LineCfg {
  id: string; labels: string[]; series: LineSeries[]; bands?: Band[]; marks?: { i: number; label: string }[];
  yfmt?: (v: number) => string; tfmt?: (v: number) => string; h?: number; yzero?: boolean; ymax?: number; title?: string; tipLabels?: string[]; nozoom?: boolean;
}
export function LineChart({ cfg }: { cfg: LineCfg }) {
  const [off, setOff] = useState<Set<number>>(new Set());
  const [zoom, setZoom] = useState(false);
  return (
    <div className="chart-wrap">
      {!cfg.nozoom && <button className="zbtn" type="button" title="Zoom in on this chart" aria-label="Zoom in" onClick={() => setZoom(true)}>⤢ Zoom</button>}
      <LineChartInner cfg={cfg} off={off} setOff={setOff} />
      {zoom && <ZoomModal cfg={cfg} off={off} setOff={setOff} onClose={() => setZoom(false)} />}
    </div>
  );
}
function LineChartInner({ cfg, off, setOff }: { cfg: LineCfg; off: Set<number>; setOff: (s: Set<number>) => void }) {
  const tip = useTip();
  const [hi, setHi] = useState<number | null>(null);
  const Wd = 820, H = cfg.h || 280, m = { l: 54, r: 14, t: 10, b: 26 }, n = cfg.labels.length;
  const g = useMemo(() => {
    let lo = Infinity, hiV = -Infinity;
    cfg.series.forEach((s, i) => { if (!off.has(i)) s.data.forEach((v) => { if (v != null && isFinite(v)) { lo = Math.min(lo, v); hiV = Math.max(hiV, v); } }); });
    if (cfg.yzero !== false) lo = Math.min(0, lo);
    if (cfg.ymax != null) hiV = cfg.ymax;
    if (!isFinite(lo)) { lo = 0; hiV = 1; }
    const tk = niceTicks(lo, hiV, 5), y0 = tk[0], y1 = tk[tk.length - 1];
    return { tk, X: (i: number) => m.l + (n <= 1 ? 0 : (i * (Wd - m.l - m.r)) / (n - 1)), Y: (v: number) => m.t + (1 - (v - y0) / (y1 - y0 || 1)) * (H - m.t - m.b) };
  }, [cfg, off, n, H]);
  const { tk, X, Y } = g;
  const yf = cfg.yfmt || fK;
  const nt = Math.min(8, n), stp = Math.max(1, Math.floor((n - 1) / (nt - 1 || 1)));
  const xt: number[] = []; for (let i = 0; i < n; i += stp) xt.push(i);
  const paths = cfg.series.map((s, k) => {
    if (off.has(k)) return null; let d = '', pen = false;
    s.data.forEach((v, i) => { if (v == null || !isFinite(v)) { pen = false; return; } d += (pen ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1); pen = true; });
    return { s, d, k };
  });
  const onMove = (ev: React.MouseEvent<SVGRectElement>) => {
    const svg = (ev.currentTarget.ownerSVGElement as SVGSVGElement), r = svg.getBoundingClientRect(), px = ((ev.clientX - r.left) * Wd) / r.width;
    const i = Math.max(0, Math.min(n - 1, Math.round((px - m.l) / ((Wd - m.l - m.r) / (n - 1 || 1)))));
    setHi(i);
    tip.show(<>
      <b>{cfg.tipLabels ? cfg.tipLabels[i] : cfg.labels[i]}</b>
      {(cfg.bands || []).map((b, j) => i >= b.i0 && i <= b.i1 && b.tip ? <div key={j} className="muted">{b.tip}</div> : null)}
      {cfg.series.map((s, k) => off.has(k) ? null : <div className="r" key={k}><span><i style={{ background: s.color }} />{s.name}</span><b>{s.data[i] == null ? '–' : (cfg.tfmt || cfg.yfmt || fN)(s.data[i] as number)}</b></div>)}
    </>, ev);
  };
  return (
    <>
      {cfg.series.length > 1 && <Legend series={cfg.series} off={off} setOff={setOff} />}
      <svg className="ch" viewBox={`0 0 ${Wd} ${H}`} role="img" aria-label={cfg.title || 'chart'}>
        {(cfg.bands || []).map((b, j) => { const xa = X(Math.max(0, b.i0)), xb = X(Math.min(n - 1, b.i1)); return (
          <g key={j}><rect x={xa} y={m.t} width={Math.max(1.5, xb - xa)} height={H - m.t - m.b} fill={b.fill || 'var(--shade-test)'} />
            {b.label && <text x={xa > Wd - 130 ? xa - 4 : xa + 4} textAnchor={xa > Wd - 130 ? 'end' : undefined} y={m.t + 11}>{b.label}</text>}</g>); })}
        {tk.map((t) => <g key={t}><line className="grid" x1={m.l} x2={Wd - m.r} y1={Y(t)} y2={Y(t)} /><text x={m.l - 6} y={Y(t) + 4} textAnchor="end">{yf(t)}</text></g>)}
        <line className="axis" x1={m.l} x2={Wd - m.r} y1={H - m.b} y2={H - m.b} />
        {xt.map((i) => <text key={i} x={X(i)} y={H - 8} textAnchor="middle">{cfg.labels[i]}</text>)}
        {(cfg.marks || []).map((k, j) => <g key={j}><line x1={X(k.i)} x2={X(k.i)} y1={m.t} y2={H - m.b} stroke="var(--neutral)" strokeDasharray="3 3" /><text x={X(k.i) + 3} y={H - m.b - 4}>{k.label}</text></g>)}
        {paths.map((p) => p && <g key={p.k}>
          <path d={p.d} fill="none" stroke={p.s.color} strokeWidth={p.s.w || 2} strokeDasharray={p.s.dash ? '5 4' : undefined} strokeLinejoin="round" strokeLinecap="round" />
          {n <= 40 && p.s.data.map((v, i) => v != null ? <circle key={i} cx={X(i)} cy={Y(v)} r={3} fill={p.s.color} stroke="var(--surface)" strokeWidth={2} /> : null)}</g>)}
        {hi != null && <line x1={X(hi)} x2={X(hi)} y1={m.t} y2={H - m.b} stroke="var(--text-3)" strokeWidth={1} />}
        <rect x={m.l} y={m.t} width={Wd - m.l - m.r} height={H - m.t - m.b} fill="transparent" onMouseMove={onMove} onMouseLeave={() => { setHi(null); tip.hide(); }} />
      </svg>
    </>
  );
}
export function Legend({ series, off, setOff }: { series: { name: string; color: string; dash?: boolean }[]; off: Set<number>; setOff: (s: Set<number>) => void }) {
  return (
    <div className="legend">
      {series.map((s, i) => (
        <button key={i} type="button" className={off.has(i) ? 'off' : ''} onClick={() => { const n = new Set(off); n.has(i) ? n.delete(i) : n.add(i); setOff(n); }}>
          <span className="sw" style={{ background: s.dash ? `repeating-linear-gradient(90deg,${s.color} 0 4px,transparent 4px 7px)` : s.color }} />{s.name}
        </button>))}
    </div>
  );
}
function ZoomModal({ cfg, off, setOff, onClose }: { cfg: LineCfg; off: Set<number>; setOff: (s: Set<number>) => void; onClose: () => void }) {
  const n = cfg.labels.length;
  const [r, setR] = useState<[number, number]>([0, n - 1]);
  const [a, b] = r;
  const sl = <T,>(x: T[]) => x.slice(a, b + 1);
  const cfg2: LineCfg = { ...cfg, id: cfg.id + '_z', nozoom: true, h: Math.max(300, Math.min(620, innerHeight - 340)), labels: sl(cfg.labels), tipLabels: cfg.tipLabels ? sl(cfg.tipLabels) : undefined,
    series: cfg.series.map((s) => ({ ...s, data: sl(s.data) })),
    bands: (cfg.bands || []).filter((k) => k.i1 >= a && k.i0 <= b).map((k) => ({ ...k, i0: k.i0 - a, i1: k.i1 - a })),
    marks: (cfg.marks || []).filter((k) => k.i >= a && k.i <= b).map((k) => ({ ...k, i: k.i - a })) };
  return (
    <ComposedModal open size="lg" onClose={onClose} aria-label="Zoomed chart">
      <ModalHeader title={`${cfg.title || 'Chart'} — zoom`} />
      <ModalBody hasScrollingContent={false}>
        <div className="ctl" style={{ alignItems: 'center' }}>
          <label>From <input type="range" min={0} max={n - 1} value={a} onChange={(e) => setR([Math.min(+e.target.value, b - 3), b])} /></label>
          <label>To <input type="range" min={0} max={n - 1} value={b} onChange={(e) => setR([a, Math.max(+e.target.value, a + 3)])} /></label>
          <button className="zbtn" style={{ position: 'static' }} type="button" onClick={() => setR([Math.max(0, n - 26), n - 1])}>Last 26 wks</button>
          <button className="zbtn" style={{ position: 'static' }} type="button" onClick={() => setR([0, n - 1])}>Full range</button>
          <span className="muted small">{cfg.labels[a]} → {cfg.labels[b]} · {b - a + 1} wks</span>
        </div>
        <LineChartInner cfg={cfg2} off={off} setOff={setOff} />
      </ModalBody>
    </ComposedModal>
  );
}
