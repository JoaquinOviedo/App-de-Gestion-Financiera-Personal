import { DividendApiHistory, Operacion } from '../types';
import { PortfolioPosition } from './portfolioValuationCore';

export interface EstimatedDividendEvent {
  fecha: string;
  ticker: string;
  monto_usd: number;
  cantidad_cedears: number;
}

export interface MonthlyDividendBreakdown {
  fecha: string;
  dividendosConocidos: number;
  dividendosEstimadosActuales: number;
}

export type DividendEstimateQuality = 'CONOCIDO' | 'ESTIMADO' | 'MIXTO';

export interface MonthlyTTMPoint {
  fecha: string;
  dividendos: number;
  dividendosConocidos: number;
  dividendosEstimados: number;
  calidad: DividendEstimateQuality;
}

export interface DividendAnalytics {
  events: EstimatedDividendEvent[];
  grossTrailingTwelveMonthsUSD: number;
  trailingTwelveMonthsUSD: number;
  grossPreviousTwelveMonthsUSD: number;
  previousTwelveMonthsUSD: number;
  estimatedCurrentTrailingTwelveMonthsUSD: number;
  estimatedCurrentPreviousTwelveMonthsUSD: number;
  estimatedCurrentMonthlyUSD: number;
  estimatedCurrentMonthly: Array<{ fecha: string; dividendos: number }>;
  monthlyBreakdown: MonthlyDividendBreakdown[];
  firstEventDate: string | null;
  growthYoYPct: number | null;
  monthly: Array<{ fecha: string; dividendos: number }>;
  monthlyGross: Array<{ fecha: string; dividendos: number }>;
}

export const DEFAULT_DIVIDEND_TAX_PCT = 30;

const toDay = (date: string) => new Date(`${date}T12:00:00Z`);

function shiftYear(date: Date, years: number) {
  const copy = new Date(date);
  copy.setUTCFullYear(copy.getUTCFullYear() + years);
  return copy;
}

function timestamp(value: string) {
  const parsed = new Date(`${value.length === 10 ? `${value}T12:00:00` : value}`);
  return parsed.getTime();
}

function quantityHeldAt(operations: Operacion[], ticker: string, date: string) {
  const eventTime = timestamp(date);
  return operations
    .filter(operation => operation.ticker.toUpperCase().replace(/\.BA$/, '') === ticker)
    .sort((a, b) => timestamp(a.fecha) - timestamp(b.fecha))
    .reduce((quantity, operation) => {
      if (timestamp(operation.fecha) > eventTime) return quantity;
      return quantity + (operation.tipo === 'COMPRA' ? operation.cantidad : -operation.cantidad);
    }, 0);
}

function hasKnownHoldingAt(operations: Operacion[], ticker: string, date: string) {
  const eventTime = timestamp(date);
  return operations.some(operation => (
    operation.ticker.toUpperCase().replace(/\.BA$/, '') === ticker &&
    timestamp(operation.fecha) <= eventTime
  ));
}

