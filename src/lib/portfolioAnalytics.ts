import { MovimientoPortafolio } from '../types';

export interface PortfolioHistoryPoint {
  fecha: string;
  valor_inversiones: number;
  valor_emergencia: number;
  valor_vacaciones?: number;
  total: number;
}

export interface PortfolioPerformancePoint extends PortfolioHistoryPoint {
  capital_neto: number;
  ganancia_real: number;
  rentabilidad_real_pct: number;
  dividendos_acumulados: number;
}

export interface PeriodPerformance {
  gananciaRealUSD: number;
  rentabilidadRealPct: number;
  aportesUSD: number;
  retirosUSD: number;
  dividendosUSD: number;
}

export function latestInvestmentValueAtOrBefore(
  points: PortfolioHistoryPoint[],
  month: string
): number | null {
  const latest = points.reduce<PortfolioHistoryPoint | null>((best, point) => {
    const value = Number(point.valor_inversiones);
    if (!Number.isFinite(value) || value <= 0 || point.fecha.slice(0, 7) > month) return best;
    return !best || point.fecha > best.fecha ? point : best;
  }, null);

  return latest ? Number(latest.valor_inversiones) : null;
}

const toTime = (date: string) => new Date(`${date}T00:00:00`).getTime();

const isBetween = (date: string, startExclusive: string, endInclusive: string) => (
  toTime(date) > toTime(startExclusive) && toTime(date) <= toTime(endInclusive)
);

export function buildPerformanceSeries(
  points: PortfolioHistoryPoint[],
  movements: MovimientoPortafolio[]
): PortfolioPerformancePoint[] {
  const sortedPoints = [...points].sort((a, b) => toTime(a.fecha) - toTime(b.fecha));
  if (sortedPoints.length === 0) return [];

  const baseline = sortedPoints[0];

  return sortedPoints.map(point => {
    const movementsUntilPoint = movements.filter(movement => (
      isBetween(movement.fecha, baseline.fecha, point.fecha)
    ));
    const aportes = movementsUntilPoint
      .filter(movement => movement.tipo === 'APORTE')
      .reduce((sum, movement) => sum + movement.monto_usd, 0);
    const retiros = movementsUntilPoint
      .filter(movement => movement.tipo === 'RETIRO')
      .reduce((sum, movement) => sum + movement.monto_usd, 0);
    const dividendos = movements
      .filter(movement => movement.tipo === 'DIVIDENDO' && toTime(movement.fecha) <= toTime(point.fecha))
      .reduce((sum, movement) => sum + movement.monto_usd, 0);
    const capitalNeto = baseline.valor_inversiones + aportes - retiros;
    const gananciaReal = point.valor_inversiones - capitalNeto;

    return {
      ...point,
      capital_neto: capitalNeto,
      ganancia_real: gananciaReal,
      rentabilidad_real_pct: capitalNeto > 0 ? (gananciaReal / capitalNeto) * 100 : 0,
      dividendos_acumulados: dividendos
    };
  });
}

export function calculatePeriodPerformance(
  start: PortfolioHistoryPoint,
  end: PortfolioHistoryPoint,
  movements: MovimientoPortafolio[]
): PeriodPerformance {
  const startTime = toTime(start.fecha);
  const endTime = toTime(end.fecha);
  const duration = Math.max(endTime - startTime, 1);
  const periodMovements = movements.filter(movement => isBetween(movement.fecha, start.fecha, end.fecha));
  const externalFlows = periodMovements.filter(movement => movement.tipo !== 'DIVIDENDO');

  const aportesUSD = externalFlows
    .filter(movement => movement.tipo === 'APORTE')
    .reduce((sum, movement) => sum + movement.monto_usd, 0);
  const retirosUSD = externalFlows
    .filter(movement => movement.tipo === 'RETIRO')
    .reduce((sum, movement) => sum + movement.monto_usd, 0);
  const netExternalFlows = aportesUSD - retirosUSD;
  const gananciaRealUSD = end.valor_inversiones - start.valor_inversiones - netExternalFlows;

  // Modified Dietz: weights each external flow by the fraction of the period it remained invested.
  const weightedFlows = externalFlows.reduce((sum, movement) => {
    const signedAmount = movement.tipo === 'APORTE' ? movement.monto_usd : -movement.monto_usd;
    const remainingWeight = Math.max(0, Math.min(1, (endTime - toTime(movement.fecha)) / duration));
    return sum + (signedAmount * remainingWeight);
  }, 0);
  const denominator = start.valor_inversiones + weightedFlows;

  const dividendosUSD = periodMovements
    .filter(movement => movement.tipo === 'DIVIDENDO')
    .reduce((sum, movement) => sum + movement.monto_usd, 0);

  return {
    gananciaRealUSD,
    rentabilidadRealPct: denominator > 0 ? (gananciaRealUSD / denominator) * 100 : 0,
    aportesUSD,
    retirosUSD,
    dividendosUSD
  };
}

export function aggregateMonthlyDividends(
  movements: MovimientoPortafolio[],
  startDate?: string,
  endDate?: string
) {
  const monthly = new Map<string, number>();

  movements
    .filter(movement => movement.tipo === 'DIVIDENDO')
    .filter(movement => !startDate || toTime(movement.fecha) >= toTime(startDate))
    .filter(movement => !endDate || toTime(movement.fecha) <= toTime(endDate))
    .forEach(movement => {
      const month = movement.fecha.slice(0, 7);
      monthly.set(month, (monthly.get(month) || 0) + movement.monto_usd);
    });

  const entries = [...monthly.entries()].sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0 || !endDate) {
    return entries.map(([fecha, dividendos]) => ({ fecha, dividendos }));
  }

  const firstMonth = startDate?.slice(0, 7) || entries[0][0];
  const lastMonth = endDate.slice(0, 7);
  const cursor = new Date(`${firstMonth}-01T12:00:00`);
  const end = new Date(`${lastMonth}-01T12:00:00`);
  const result: Array<{ fecha: string; dividendos: number }> = [];

  while (cursor <= end) {
    const month = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
    result.push({ fecha: month, dividendos: monthly.get(month) || 0 });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return result;
}

export function calculateDividendShield(dividendsUSD: number, annualExpensesUSD: number) {
  return annualExpensesUSD > 0 ? (dividendsUSD / annualExpensesUSD) * 100 : null;
}
