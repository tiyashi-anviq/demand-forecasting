import { useState } from 'react';
import { API_URL } from '../api/forecastApi';
import { useApp } from '../state/AppState';

/** Downloads the forecast-summary PDF for the given series, built by the API (POST /report/forecast) for the model chosen in the top bar. */
export function ReportButton({ ids, title, scope }: { ids: string[]; title: string; scope: string }) {
  const { model } = useApp();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const go = async () => {
    setBusy(true); setErr('');
    try {
      const r = await fetch(API_URL + '/report/forecast', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ series_ids: ids, model, title, scope }) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || `API /report/forecast returned ${r.status}`);
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement('a'); a.href = url; a.download = `forecast_report_${model}.pdf`; document.body.appendChild(a); a.click(); a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e: any) { setErr(e.message || 'Could not generate the report'); }
    setBusy(false);
  };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <button type="button" className="zbtn" style={{ position: 'static' }} disabled={busy || !ids.length} onClick={go}>{busy ? 'Generating…' : 'Generate report (PDF) ↓'}</button>
      {err && <span className="neg" style={{ fontSize: 12 }}>{err}</span>}
    </span>
  );
}
