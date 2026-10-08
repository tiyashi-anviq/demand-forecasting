/** The unit shown above a chart's vertical axis. Set `unit` on the chart; otherwise it is worked out from the axis formatter (percent, points) and falls back to plain units. */
export function unitOf(unit: string | undefined, yfmt?: (v: number) => string): string {
  if (unit) return /^Units/.test(unit) ? unit + ' · L = lakh (1,00,000), Cr = crore (1,00,00,000)' : unit;
  if (!yfmt) return 'Units · L = lakh (1,00,000), Cr = crore (1,00,00,000)';
  const s = yfmt(0.5);
  return /%/.test(s) ? 'Percent' : /pts/.test(s) ? 'Percentage points' : 'Units';
}
