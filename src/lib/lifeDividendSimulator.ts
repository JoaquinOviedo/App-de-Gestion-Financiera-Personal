export type ContributionMode = 'SALARY_PERCENTAGE' | 'ANNUAL_GROWTH';

export interface PortfolioProfileAssumptions {
  dividendYieldPct: number;
  dividendGrowthPct: number;
  assetGrowthPct: number;
}

export interface LifeStage {
  id: string;
  name: string;
  startAge: number;
  salaryGrowthPct: number;
  contributionMode: ContributionMode;
  contributionRatePct: number;
  contributionGrowthPct: number;
  maxMonthlyContributionUSD: number;
  monthlyExtraExpensesUSD: number;
  annualExtraExpensesUSD: number;
  dividendAllocationPct: number;
}

export interface LifeDividendSimulationInput {
  currentAge: number;
  endAge: number;
  initialCapitalUSD: number;
  currentMonthlySalaryUSD: number;
  initialMonthlyContributionUSD: number;
  targetMonthlyIncomeUSD: number;
  inflationPct: number;
  dividendRetentionPct: number;
  reinvestDividends: boolean;
  growthProfile: PortfolioProfileAssumptions;
  incomeProfile: PortfolioProfileAssumptions;
  stages: LifeStage[];
}

export interface LifeDividendProjectionPoint {
  age: number;
  stageName: string;
  capitalUSD: number;
  monthlySalaryUSD: number;
  monthlyContributionUSD: number;
  annualContributionUSD: number;
  annualExtraExpensesUSD: number;
  grossMonthlyDividendUSD: number;
  netMonthlyDividendUSD: number;
  realMonthlyDividendUSD: number;
  targetMonthlyIncomeUSD: number;
  dividendAllocationPct: number;
  netDividendYieldPct: number;
}

export interface LifeDividendSimulationResult {
  points: LifeDividendProjectionPoint[];
  targetReachedAge: number | null;
}

const safeAmount = (value: number) => Number.isFinite(value) ? Math.max(0, value) : 0;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
const annualFactor = (percent: number) => Math.max(0.01, 1 + clamp(percent, -99, 1000) / 100);
const monthlyFactor = (percent: number) => Math.pow(annualFactor(percent), 1 / 12);

function sortedStages(stages: LifeStage[], currentAge: number): LifeStage[] {
  if (stages.length > 0) return [...stages].sort((a, b) => a.startAge - b.startAge);
  return [{
    id: 'default-stage',
    name: 'Etapa actual',
    startAge: currentAge,
    salaryGrowthPct: 0,
    contributionMode: 'ANNUAL_GROWTH',
    contributionRatePct: 0,
    contributionGrowthPct: 0,
    maxMonthlyContributionUSD: 0,
    monthlyExtraExpensesUSD: 0,
    annualExtraExpensesUSD: 0,
    dividendAllocationPct: 0
  }];
}

function stageAtAge(stages: LifeStage[], age: number) {
  return [...stages].reverse().find(stage => stage.startAge <= age) || stages[0];
}

function capContribution(desired: number, maximum: number) {
  const safeDesired = safeAmount(desired);
  const safeMaximum = safeAmount(maximum);
  return safeMaximum > 0 ? Math.min(safeDesired, safeMaximum) : safeDesired;
}

function blendedValues(
  capital: number,
  allocationPct: number,
  growthYield: number,
  incomeYield: number,
  retentionFactor: number
) {
  const incomeWeight = clamp(allocationPct, 0, 100) / 100;
  const grossYield = (growthYield * (1 - incomeWeight)) + (incomeYield * incomeWeight);
  const grossMonthlyDividend = capital * grossYield / 12;
  return {
    incomeWeight,
    grossYield,
    grossMonthlyDividend,
    netMonthlyDividend: grossMonthlyDividend * retentionFactor
  };
}

