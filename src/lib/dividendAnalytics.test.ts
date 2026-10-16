import { describe, expect, it } from 'vitest';
import { DividendApiHistory } from '../types';
import { aggregateMonthlyTTM, calculateDividendAnalytics } from './dividendAnalytics';
import { PortfolioPosition } from './portfolioValuationCore';
import { Operacion } from '../types';

const position: PortfolioPosition = {
  ticker: 'SPY',
  name: 'SPDR S&P 500 ETF Trust',
  cantidad: 120,
  costoTotal: 1000,
  precioActualUSD: 10,
  valorActualUSD: 1200
};

const history: DividendApiHistory = {
  ticker: 'SPY',
  fuente: 'YAHOO_FINANCE',
  estado: 'DISPONIBLE',
  actualizado_en: '2026-08-30T12:00:00.000Z',
  eventos: [
    { fecha: '2024-12-15', monto_por_accion_usd: 1 },
    { fecha: '2025-03-15', monto_por_accion_usd: 1 },
    { fecha: '2025-12-15', monto_por_accion_usd: 1.5 },
    { fecha: '2026-03-15', monto_por_accion_usd: 1.5 }
  ]
};

const currentOperations: Operacion[] = [
  {
    id: 'buy-spy',
    tipo: 'COMPRA',
    ticker: 'SPY',
    nombre: 'SPDR S&P 500 ETF Trust',
    icono_url: '',
    cantidad: 120,
    precio_operacion: 8,
    fecha: '2024-01-01'
  }
];

