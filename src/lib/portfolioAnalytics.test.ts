import { describe, expect, it } from 'vitest';
import {
  aggregateMonthlyDividends,
  buildPerformanceSeries,
  calculateDividendShield,
  calculatePeriodPerformance,
  latestInvestmentValueAtOrBefore
} from './portfolioAnalytics';
import { MovimientoPortafolio } from '../types';

const movements: MovimientoPortafolio[] = [
  { id: '1', fecha: '2026-02-01', tipo: 'APORTE', monto_usd: 200, nota: 'Aporte' },
  { id: '2', fecha: '2026-02-15', tipo: 'DIVIDENDO', monto_usd: 12, ticker: 'SPY' },
  { id: '3', fecha: '2026-03-01', tipo: 'RETIRO', monto_usd: 50, nota: 'Retiro' },
  { id: '4', fecha: '2026-03-15', tipo: 'DIVIDENDO', monto_usd: 8, ticker: 'VIG' }
];

describe('portfolio analytics', () => {
  it('separa el capital neto de la ganancia real', () => {
    const series = buildPerformanceSeries([
      { fecha: '2026-01-01', valor_inversiones: 1000, valor_emergencia: 0, total: 1000 },
      { fecha: '2026-04-01', valor_inversiones: 1300, valor_emergencia: 0, total: 1300 }
    ], movements);

    expect(series[1].capital_neto).toBe(1150);
    expect(series[1].ganancia_real).toBe(150);
    expect(series[1].dividendos_acumulados).toBe(20);
  });

  it('calcula rendimiento del período descontando aportes y retiros', () => {
    const result = calculatePeriodPerformance(
      { fecha: '2026-01-01', valor_inversiones: 1000, valor_emergencia: 0, total: 1000 },
      { fecha: '2026-04-01', valor_inversiones: 1300, valor_emergencia: 0, total: 1300 },
      movements
    );

    expect(result.gananciaRealUSD).toBe(150);
    expect(result.aportesUSD).toBe(200);
    expect(result.retirosUSD).toBe(50);
    expect(result.dividendosUSD).toBe(20);
    expect(result.rentabilidadRealPct).toBeGreaterThan(12);
    expect(result.rentabilidadRealPct).toBeLessThan(14);
  });

  it('agrupa dividendos por mes y calcula su cobertura de gastos', () => {
    expect(aggregateMonthlyDividends(movements)).toEqual([
      { fecha: '2026-02', dividendos: 12 },
      { fecha: '2026-03', dividendos: 8 }
    ]);
    expect(aggregateMonthlyDividends(movements, '2026-01-01', '2026-04-30')).toEqual([
      { fecha: '2026-01', dividendos: 0 },
      { fecha: '2026-02', dividendos: 12 },
      { fecha: '2026-03', dividendos: 8 },
      { fecha: '2026-04', dividendos: 0 }
    ]);
    expect(calculateDividendShield(1200, 12000)).toBe(10);
    expect(calculateDividendShield(1200, 0)).toBeNull();
  });

  it('usa el último hito anterior y nunca uno futuro para estimar capital', () => {
    const points = [
      { fecha: '2026-01-10', valor_inversiones: 100, valor_emergencia: 0, total: 100 },
      { fecha: '2026-03-01', valor_inversiones: 300, valor_emergencia: 0, total: 300 }
    ];

    expect(latestInvestmentValueAtOrBefore(points, '2025-12')).toBeNull();
    expect(latestInvestmentValueAtOrBefore(points, '2026-02')).toBe(100);
    expect(latestInvestmentValueAtOrBefore(points, '2026-03')).toBe(300);
  });
});
