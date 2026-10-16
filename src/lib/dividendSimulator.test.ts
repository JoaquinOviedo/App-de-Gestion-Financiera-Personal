import { describe, expect, it } from 'vitest';
import { simulateDividendPlan } from './dividendSimulator';

const baseInput = {
  initialCapitalUSD: 100000,
  targetMonthlyIncomeUSD: 1200,
  dividendYieldPct: 4,
  dividendGrowthPct: 5,
  assetGrowthPct: 5,
  inflationPct: 3,
  monthlyContributionUSD: 0,
  years: 10,
  reinvestDividends: false
};

describe('dividend simulator', () => {
  it('calcula el capital requerido a partir del yield', () => {
    const result = simulateDividendPlan(baseInput);
    expect(result.capitalRequiredTodayUSD).toBe(360000);
  });

  it('mantiene el yield cuando dividendos y activos crecen al mismo ritmo', () => {
    const result = simulateDividendPlan(baseInput);
    expect(result.points[10].dividendYieldPct).toBeCloseTo(4, 8);
    expect(result.points[10].targetMonthlyIncomeUSD).toBeGreaterThan(1200);
  });

  it('la reinversión aumenta el capital y los dividendos proyectados', () => {
    const withoutReinvestment = simulateDividendPlan(baseInput);
    const withReinvestment = simulateDividendPlan({ ...baseInput, reinvestDividends: true });

    expect(withReinvestment.points[10].capitalUSD).toBeGreaterThan(withoutReinvestment.points[10].capitalUSD);
    expect(withReinvestment.points[10].monthlyDividendUSD).toBeGreaterThan(withoutReinvestment.points[10].monthlyDividendUSD);
  });

  it('no inventa capital requerido cuando el yield es cero', () => {
    const result = simulateDividendPlan({ ...baseInput, dividendYieldPct: 0 });
    expect(result.capitalRequiredTodayUSD).toBeNull();
    expect(result.targetReachedYear).toBeNull();
  });

  it('incorpora el aporte todos los meses', () => {
    const result = simulateDividendPlan({
      ...baseInput,
      initialCapitalUSD: 0,
      monthlyContributionUSD: 100,
      dividendYieldPct: 0,
      dividendGrowthPct: 0,
      assetGrowthPct: 0,
      years: 1
    });
    expect(result.points[1].capitalUSD).toBe(1200);
  });

  it('calcula el objetivo con el yield neto de retenciones', () => {
    const result = simulateDividendPlan({ ...baseInput, dividendRetentionPct: 25 });
    expect(result.capitalRequiredTodayUSD).toBe(480000);
  });
});
