export interface EmergencyScenarioInput {
  emergencyFundUSD: number;
  fixedMonthlyExpensesUSD: number;
  targetMonths: number;
  scenarioMonths: number;
  incomeLossPct: number;
  oneTimeEmergencyUSD: number;
  extraMonthlyExpensesUSD: number;
}

export interface EmergencyScenarioPoint {
  month: number;
  balanceUSD: number;
}

export interface EmergencyScenarioResult {
  points: EmergencyScenarioPoint[];
  currentCoverageMonths: number | null;
  targetFundUSD: number;
  targetCoveragePct: number | null;
  monthlyFundUseUSD: number;
  scenarioCostUSD: number;
  finalBalanceUSD: number;
  depletionMonth: number | null;
}

const safeAmount = (value: number) => Number.isFinite(value) ? Math.max(0, value) : 0;

export function simulateEmergencyScenario(input: EmergencyScenarioInput): EmergencyScenarioResult {
  const fund = safeAmount(input.emergencyFundUSD);
  const fixedExpenses = safeAmount(input.fixedMonthlyExpensesUSD);
  const targetMonths = Math.max(0, input.targetMonths || 0);
  const scenarioMonths = Math.min(120, Math.max(1, Math.round(input.scenarioMonths || 1)));
  const incomeLoss = Math.min(100, Math.max(0, input.incomeLossPct || 0)) / 100;
  const oneTimeEmergency = safeAmount(input.oneTimeEmergencyUSD);
  const extraMonthlyExpenses = safeAmount(input.extraMonthlyExpensesUSD);
  const monthlyFundUse = (fixedExpenses * incomeLoss) + extraMonthlyExpenses;
  const targetFund = fixedExpenses * targetMonths;
  const points: EmergencyScenarioPoint[] = [];

  let balance = fund - oneTimeEmergency;
  let depletionMonth: number | null = balance <= 0 ? 0 : null;
  points.push({ month: 0, balanceUSD: balance });

  for (let month = 1; month <= scenarioMonths; month++) {
    balance -= monthlyFundUse;
    if (depletionMonth === null && balance <= 0) depletionMonth = month;
    points.push({ month, balanceUSD: balance });
  }

  return {
    points,
    currentCoverageMonths: fixedExpenses > 0 ? fund / fixedExpenses : null,
    targetFundUSD: targetFund,
    targetCoveragePct: targetFund > 0 ? (fund / targetFund) * 100 : null,
    monthlyFundUseUSD: monthlyFundUse,
    scenarioCostUSD: oneTimeEmergency + (monthlyFundUse * scenarioMonths),
    finalBalanceUSD: balance,
    depletionMonth
  };
}
