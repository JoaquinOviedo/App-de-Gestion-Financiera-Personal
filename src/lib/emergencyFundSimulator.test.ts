import { describe, expect, it } from 'vitest';
import { simulateEmergencyScenario } from './emergencyFundSimulator';

const baseInput = {
  emergencyFundUSD: 6000,
  fixedMonthlyExpensesUSD: 1000,
  targetMonths: 6,
  scenarioMonths: 6,
  incomeLossPct: 100,
  oneTimeEmergencyUSD: 0,
  extraMonthlyExpensesUSD: 0
};

describe('emergency fund simulator', () => {
  it('calcula meses de cobertura y cumplimiento de la meta', () => {
    const result = simulateEmergencyScenario(baseInput);
    expect(result.currentCoverageMonths).toBe(6);
    expect(result.targetFundUSD).toBe(6000);
    expect(result.targetCoveragePct).toBe(100);
    expect(result.finalBalanceUSD).toBe(0);
    expect(result.depletionMonth).toBe(6);
  });

  it('combina pérdida parcial de ingresos y un gasto extraordinario', () => {
    const result = simulateEmergencyScenario({
      ...baseInput,
      incomeLossPct: 50,
      oneTimeEmergencyUSD: 1000,
      extraMonthlyExpensesUSD: 100
    });

    expect(result.monthlyFundUseUSD).toBe(600);
    expect(result.scenarioCostUSD).toBe(4600);
    expect(result.finalBalanceUSD).toBe(1400);
    expect(result.depletionMonth).toBeNull();
  });

  it('muestra el déficit y el mes de agotamiento', () => {
    const result = simulateEmergencyScenario({ ...baseInput, oneTimeEmergencyUSD: 2000 });
    expect(result.finalBalanceUSD).toBe(-2000);
    expect(result.depletionMonth).toBe(4);
  });

  it('no inventa meses de cobertura si no hay gastos configurados', () => {
    const result = simulateEmergencyScenario({ ...baseInput, fixedMonthlyExpensesUSD: 0 });
    expect(result.currentCoverageMonths).toBeNull();
    expect(result.targetCoveragePct).toBeNull();
  });
});
