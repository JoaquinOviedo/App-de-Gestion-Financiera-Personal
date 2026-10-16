import { describe, expect, it } from 'vitest';
import { isManagedFund, parseYahooDividendEvents } from './dividendApi';

describe('parseYahooDividendEvents', () => {
  it('normaliza y ordena los eventos válidos de Yahoo Finance', () => {
    const result = parseYahooDividendEvents({
      chart: {
        result: [{
          events: {
            dividends: {
              later: { date: 1735689600, amount: 1.5 },
              invalid: { date: 0, amount: 0 },
              earlier: { date: 1704067200, amount: 1.25 }
            }
          }
        }]
      }
    });

    expect(result).toEqual([
      { fecha: '2024-01-01', monto_por_accion_usd: 1.25 },
      { fecha: '2025-01-01', monto_por_accion_usd: 1.5 }
    ]);
  });

  it('devuelve una colección vacía ante una respuesta sin dividendos', () => {
    expect(parseYahooDividendEvents({ chart: { result: [{}] } })).toEqual([]);
  });
});

describe('isManagedFund', () => {
  it('identifica COMIAUS y nombres de fondos sin consultar dividendos', () => {
    expect(isManagedFund('COMIAUS', 'CONSULTATIO MULTIMERCADO III - CLASE A')).toBe(true);
    expect(isManagedFund('XYZ', 'Fondo de inversión renta fija')).toBe(true);
    expect(isManagedFund('SPY', 'SPDR S&P 500 ETF Trust')).toBe(false);
  });
});
