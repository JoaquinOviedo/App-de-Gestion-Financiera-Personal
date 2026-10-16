import type { FondoEmergencia } from '../types';

const validBalance = (value: number | undefined) =>
  Number.isFinite(value) ? Math.max(0, value ?? 0) : 0;

export function normalizeEmergencyFund(fund: Partial<FondoEmergencia> | undefined): FondoEmergencia {
  const hasSeparateBalances = Number.isFinite(fund?.saldo_ars) || Number.isFinite(fund?.saldo_usd);
  const legacyBalance = validBalance(fund?.saldo_actual);
  const months = fund?.meta_meses;

  return {
    saldo_ars: hasSeparateBalances ? validBalance(fund?.saldo_ars) : fund?.moneda === 'USD' ? 0 : legacyBalance,
    saldo_usd: hasSeparateBalances ? validBalance(fund?.saldo_usd) : fund?.moneda === 'USD' ? legacyBalance : 0,
    meta_meses: Number.isFinite(months) && (months ?? 0) > 0 ? months! : 6,
    incluir_usd_en_cobertura: fund?.incluir_usd_en_cobertura === true,
    ...(fund?.moneda_legacy || fund?.moneda ? { moneda_legacy: fund.moneda_legacy || fund.moneda } : {}),
  };
}

export function emergencyFundValueUSD(fund: FondoEmergencia, mep: number): number {
  if (!Number.isFinite(mep) || mep <= 0) throw new Error('Se requiere una cotización MEP válida para valuar el fondo.');
  const balances = normalizeEmergencyFund(fund);
  return balances.saldo_usd + balances.saldo_ars / mep;
}

export function emergencyCoverageValueUSD(fund: FondoEmergencia, mep: number): number {
  if (!Number.isFinite(mep) || mep <= 0) throw new Error('Se requiere una cotización MEP válida para calcular la cobertura.');
  const balances = normalizeEmergencyFund(fund);
  return balances.saldo_ars / mep + (balances.incluir_usd_en_cobertura ? balances.saldo_usd : 0);
}
