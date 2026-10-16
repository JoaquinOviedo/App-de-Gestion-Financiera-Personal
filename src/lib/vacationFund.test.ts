import { describe, expect, it } from 'vitest';
import { normalizeVacationFund, vacationFundValueUSD } from './vacationFund';

describe('fondo de vacaciones', () => {
  it('normaliza respaldos anteriores sin fondo', () => {
    expect(normalizeVacationFund(undefined)).toEqual({ saldo_ars: 0, saldo_usd: 0, objetivo_usd: 0 });
    expect(normalizeVacationFund({ saldo_ars: 500, saldo_usd: 100 })).toEqual({ saldo_ars: 500, saldo_usd: 100, objetivo_usd: 0 });
  });

  it('valúa pesos y dólares con MEP sin mezclarlos con gastos mensuales', () => {
    const fund = normalizeVacationFund({ saldo_ars: 1_200_000, saldo_usd: 500 });
    expect(vacationFundValueUSD(fund, 1_200)).toBe(1_500);
    expect(() => vacationFundValueUSD(fund, 0)).toThrow('cotización MEP válida');
  });

  it('mantiene la meta en dólares separada de los saldos', () => {
    const fund = normalizeVacationFund({ saldo_ars: 1_200_000, saldo_usd: 500, objetivo_usd: 3_000 });
    expect(fund.objetivo_usd).toBe(3_000);
    expect(vacationFundValueUSD(fund, 1_200)).toBe(1_500);
    expect(normalizeVacationFund({ ...fund, objetivo_usd: -1 }).objetivo_usd).toBe(0);
  });
});
