import { describe, expect, it } from 'vitest';
import { LifeDividendSimulationInput, simulateLifeDividendPlan } from './lifeDividendSimulator';

const baseInput: LifeDividendSimulationInput = {
  currentAge: 30,
  endAge: 40,
  initialCapitalUSD: 100000,
  currentMonthlySalaryUSD: 3000,
  initialMonthlyContributionUSD: 500,
  targetMonthlyIncomeUSD: 1000,
  inflationPct: 0,
  dividendRetentionPct: 0,
  reinvestDividends: false,
  growthProfile: { dividendYieldPct: 1, dividendGrowthPct: 0, assetGrowthPct: 0 },
  incomeProfile: { dividendYieldPct: 5, dividendGrowthPct: 0, assetGrowthPct: 0 },
  stages: [{
    id: 'initial',
    name: 'Inicial',
    startAge: 30,
    salaryGrowthPct: 0,
    contributionMode: 'ANNUAL_GROWTH',
    contributionRatePct: 0,
    contributionGrowthPct: 0,
    maxMonthlyContributionUSD: 0,
    monthlyExtraExpensesUSD: 0,
    annualExtraExpensesUSD: 0,
    dividendAllocationPct: 0
  }]
};

describe('life dividend simulator', () => {
  it('procesa los aportes cada mes y no como un único pago anual', () => {
    const result = simulateLifeDividendPlan({ ...baseInput, endAge: 31 });
    expect(result.points[1].annualContributionUSD).toBe(6000);
    expect(result.points[1].capitalUSD).toBeCloseTo(106000, 6);
  });

  it('permite que el aporte siga al salario y respeta el tope mensual', () => {
    const result = simulateLifeDividendPlan({
      ...baseInput,
      endAge: 32,
      stages: [{
        ...baseInput.stages[0],
        salaryGrowthPct: 10,
        contributionMode: 'SALARY_PERCENTAGE',
        contributionRatePct: 20,
        maxMonthlyContributionUSD: 650
      }]
    });

    expect(result.points[2].monthlySalaryUSD).toBeCloseTo(3630, 2);
    expect(result.points[2].monthlyContributionUSD).toBeLessThanOrEqual(650);
  });

  it('resta gastos de vida del aporte planificado sin retirar capital', () => {
    const result = simulateLifeDividendPlan({
      ...baseInput,
      endAge: 31,
      stages: [{
        ...baseInput.stages[0],
        monthlyExtraExpensesUSD: 100,
        annualExtraExpensesUSD: 1200
      }]
    });

    expect(result.points[1].annualContributionUSD).toBe(3600);
    expect(result.points[1].annualExtraExpensesUSD).toBe(2400);
    expect(result.points[1].capitalUSD).toBeCloseTo(103600, 6);
  });

  it('cambia el ingreso al pasar de crecimiento a dividendos', () => {
    const result = simulateLifeDividendPlan({
      ...baseInput,
      initialMonthlyContributionUSD: 0,
      stages: [
        baseInput.stages[0],
        { ...baseInput.stages[0], id: 'income', name: 'Ingresos', startAge: 35, dividendAllocationPct: 100 }
      ]
    });

    expect(result.points.find(point => point.age === 34)?.netMonthlyDividendUSD).toBeCloseTo(83.33, 1);
    expect(result.points.find(point => point.age === 35)?.netMonthlyDividendUSD).toBeCloseTo(416.67, 1);
  });

  it('aplica retenciones al ingreso y a los dividendos reinvertidos', () => {
    const gross = simulateLifeDividendPlan({ ...baseInput, endAge: 31, initialMonthlyContributionUSD: 0, reinvestDividends: true });
    const net = simulateLifeDividendPlan({ ...baseInput, endAge: 31, initialMonthlyContributionUSD: 0, reinvestDividends: true, dividendRetentionPct: 30 });

    expect(net.points[0].netMonthlyDividendUSD).toBeCloseTo(gross.points[0].grossMonthlyDividendUSD * 0.7, 6);
    expect(net.points[1].capitalUSD).toBeLessThan(gross.points[1].capitalUSD);
  });
});
