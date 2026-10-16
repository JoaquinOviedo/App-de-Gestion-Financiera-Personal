import type { FondoVacaciones } from '../types';

const validBalance = (value: number | undefined) =>
  Number.isFinite(value) ? Math.max(0, value ?? 0) : 0;

export function normalizeVacationFund(fund: Partial<FondoVacaciones> | undefined): FondoVacaciones {
  return {
    saldo_ars: validBalance(fund?.saldo_ars),
    saldo_usd: validBalance(fund?.saldo_usd),
    objetivo_usd: validBalance(fund?.objetivo_usd),
  };
}

export function vacationFundValueUSD(fund: FondoVacaciones, mep: number): number {
  if (!Number.isFinite(mep) || mep <= 0) throw new Error('Se requiere una cotización MEP válida para valuar vacaciones.');
  const balances = normalizeVacationFund(fund);
  return balances.saldo_usd + balances.saldo_ars / mep;
}
