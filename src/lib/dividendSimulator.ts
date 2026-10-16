export interface DividendSimulationInput {
  initialCapitalUSD: number;
  targetMonthlyIncomeUSD: number;
  dividendYieldPct: number;
  dividendGrowthPct: number;
  assetGrowthPct: number;
  inflationPct: number;
  dividendRetentionPct?: number;
  monthlyContributionUSD: number;
  years: number;
  reinvestDividends: boolean;
}

export interface DividendProjectionPoint {
  year: number;
  capitalUSD: number;
  dividendYieldPct: number;
  monthlyDividendUSD: number;
  targetMonthlyIncomeUSD: number;
  realMonthlyDividendUSD: number;
  requiredCapitalUSD: number | null;
}

export interface DividendSimulationResult {
  points: DividendProjectionPoint[];
  capitalRequiredTodayUSD: number | null;
  targetReachedYear: number | null;
}

const safeAmount = (value: number) => Number.isFinite(value) ? Math.max(0, value) : 0;
const safeRate = (value: number) => Number.isFinite(value) ? Math.max(-99, value) / 100 : 0;

export function simulateDividendPlan(input: DividendSimulationInput): DividendSimulationResult {
  const initialCapital = safeAmount(input.initialCapitalUSD);
  const targetMonthly = safeAmount(input.targetMonthlyIncomeUSD);
  const initialYield = safeAmount(input.dividendYieldPct) / 100;
  const dividendGrowth = safeRate(input.dividendGrowthPct);
  const assetGrowth = safeRate(input.assetGrowthPct);
  const inflation = safeRate(input.inflationPct);
  const retentionFactor = 1 - Math.min(100, safeAmount(input.dividendRetentionPct || 0)) / 100;
  const monthlyContribution = safeAmount(input.monthlyContributionUSD);
  const monthlyAssetFactor = Math.pow(1 + assetGrowth, 1 / 12);
  const monthlyDividendGrowthFactor = Math.pow(1 + dividendGrowth, 1 / 12);
  const years = Math.min(60, Math.max(1, Math.round(input.years || 1)));
  const points: DividendProjectionPoint[] = [];

  let capital = initialCapital;
  let currentYield = initialYield;
  let targetReachedYear: number | null = null;

  for (let year = 0; year <= years; year++) {
    const inflationFactor = Math.pow(1 + inflation, year);
    const monthlyDividend = (capital * currentYield * retentionFactor) / 12;
    const adjustedTarget = targetMonthly * inflationFactor;
    const netYield = currentYield * retentionFactor;
    const requiredCapital = netYield > 0 ? (adjustedTarget * 12) / netYield : null;

    if (targetReachedYear === null && monthlyDividend >= adjustedTarget && adjustedTarget > 0) {
      targetReachedYear = year;
    }

    points.push({
      year,
      capitalUSD: capital,
      dividendYieldPct: currentYield * 100,
      monthlyDividendUSD: monthlyDividend,
      targetMonthlyIncomeUSD: adjustedTarget,
      realMonthlyDividendUSD: inflationFactor > 0 ? monthlyDividend / inflationFactor : monthlyDividend,
      requiredCapitalUSD: requiredCapital
    });

    if (year === years) break;

    for (let month = 0; month < 12; month++) {
      const reinvestedDividend = input.reinvestDividends
        ? (capital * currentYield * retentionFactor) / 12
        : 0;
      capital = (capital * monthlyAssetFactor) + monthlyContribution + reinvestedDividend;
      currentYield *= monthlyDividendGrowthFactor / monthlyAssetFactor;
    }
  }

  return {
    points,
    capitalRequiredTodayUSD: initialYield * retentionFactor > 0
      ? (targetMonthly * 12) / (initialYield * retentionFactor)
      : null,
    targetReachedYear
  };
}
