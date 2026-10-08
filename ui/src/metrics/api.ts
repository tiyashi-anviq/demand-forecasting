import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { API_URL } from '../api/forecastApi';

export interface MetricModel { key: string; label: string; uses_sales_forecast: boolean; benchmark: boolean }
export interface MetricRow {
  level: 'depot' | 'national' | 'national_total'; horizon: 'M1' | 'M2' | 'M3'; group: string | number | null; model: string; label: string;
  actual: number; n: number; under: number | null; over: number | null; wape: number | null; accuracy: number | null; bias: number | null; mae: number;
  uses_sales_forecast: boolean; benchmark: boolean;
}
export interface WeeklyRow { level: string; week: string; horizon: 'M1' | 'M2' | 'M3'; actual: number; [model: string]: number | string }
export interface MetricsOut { by: string; months: { month: string; weeks: number }[]; month: string | null; origins: Record<string, string> | null; weekly: WeeklyRow[] | null; models: MetricModel[]; files: { name: string; rows: number; models: string[] }[]; rows_used: number; rows_dropped: number; updated: string; rows: MetricRow[] }

/** Forecast accuracy computed live by the API from its backtest files. Refetches when the window regains focus, so a refreshed file shows up without a reload. */
export const useMetrics = (by: 'overall' | 'category' | 'window', month = '') =>
  useQuery({
    queryKey: ['metrics', by, month], retry: 0, staleTime: 30_000, refetchOnWindowFocus: true, placeholderData: keepPreviousData,
    queryFn: async () => {
      const r = await fetch(`${API_URL}/metrics?by=${by}${month ? `&month=${month}` : ''}`);
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || `API /metrics returned ${r.status}`);
      return (await r.json()) as MetricsOut;
    },
  });