export function calculateDividendAnalytics(
  histories: Record<string, DividendApiHistory>,
  positions: PortfolioPosition[],
  ratios: Record<string, number>,
  asOf = new Date(),
  dividendTaxPct = DEFAULT_DIVIDEND_TAX_PCT,
  historicalOperations: Operacion[] = []
): DividendAnalytics {
  const normalizedAsOf = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate(), 12));
  const ttmStart = shiftYear(normalizedAsOf, -1);
  const previousStart = shiftYear(normalizedAsOf, -2);
  const events: EstimatedDividendEvent[] = [];
  let estimatedCurrentGrossTrailingTwelveMonthsUSD = 0;
  let estimatedCurrentGrossPreviousTwelveMonthsUSD = 0;
  const estimatedCurrentGrossMonthlyMap = new Map<string, number>();
  const knownGrossMonthlyMap = new Map<string, number>();
  const unknownCurrentGrossMonthlyMap = new Map<string, number>();
  const apiEventDates: string[] = [];

  for (const position of positions) {
    const ticker = position.ticker.toUpperCase().replace(/\.BA$/, '');
    const history = histories[ticker];
    if (!history || history.estado !== 'DISPONIBLE') continue;
    const ratio = ratios[ticker] && ratios[ticker] > 0 ? ratios[ticker] : 1;
    const currentUnderlyingShares = position.cantidad / ratio;
    history.eventos.forEach(event => {
      apiEventDates.push(event.fecha);
      const eventTime = toDay(event.fecha);
      const currentAmount = event.monto_por_accion_usd * currentUnderlyingShares;
      const month = event.fecha.slice(0, 7);
      estimatedCurrentGrossMonthlyMap.set(month, (estimatedCurrentGrossMonthlyMap.get(month) || 0) + currentAmount);
      if (eventTime > ttmStart && eventTime <= normalizedAsOf) {
        estimatedCurrentGrossTrailingTwelveMonthsUSD += currentAmount;
      }
      if (eventTime > previousStart && eventTime <= ttmStart) {
        estimatedCurrentGrossPreviousTwelveMonthsUSD += currentAmount;
      }

      if (!hasKnownHoldingAt(historicalOperations, ticker, event.fecha)) {
        unknownCurrentGrossMonthlyMap.set(month, (unknownCurrentGrossMonthlyMap.get(month) || 0) + currentAmount);
        return;
      }

      const cedearQuantity = Math.max(0, quantityHeldAt(historicalOperations, ticker, event.fecha));
      if (cedearQuantity <= 0) return;
      const underlyingShares = cedearQuantity / ratio;
      const knownAmount = event.monto_por_accion_usd * underlyingShares;
      knownGrossMonthlyMap.set(month, (knownGrossMonthlyMap.get(month) || 0) + knownAmount);
      events.push({
        fecha: event.fecha,
        ticker,
        monto_usd: knownAmount,
        cantidad_cedears: cedearQuantity
      });
    });
  }

  events.sort((a, b) => a.fecha.localeCompare(b.fecha));
  const grossTrailingTwelveMonthsUSD = events
    .filter(event => toDay(event.fecha) > ttmStart && toDay(event.fecha) <= normalizedAsOf)
    .reduce((sum, event) => sum + event.monto_usd, 0);
  const grossPreviousTwelveMonthsUSD = events
    .filter(event => toDay(event.fecha) > previousStart && toDay(event.fecha) <= ttmStart)
    .reduce((sum, event) => sum + event.monto_usd, 0);
  const netFactor = 1 - Math.min(100, Math.max(0, Number.isFinite(dividendTaxPct) ? dividendTaxPct : DEFAULT_DIVIDEND_TAX_PCT)) / 100;
  const trailingTwelveMonthsUSD = grossTrailingTwelveMonthsUSD * netFactor;
  const previousTwelveMonthsUSD = grossPreviousTwelveMonthsUSD * netFactor;
  const estimatedCurrentTrailingTwelveMonthsUSD = estimatedCurrentGrossTrailingTwelveMonthsUSD * netFactor;
  const estimatedCurrentPreviousTwelveMonthsUSD = estimatedCurrentGrossPreviousTwelveMonthsUSD * netFactor;
  const firstEventDate = apiEventDates.sort()[0] || null;
  const estimatedCurrentMonthly = [...estimatedCurrentGrossMonthlyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fecha, dividendos]) => ({ fecha, dividendos: dividendos * netFactor }));
  const growthYoYPct = estimatedCurrentGrossPreviousTwelveMonthsUSD > 0
    ? ((estimatedCurrentGrossTrailingTwelveMonthsUSD / estimatedCurrentGrossPreviousTwelveMonthsUSD) - 1) * 100
    : null;

  const breakdownMonths = new Set([
    ...knownGrossMonthlyMap.keys(),
    ...unknownCurrentGrossMonthlyMap.keys()
  ]);
  const monthlyBreakdown = [...breakdownMonths]
    .sort()
    .map(fecha => ({
      fecha,
      dividendosConocidos: (knownGrossMonthlyMap.get(fecha) || 0) * netFactor,
      dividendosEstimadosActuales: (unknownCurrentGrossMonthlyMap.get(fecha) || 0) * netFactor
    }));

  const monthlyGrossMap = new Map<string, number>();
  events.forEach(event => {
    const month = event.fecha.slice(0, 7);
    monthlyGrossMap.set(month, (monthlyGrossMap.get(month) || 0) + event.monto_usd);
  });

  const monthlyGross = [...monthlyGrossMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fecha, dividendos]) => ({ fecha, dividendos }));

  return {
    events,
    grossTrailingTwelveMonthsUSD,
    trailingTwelveMonthsUSD,
    grossPreviousTwelveMonthsUSD,
    previousTwelveMonthsUSD,
    estimatedCurrentTrailingTwelveMonthsUSD,
    estimatedCurrentPreviousTwelveMonthsUSD,
    estimatedCurrentMonthlyUSD: estimatedCurrentTrailingTwelveMonthsUSD / 12,
    estimatedCurrentMonthly,
    monthlyBreakdown,
    firstEventDate,
    growthYoYPct,
    monthlyGross,
    monthly: monthlyGross.map(item => ({ ...item, dividendos: item.dividendos * netFactor }))
  };
}

