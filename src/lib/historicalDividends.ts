import { latestInvestmentValueAtOrBefore, type PortfolioHistoryPoint } from './portfolioAnalytics';
import type { MonthlyTTMPoint } from './dividendAnalytics';

function monthIndex(date: string) {
  const [year, month] = date.slice(0, 7).split('-').map(Number);
  return year * 12 + month - 1;
}

function monthLabel(index: number) {
  return `${Math.floor(index / 12)}-${String(index % 12 + 1).padStart(2, '0')}`;
}

export function buildYieldBasedHistoricalMonthlyDividends(
  history: PortfolioHistoryPoint[],
  currentNetYieldPct: number,
  firstRecordedDate: string | null,
  endDate: string,
): MonthlyTTMPoint[] {
  const firstVisibleMonth = monthIndex(firstRecordedDate || endDate);
  const lastMonth = monthIndex(endDate);
  const netYield = Number.isFinite(currentNetYieldPct) ? Math.max(0, currentNetYieldPct) : 0;

  const series: MonthlyTTMPoint[] = [];
  for (let index = firstVisibleMonth; index <= lastMonth; index++) {
    const fecha = monthLabel(index);
    const capital = latestInvestmentValueAtOrBefore(history, fecha);
    if (capital === null) continue;
    // Estimación anual de ese mes: capital histórico por el yield neto vigente.
    const estimatedValue = capital * netYield / 100;
    series.push({
      fecha,
      dividendos: estimatedValue,
      dividendosConocidos: 0,
      dividendosEstimados: estimatedValue,
      calidad: 'ESTIMADO',
    });
  }
  return series;
}
