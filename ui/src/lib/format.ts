const nf = new Intl.NumberFormat('en-IN');
export const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
export function fN(v: number | null | undefined, d = 0): string {
  if (v == null || isNaN(v as number)) return '–';
  const a = Math.abs(v);
  if (a >= 1e7) return (v / 1e7).toFixed(2) + ' Cr';
  if (a >= 1e5) return (v / 1e5).toFixed(2) + ' L';
  if (a >= 1e3 && d === 0) return nf.format(Math.round(v));
  return d ? v.toFixed(d) : nf.format(Math.round(v));
}
export function fK(v: number | null | undefined): string {
  if (v == null || isNaN(v as number)) return '–';
  const a = Math.abs(v);
  if (a >= 1e7) return +(v / 1e7).toFixed(1) + 'Cr';
  if (a >= 1e5) return +(v / 1e5).toFixed(1) + 'L';
  if (a >= 1e3) return +(v / 1e3).toFixed(a >= 1e4 ? 0 : 1) + 'k';
  return String(Math.round(v * 10) / 10);
}
export const fP = (v: number | null | undefined, d = 1) => (v == null || isNaN(v as number) ? '–' : (v * 100).toFixed(d) + '%');
export const fS = (v: number | null | undefined, d = 1) => (v == null || isNaN(v as number) ? '–' : (v >= 0 ? '+' : '') + (v * 100).toFixed(d) + '%');
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const mlab = (s: string) => { const [y, m] = s.split('-'); return MON[+m - 1] + " '" + y.slice(2); };
export const dlabOf = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
export const sum = (a: (number | null | undefined)[]) => a.reduce<number>((x, y) => x + (y || 0), 0);
export function addArr(acc: (number | null)[], arr: (number | null)[]) {
  for (let i = 0; i < arr.length; i++) { const v = arr[i]; acc[i] = acc[i] == null && v == null ? null : (acc[i] || 0) + (v || 0); }
  return acc;
}
export const COL = (i: number) => `var(--s${(i % 8) + 1})`;
export function niceTicks(lo: number, hi: number, n = 5): number[] {
  if (!isFinite(lo) || !isFinite(hi)) return [0, 1];
  if (lo === hi) hi = lo + 1;
  const span = hi - lo, step0 = span / n, mag = Math.pow(10, Math.floor(Math.log10(step0))), f = step0 / mag;
  const step = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * mag;
  const a = Math.floor(lo / step) * step, b = Math.ceil(hi / step) * step, t: number[] = [];
  for (let v = a; v <= b + step / 2; v += step) t.push(+v.toFixed(10));
  return t;
}