function monthIndex(month: string) {
  const [year, monthNumber] = month.slice(0, 7).split('-').map(Number);
  return (year * 12) + monthNumber - 1;
}

function monthLabel(index: number) {
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

/**
 * Devuelve un punto por mes con la suma móvil de los últimos doce meses.
 * Los límites sólo controlan los puntos visibles; los meses anteriores
 * siguen disponibles para completar la ventana TTM.
 */
export function aggregateMonthlyTTM(
  monthly: Array<{
    fecha: string;
    dividendos: number;
    dividendosConocidos?: number;
    dividendosEstimados?: number;
  }>,
  startDate?: string,
  endDate?: string
): MonthlyTTMPoint[] {
  if (monthly.length === 0) return [];

  const byMonth = new Map<number, { dividendos: number; conocidos: number; estimados: number }>();
  monthly.forEach(item => {
    const index = monthIndex(item.fecha);
    const current = byMonth.get(index) || { dividendos: 0, conocidos: 0, estimados: 0 };
    byMonth.set(index, {
      dividendos: current.dividendos + item.dividendos,
      conocidos: current.conocidos + (item.dividendosConocidos ?? item.dividendos),
      estimados: current.estimados + (item.dividendosEstimados || 0)
    });
  });

  const firstMonthIndex = Math.min(...byMonth.keys());
  const lastMonthIndex = Math.max(...byMonth.keys());
  const firstVisibleIndex = startDate ? monthIndex(startDate) : firstMonthIndex;
  const lastVisibleIndex = endDate ? monthIndex(endDate) : lastMonthIndex;
  const result: MonthlyTTMPoint[] = [];

  for (let index = firstMonthIndex; index <= lastMonthIndex; index++) {
    if (index < firstVisibleIndex || index > lastVisibleIndex) continue;

    const windowStartMonthIndex = index - 11;
    if (windowStartMonthIndex < firstMonthIndex) continue;

    let dividendos = 0;
    let dividendosConocidos = 0;
    let dividendosEstimados = 0;
    let completeWindow = true;
    for (let includedMonth = windowStartMonthIndex; includedMonth <= index; includedMonth++) {
      const month = byMonth.get(includedMonth);
      if (!month) {
        completeWindow = false;
        break;
      }
      dividendos += month.dividendos;
      dividendosConocidos += month.conocidos;
      dividendosEstimados += month.estimados;
    }
    if (!completeWindow) continue;

    const calidad: DividendEstimateQuality = dividendosEstimados > 0
      ? dividendosConocidos > 0 ? 'MIXTO' : 'ESTIMADO'
      : 'CONOCIDO';
    result.push({
      fecha: monthLabel(index),
      dividendos,
      dividendosConocidos,
      dividendosEstimados,
      calidad
    });
  }

  return result;
}