describe('calculateDividendAnalytics', () => {
  it('ajusta cada distribución por cantidad y ratio CEDEAR', () => {
    const result = calculateDividendAnalytics(
      { SPY: history },
      [position],
      { SPY: 60 },
      new Date('2026-08-30T12:00:00.000Z'),
      undefined,
      currentOperations
    );

    expect(result.events[0].monto_usd).toBe(2);
    expect(result.firstEventDate).toBe('2024-12-15');
    expect(result.grossTrailingTwelveMonthsUSD).toBe(6);
    expect(result.trailingTwelveMonthsUSD).toBeCloseTo(4.2);
    expect(result.previousTwelveMonthsUSD).toBeCloseTo(2.8);
    expect(result.growthYoYPct).toBeCloseTo(50);
  });

  it('descuenta por defecto el 30% de impuestos y conserva el bruto', () => {
    const result = calculateDividendAnalytics(
      { SPY: history },
      [position],
      { SPY: 60 },
      new Date('2026-08-30T12:00:00.000Z'),
      undefined,
      currentOperations
    );
    expect(result.grossTrailingTwelveMonthsUSD).toBe(6);
    expect(result.trailingTwelveMonthsUSD).toBeCloseTo(4.2);
    expect(result.monthly[2].dividendos).toBeCloseTo(2.1);
  });

  it('usa la tenencia que existía en la fecha del dividendo', () => {
    const operations: Operacion[] = [
      ...currentOperations,
      { ...currentOperations[0], id: 'sell-spy', tipo: 'VENTA', cantidad: 60, fecha: '2026-01-01' }
    ];
    const result = calculateDividendAnalytics(
      { SPY: history },
      [{ ...position, cantidad: 60 }],
      { SPY: 60 },
      new Date('2026-08-30T12:00:00.000Z'),
      undefined,
      operations
    );

    expect(result.events.find(event => event.fecha === '2025-12-15')?.cantidad_cedears).toBe(120);
    expect(result.events.find(event => event.fecha === '2026-03-15')?.cantidad_cedears).toBe(60);
    expect(result.grossTrailingTwelveMonthsUSD).toBe(4.5);
  });

  it('expone un estimativo actual cuando sólo se conoce la cartera reciente', () => {
    const result = calculateDividendAnalytics(
      { SPY: history },
      [position],
      { SPY: 60 },
      new Date('2026-08-30T12:00:00.000Z'),
      undefined,
      [{ ...currentOperations[0], fecha: '2026-08-08' }]
    );

    expect(result.trailingTwelveMonthsUSD).toBe(0);
    expect(result.estimatedCurrentTrailingTwelveMonthsUSD).toBeCloseTo(4.2);
    expect(result.estimatedCurrentMonthlyUSD).toBeCloseTo(0.35);
    expect(result.estimatedCurrentMonthly.find(item => item.fecha === '2025-12')?.dividendos).toBeCloseTo(2.1);
    const estimatedDecember = result.monthlyBreakdown.find(item => item.fecha === '2025-12');
    expect(estimatedDecember?.dividendosConocidos).toBe(0);
    expect(estimatedDecember?.dividendosEstimadosActuales).toBeCloseTo(2.1);
  });

  it('mantiene el estimativo anual completo cuando la tenencia conocida cubre sólo una parte', () => {
    const result = calculateDividendAnalytics(
      { SPY: history },
      [position],
      { SPY: 60 },
      new Date('2026-08-30T12:00:00.000Z'),
      undefined,
      [{ ...currentOperations[0], fecha: '2026-01-01' }]
    );

    expect(result.trailingTwelveMonthsUSD).toBeCloseTo(2.1);
    expect(result.estimatedCurrentTrailingTwelveMonthsUSD).toBeCloseTo(4.2);
    const estimatedDecember = result.monthlyBreakdown.find(item => item.fecha === '2025-12');
    const knownMarch = result.monthlyBreakdown.find(item => item.fecha === '2026-03');
    expect(estimatedDecember?.dividendosConocidos).toBe(0);
    expect(estimatedDecember?.dividendosEstimadosActuales).toBeCloseTo(2.1);
    expect(knownMarch?.dividendosConocidos).toBeCloseTo(2.1);
    expect(knownMarch?.dividendosEstimadosActuales).toBe(0);
  });

  it('ignora instrumentos sin historial público en vez de inventar dividendos', () => {
    const unavailable = { ...history, ticker: 'COMIAUS', estado: 'NO_DISPONIBLE' as const, eventos: [] };
    const result = calculateDividendAnalytics(
      { COMIAUS: unavailable },
      [{ ...position, ticker: 'COMIAUS' }],
      { COMIAUS: 1 },
      new Date('2026-08-30T12:00:00.000Z'),
      undefined,
      []
    );

    expect(result.events).toEqual([]);
    expect(result.growthYoYPct).toBeNull();
  });

  it('no etiqueta como TTM los meses que todavía no tienen doce meses', () => {
    const result = aggregateMonthlyTTM([
      { fecha: '2025-01', dividendos: 1 },
      { fecha: '2025-02', dividendos: 1 },
      { fecha: '2025-03', dividendos: 1 },
      { fecha: '2025-04', dividendos: 2 },
      { fecha: '2025-05', dividendos: 2 },
      { fecha: '2025-06', dividendos: 2 },
      { fecha: '2025-07', dividendos: 3 },
      { fecha: '2025-08', dividendos: 3 },
      { fecha: '2025-09', dividendos: 3 },
      { fecha: '2025-10', dividendos: 4 },
      { fecha: '2025-11', dividendos: 4 },
      { fecha: '2025-12', dividendos: 4 }
    ], '2025-01-01', '2025-12-31');

    expect(result).toEqual([{
      fecha: '2025-12',
      dividendos: 30,
      dividendosConocidos: 30,
      dividendosEstimados: 0,
      calidad: 'CONOCIDO'
    }]);
  });

  it('calcula un TTM móvil cada mes y conserva si contiene estimaciones', () => {
    const months = Array.from({ length: 20 }, (_, index) => {
      const date = new Date(2025, index, 1);
      const fecha = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const estimated = index === 18 ? 1 : 0;
      return {
        fecha,
        dividendos: 1,
        dividendosConocidos: 1 - estimated,
        dividendosEstimados: estimated
      };
    });

    const result = aggregateMonthlyTTM(months, '2026-01-01', '2026-08-31');

    expect(result.map(item => ({ fecha: item.fecha, dividendos: item.dividendos, calidad: item.calidad }))).toEqual([
      { fecha: '2026-01', dividendos: 12, calidad: 'CONOCIDO' },
      { fecha: '2026-02', dividendos: 12, calidad: 'CONOCIDO' },
      { fecha: '2026-03', dividendos: 12, calidad: 'CONOCIDO' },
      { fecha: '2026-04', dividendos: 12, calidad: 'CONOCIDO' },
      { fecha: '2026-05', dividendos: 12, calidad: 'CONOCIDO' },
      { fecha: '2026-06', dividendos: 12, calidad: 'CONOCIDO' },
      { fecha: '2026-07', dividendos: 12, calidad: 'MIXTO' },
      { fecha: '2026-08', dividendos: 12, calidad: 'MIXTO' }
    ]);
  });

  it('no presenta un TTM cuando falta un mes dentro de la ventana', () => {
    const months = Array.from({ length: 13 }, (_, index) => {
      const date = new Date(2025, index, 1);
      return {
        fecha: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
        dividendos: 1,
      };
    }).filter(item => item.fecha !== '2025-06');

    expect(aggregateMonthlyTTM(months)).toEqual([]);
  });
});
