import { describe, expect, it } from 'vitest';
import { buildYieldBasedHistoricalMonthlyDividends } from './historicalDividends';

const history = [
  { fecha: '2024-05-04', valor_inversiones: 100, valor_emergencia: 0, total: 100 },
  { fecha: '2024-07-04', valor_inversiones: 200, valor_emergencia: 0, total: 200 },
];

describe('TTM histórico estimado con el yield vigente', () => {
  it('aplica el yield neto vigente al capital histórico de cada mes, sin seguir fechas de pago', () => {
    const monthly = buildYieldBasedHistoricalMonthlyDividends(history, 12, '2024-05-04', '2024-07-31');
    expect(monthly.map(item => item.fecha)).toEqual(['2024-05', '2024-06', '2024-07']);
    expect(monthly.map(item => item.dividendos)).toEqual([12, 12, 24]);
    expect(monthly.every(item => item.calidad === 'ESTIMADO')).toBe(true);
    expect(monthly[0]).toMatchObject({ dividendosConocidos: 0, dividendosEstimados: 12 });
  });

  it('no inventa puntos si no hay un hito de inversión', () => {
    const monthly = buildYieldBasedHistoricalMonthlyDividends([], 5, null, '2026-09-28');
    expect(monthly).toEqual([]);
  });

  it('no proyecta antes del primer hito y limita la serie al mes de corte', () => {
    const monthly = buildYieldBasedHistoricalMonthlyDividends(history, 5, '2024-07-04', '2024-07-31');
    expect(monthly).toHaveLength(1);
    expect(monthly[0]).toMatchObject({ fecha: '2024-07', dividendos: 10 });
  });
});
