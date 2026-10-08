/** Which covariates were present when LightGBM under- or over-forecast, over the backtest weeks.
 *  For each covariate (a weekly on/off flag) it compares the share of missed units that fell in its weeks with the share of
 *  weeks it covers. A covariate whose weeks hold far more of the misses than their share of time is flagged as a driver.
 *  This is an association over the backtest, not proof of cause. */
type Arr = (number | null)[] | undefined;
export interface Drv { name: string; about: string; units: number; unitShare: number; weekShare: number; lift: number; weeksOn: number; avgOn: number; avgOff: number }
export interface DirOut { total: number; weeks: number; drivers: Drv[] }
export interface ErrDrivers { weeks: number; under: DirOut; over: DirOut; notes: string[] }
interface Flag { name: string; about: (on: number[]) => string; on: (i: number) => boolean }

const LIFT_MIN = 1.2, SHARE_MIN = 0.1, TOP = 5;
const fin = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const txt = (v: unknown) => (v == null ? '' : String(v).trim());

/** 75th percentile of a weekly covariate over the history weeks; null when there are too few values to be meaningful. */
function p75(a: unknown[] | undefined, NH: number): number | null {
  const v = (a || []).slice(0, NH).filter(fin).sort((x, y) => x - y);
  return v.length < 8 ? null : v[Math.floor(0.75 * (v.length - 1))];
}
/** Up to three distinct labels from a text covariate in the given weeks, e.g. the festivals behind "Festival week". */
const names = (a: unknown[] | undefined, on: number[]) => {
  const s = [...new Set(on.flatMap((i) => txt(a?.[i]).split(';').map((x) => x.trim()).filter(Boolean)))];
  return s.length ? s.slice(0, 3).join(', ') + (s.length > 3 ? ` and ${s.length - 3} more` : '') : '';
};

export function errorDrivers(o: { a: Arr; f: Arr; cal: Record<string, any> | undefined; NH: number; i0: number; i1: number; ls?: Arr; ec?: Arr; ic?: Arr; national: boolean }): ErrDrivers {
  const cal = o.cal || {}, notes: string[] = [];
  const idx: number[] = [];
  for (let i = Math.max(0, o.i0); i <= Math.min(o.i1, o.NH - 1); i++) if (fin(o.a?.[i]) && fin(o.f?.[i])) idx.push(i);
  const err = (i: number) => (o.a![i] as number) - (o.f![i] as number);   // > 0: under-forecast (missed demand), < 0: over-forecast

  const flags: Flag[] = [];
  const on = (k: string) => (i: number) => !!txt(cal[k]?.[i]) && txt(cal[k]?.[i]) !== '0';
  flags.push({ name: 'Festival week', about: (w) => names(cal.fest, w), on: on('fest') });
  flags.push({ name: 'Festival sell-in window', about: (w) => names(cal.win, w), on: on('win') });
  flags.push({ name: 'Delayed monsoon', about: () => 'monsoon onset later than normal', on: (i) => fin(cal.shock?.[i]) && cal.shock[i] > 0 });
  // Each macro scenario on its own (the calendar joins overlapping ones with "; ").
  const scen = [...new Set<string>((cal.scen || []).flatMap((x: unknown) => txt(x).split(';').map((s) => s.trim()).filter(Boolean)))];
  scen.forEach((s) => flags.push({ name: s, about: () => 'macro scenario', on: (i) => txt(cal.scen?.[i]).split(';').map((x) => x.trim()).includes(s) }));
  const hi = (k: string, name: string, about: string) => { const t = p75(cal[k], o.NH); if (t != null) flags.push({ name, about: () => about, on: (i) => fin(cal[k]?.[i]) && cal[k][i] > t }); };
  hi('rain', 'Heavy rain', 'rainfall in the top quarter of weeks');
  hi('temp', 'Hot weeks', 'temperature in the top quarter of weeks');
  hi('power', 'Long power cuts', 'power-cut hours in the top quarter of weeks');
  hi('dengue', 'High dengue / mosquito risk', 'dengue index in the top quarter of weeks');
  flags.push({ name: 'Margin-first quarter', about: () => 'fiscal quarter run for margin', on: (i) => fin(cal.margin?.[i]) && cal.margin[i] > 0 });
  const pos = (a: Arr) => (i: number) => fin(a?.[i]) && (a![i] as number) > 0;
  if (o.ls?.length) flags.push({ name: 'Stock-outs', about: () => 'lost sales recorded in the selection', on: pos(o.ls) });
  if (o.national) {
    if (o.ec?.length) flags.push({ name: 'Competitor action', about: () => 'a competitor action was taking volume from the selection', on: pos(o.ec) });
    if (o.ic?.length) flags.push({ name: 'New-product cannibalisation', about: () => 'a new Eveready product was taking volume from the selection', on: pos(o.ic) });
  } else notes.push('Competitor actions and new-product cannibalisation are not recorded at depot level, so they are left out.');

  // Drop covariates with no contrast (on in none or all of the weeks) and exact duplicates (e.g. the margin flag and the same-named scenario).
  const seen = new Set<string>();
  const usable = flags.map((fl) => ({ fl, w: idx.filter((i) => fl.on(i)) })).filter(({ w }) => {
    if (!w.length || w.length === idx.length) return false;
    const key = w.join(','); if (seen.has(key)) return false; seen.add(key); return true;
  });

  const dir = (sign: 1 | -1): DirOut => {
    const miss = (i: number) => Math.max(0, sign * err(i));
    const total = idx.reduce((s, i) => s + miss(i), 0), weeks = idx.filter((i) => miss(i) > 0).length;
    if (total <= 0) return { total: 0, weeks: 0, drivers: [] };
    const drivers = usable.map(({ fl, w }) => {
      const units = w.reduce((s, i) => s + miss(i), 0), unitShare = units / total, weekShare = w.length / idx.length;
      const missWeeks = w.filter((i) => miss(i) > 0);
      return { name: fl.name, about: fl.about(missWeeks.length ? missWeeks : w), units, unitShare, weekShare, lift: unitShare / weekShare, weeksOn: w.length,
        avgOn: units / w.length, avgOff: (total - units) / (idx.length - w.length), excess: units - total * weekShare };
    }).filter((d) => d.lift > LIFT_MIN && d.unitShare >= SHARE_MIN).sort((x, y) => y.excess - x.excess).slice(0, TOP)
      .map(({ excess: _e, ...d }) => d);
    return { total, weeks, drivers };
  };
  return { weeks: idx.length, under: dir(1), over: dir(-1), notes };
}
