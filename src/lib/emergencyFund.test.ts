import { describe, expect, it } from 'vitest';
import { emergencyCoverageValueUSD, emergencyFundValueUSD, normalizeEmergencyFund } from './emergencyFund';

describe('fondo de emergencia en dos monedas', () => {
  it('conserva el saldo previo al migrar desde ARS o USD', () => {
    expect(normalizeEmergencyFund({ saldo_actual: 2_400_000, meta_meses: 6, moneda: 'ARS' })).toMatchObject({
      saldo_ars: 2_400_000, saldo_usd: 0, moneda_legacy: 'ARS',
    });
    expect(normalizeEmergencyFund({ saldo_actual: 1_500, meta_meses: 6, moneda: 'USD' })).toMatchObject({
      saldo_ars: 0, saldo_usd: 1_500, moneda_legacy: 'USD',
    });
  });

  it('suma ambos saldos sólo después de convertir los pesos a USD', () => {
    const fund = normalizeEmergencyFund({ saldo_ars: 2_400_000, saldo_usd: 1_500, meta_meses: 6 });
    expect(emergencyFundValueUSD(fund, 1_200)).toBe(3_500);
    expect(emergencyFundValueUSD(fund, 1_600)).toBe(3_000);
    expect(() => emergencyFundValueUSD(fund, 0)).toThrow('cotización MEP válida');
  });

  it('da prioridad a los dos saldos actuales frente al campo heredado', () => {
    expect(normalizeEmergencyFund({ saldo_ars: 0, saldo_usd: 500, saldo_actual: 2_400_000, moneda: 'ARS' }))
      .toMatchObject({ saldo_ars: 0, saldo_usd: 500 });
  });

  it('reserva los dólares por defecto para la cobertura, sin quitarlos del patrimonio', () => {
    const fund = normalizeEmergencyFund({ saldo_ars: 1_200_000, saldo_usd: 1_000, meta_meses: 6 });
    expect(fund.incluir_usd_en_cobertura).toBe(false);
    expect(emergencyCoverageValueUSD(fund, 1_200)).toBe(1_000);
    expect(emergencyFundValueUSD(fund, 1_200)).toBe(2_000);
  });

  it('permite contar los dólares en la cobertura sin cambiar el saldo total', () => {
    const fund = normalizeEmergencyFund({ saldo_ars: 1_200_000, saldo_usd: 1_000, meta_meses: 6, incluir_usd_en_cobertura: true });
    expect(emergencyCoverageValueUSD(fund, 1_200)).toBe(2_000);
    expect(emergencyFundValueUSD(fund, 1_200)).toBe(2_000);
    expect(() => emergencyCoverageValueUSD(fund, 0)).toThrow('cotización MEP válida');
  });
});