export function simulateLifeDividendPlan(input: LifeDividendSimulationInput): LifeDividendSimulationResult {
  const currentAge = Math.max(0, Math.round(input.currentAge));
  const endAge = Math.min(100, Math.max(currentAge + 1, Math.round(input.endAge)));
  const stages = sortedStages(input.stages, currentAge);
  const retentionFactor = 1 - clamp(input.dividendRetentionPct, 0, 100) / 100;
  const inflationFactorMonthly = monthlyFactor(input.inflationPct);
  let cumulativeInflation = 1;
  let capital = safeAmount(input.initialCapitalUSD);
  let salary = safeAmount(input.currentMonthlySalaryUSD);
  let plannedContribution = safeAmount(input.initialMonthlyContributionUSD);
  let growthYield = safeAmount(input.growthProfile.dividendYieldPct) / 100;
  let incomeYield = safeAmount(input.incomeProfile.dividendYieldPct) / 100;
  let targetReachedAge: number | null = null;
  const points: LifeDividendProjectionPoint[] = [];

  const createPoint = (
    age: number,
    annualContribution: number,
    annualExtraExpenses: number,
    displayedMonthlyContribution: number
  ) => {
    const stage = stageAtAge(stages, age);
    const blended = blendedValues(capital, stage.dividendAllocationPct, growthYield, incomeYield, retentionFactor);
    const target = safeAmount(input.targetMonthlyIncomeUSD) * cumulativeInflation;
    const realMonthlyDividend = cumulativeInflation > 0 ? blended.netMonthlyDividend / cumulativeInflation : blended.netMonthlyDividend;

    if (targetReachedAge === null && target > 0 && blended.netMonthlyDividend >= target) {
      targetReachedAge = age;
    }

    points.push({
      age,
      stageName: stage.name,
      capitalUSD: capital,
      monthlySalaryUSD: salary,
      monthlyContributionUSD: displayedMonthlyContribution,
      annualContributionUSD: annualContribution,
      annualExtraExpensesUSD: annualExtraExpenses,
      grossMonthlyDividendUSD: blended.grossMonthlyDividend,
      netMonthlyDividendUSD: blended.netMonthlyDividend,
      realMonthlyDividendUSD: realMonthlyDividend,
      targetMonthlyIncomeUSD: target,
      dividendAllocationPct: blended.incomeWeight * 100,
      netDividendYieldPct: blended.grossYield * retentionFactor * 100
    });
  };

  const initialStage = stageAtAge(stages, currentAge);
  const initialDesired = initialStage.contributionMode === 'SALARY_PERCENTAGE'
    ? salary * clamp(initialStage.contributionRatePct, 0, 100) / 100
    : plannedContribution;
  const initialCapped = capContribution(initialDesired, initialStage.maxMonthlyContributionUSD);
  const initialExpenses = safeAmount(initialStage.monthlyExtraExpensesUSD) + safeAmount(initialStage.annualExtraExpensesUSD) / 12;
  const initialContribution = Math.min(salary > 0 ? salary : initialCapped, Math.max(0, initialCapped - initialExpenses));
  createPoint(currentAge, initialContribution * 12, initialExpenses * 12, initialContribution);

  for (let year = currentAge; year < endAge; year++) {
    let annualContribution = 0;
    let annualExtraExpenses = 0;
    let lastMonthlyContribution = 0;

    for (let month = 0; month < 12; month++) {
      const age = year + month / 12;
      const stage = stageAtAge(stages, age);
      const desiredContribution = stage.contributionMode === 'SALARY_PERCENTAGE'
        ? salary * clamp(stage.contributionRatePct, 0, 100) / 100
        : plannedContribution;
      const cappedContribution = capContribution(desiredContribution, stage.maxMonthlyContributionUSD);
      const extraExpenses = safeAmount(stage.monthlyExtraExpensesUSD) + safeAmount(stage.annualExtraExpensesUSD) / 12;
      const contribution = Math.min(
        salary > 0 ? salary : cappedContribution,
        Math.max(0, cappedContribution - extraExpenses)
      );
      const allocation = clamp(stage.dividendAllocationPct, 0, 100) / 100;
      const growthCapital = capital * (1 - allocation);
      const incomeCapital = capital * allocation;
      const blended = blendedValues(capital, stage.dividendAllocationPct, growthYield, incomeYield, retentionFactor);
      const appreciatedCapital = (growthCapital * monthlyFactor(input.growthProfile.assetGrowthPct))
        + (incomeCapital * monthlyFactor(input.incomeProfile.assetGrowthPct));

      capital = appreciatedCapital + contribution + (input.reinvestDividends ? blended.netMonthlyDividend : 0);
      salary *= monthlyFactor(stage.salaryGrowthPct);
      plannedContribution = stage.contributionMode === 'SALARY_PERCENTAGE'
        ? cappedContribution
        : cappedContribution * monthlyFactor(stage.contributionGrowthPct);
      growthYield *= monthlyFactor(input.growthProfile.dividendGrowthPct) / monthlyFactor(input.growthProfile.assetGrowthPct);
      incomeYield *= monthlyFactor(input.incomeProfile.dividendGrowthPct) / monthlyFactor(input.incomeProfile.assetGrowthPct);
      cumulativeInflation *= inflationFactorMonthly;
      annualContribution += contribution;
      annualExtraExpenses += extraExpenses;
      lastMonthlyContribution = contribution;
    }

    createPoint(year + 1, annualContribution, annualExtraExpenses, lastMonthlyContribution);
  }

  return { points, targetReachedAge };
}
