import { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { Info, Plus, Route, Trash2 } from 'lucide-react';
import {
  ContributionMode,
  LifeStage,
  PortfolioProfileAssumptions,
  simulateLifeDividendPlan
} from '../../lib/lifeDividendSimulator';

interface Props {
  currentCapitalUSD: number;
  currentDividendYieldPct: number;
  currentDividendGrowthPct: number | null;
  monthlyExpensesUSD: number;
}

interface SavedLifeScenario {
  currentAge: number;
  endAge: number;
  monthlySalary: number;
  initialContribution: number;
  targetIncome: number;
  inflation: number;
  retention: number;
  reinvest: boolean;
  growthProfile: PortfolioProfileAssumptions;
  incomeProfile: PortfolioProfileAssumptions;
  stages: LifeStage[];
}

const LIFE_SCENARIO_STORAGE_KEY = 'fintech_dividend_life_scenario';

function loadSavedScenario(): SavedLifeScenario | null {
  try {
    const stored = localStorage.getItem(LIFE_SCENARIO_STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as SavedLifeScenario;
    return Array.isArray(parsed.stages) && parsed.stages.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

type ChartMode = 'CAPITAL' | 'INCOME' | 'CASHFLOW' | 'ALLOCATION';

function formatUSD(value: number) {
  return `US$ ${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function Field({ label, value, onChange, suffix, min, max, step = 0.1 }: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  suffix?: string;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <label className="space-y-1">
      <span className="text-xs font-medium text-slate-400">{label}</span>
      <div className="relative">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={event => onChange(Number(event.target.value) || 0)}
          className="w-full bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 pr-12 text-sm text-white tabular-nums focus:outline-none focus:border-violet-500"
        />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">{suffix}</span>}
      </div>
    </label>
  );
}

function ProfileEditor({ title, description, value, onChange }: {
  title: string;
  description: string;
  value: PortfolioProfileAssumptions;
  onChange: (value: PortfolioProfileAssumptions) => void;
}) {
  const update = (field: keyof PortfolioProfileAssumptions, next: number) => onChange({ ...value, [field]: next });
  return (
    <div className="space-y-3 rounded-xl border border-slate-700/50 bg-slate-900/30 p-4">
      <div>
        <h4 className="text-sm font-medium text-slate-200">{title}</h4>
        <p className="text-xs text-slate-500 mt-0.5">{description}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="Yield bruto" value={value.dividendYieldPct} onChange={next => update('dividendYieldPct', next)} min={0} max={30} suffix="%" />
        <Field label="Crec. dividendos" value={value.dividendGrowthPct} onChange={next => update('dividendGrowthPct', next)} min={-50} max={50} suffix="%" />
        <Field label="Revalorización" value={value.assetGrowthPct} onChange={next => update('assetGrowthPct', next)} min={-50} max={50} suffix="%" />
      </div>
    </div>
  );
}

export default function LifePlanSimulator({
  currentCapitalUSD,
  currentDividendYieldPct,
  currentDividendGrowthPct,
  monthlyExpensesUSD
}: Props) {
  const [savedScenario] = useState(loadSavedScenario);
  const [currentAge, setCurrentAge] = useState(savedScenario?.currentAge ?? 30);
  const [endAge, setEndAge] = useState(savedScenario?.endAge ?? 65);
  const [monthlySalary, setMonthlySalary] = useState(savedScenario?.monthlySalary ?? 0);
  const [initialContribution, setInitialContribution] = useState(savedScenario?.initialContribution ?? 0);
  const [targetIncome, setTargetIncome] = useState(savedScenario?.targetIncome ?? Number(monthlyExpensesUSD.toFixed(2)));
  const [inflation, setInflation] = useState(savedScenario?.inflation ?? 0);
  const [retention, setRetention] = useState(savedScenario?.retention ?? 30);
  const [reinvest, setReinvest] = useState(savedScenario?.reinvest ?? true);
  const [chartMode, setChartMode] = useState<ChartMode>('CAPITAL');
  const [growthProfile, setGrowthProfile] = useState<PortfolioProfileAssumptions>(savedScenario?.growthProfile ?? {
    dividendYieldPct: Number(currentDividendYieldPct.toFixed(2)),
    dividendGrowthPct: Number((currentDividendGrowthPct || 0).toFixed(2)),
    assetGrowthPct: 5
  });
  const [incomeProfile, setIncomeProfile] = useState<PortfolioProfileAssumptions>(savedScenario?.incomeProfile ?? {
    dividendYieldPct: Math.max(4, Number(currentDividendYieldPct.toFixed(2))),
    dividendGrowthPct: 3,
    assetGrowthPct: 2
  });
  const [stages, setStages] = useState<LifeStage[]>(savedScenario?.stages ?? [{
    id: 'initial-stage',
    name: 'Etapa actual',
    startAge: 30,
    salaryGrowthPct: 0,
    contributionMode: 'ANNUAL_GROWTH',
    contributionRatePct: 0,
    contributionGrowthPct: 0,
    maxMonthlyContributionUSD: 0,
    monthlyExtraExpensesUSD: 0,
    annualExtraExpensesUSD: 0,
    dividendAllocationPct: 0
  }]);

  useEffect(() => {
    const scenario: SavedLifeScenario = {
      currentAge,
      endAge,
      monthlySalary,
      initialContribution,
      targetIncome,
      inflation,
      retention,
      reinvest,
      growthProfile,
      incomeProfile,
      stages
    };
    try {
      localStorage.setItem(LIFE_SCENARIO_STORAGE_KEY, JSON.stringify(scenario));
    } catch {
      // El simulador sigue funcionando aunque el navegador no permita persistir el escenario.
    }
  }, [currentAge, endAge, growthProfile, incomeProfile, inflation, initialContribution, monthlySalary, reinvest, retention, stages, targetIncome]);

  const simulation = useMemo(() => simulateLifeDividendPlan({
    currentAge,
    endAge,
    initialCapitalUSD: currentCapitalUSD,
    currentMonthlySalaryUSD: monthlySalary,
    initialMonthlyContributionUSD: initialContribution,
    targetMonthlyIncomeUSD: targetIncome,
    inflationPct: inflation,
    dividendRetentionPct: retention,
    reinvestDividends: reinvest,
    growthProfile,
    incomeProfile,
    stages
  }), [
    currentAge,
    endAge,
    currentCapitalUSD,
    monthlySalary,
    initialContribution,
    targetIncome,
    inflation,
    retention,
    reinvest,
    growthProfile,
    incomeProfile,
    stages
  ]);

  const finalPoint = simulation.points[simulation.points.length - 1];
  const sortedStages = [...stages].sort((a, b) => a.startAge - b.startAge);

  const updateCurrentAge = (age: number) => {
    const normalized = Math.max(0, Math.round(age));
    setStages(current => current.map((stage, index) => index === 0 && stage.startAge === currentAge
      ? { ...stage, startAge: normalized }
      : stage));
    setCurrentAge(normalized);
    if (endAge <= normalized) setEndAge(normalized + 1);
  };

  const updateStage = (id: string, data: Partial<LifeStage>) => {
    setStages(current => current.map(stage => stage.id === id ? { ...stage, ...data } : stage));
  };

  const addStage = () => {
    const previous = sortedStages[sortedStages.length - 1];
    const startAge = Math.min(Math.max(currentAge + 1, previous.startAge + 5), Math.max(currentAge + 1, endAge - 1));
    setStages(current => [...current, {
      ...previous,
      id: crypto.randomUUID(),
      name: 'Nueva etapa',
      startAge
    }]);
  };

  const removeStage = (id: string) => {
    if (stages.length <= 1) return;
    setStages(current => current.filter(stage => stage.id !== id));
  };

  const chartLines = chartMode === 'CAPITAL'
    ? [<Line key="capital" type="monotone" dataKey="capitalUSD" name="Capital" stroke="#06b6d4" strokeWidth={3} dot={false} />]
    : chartMode === 'INCOME'
      ? [
          <Line key="income" type="monotone" dataKey="netMonthlyDividendUSD" name="Ingreso neto mensual" stroke="#22c55e" strokeWidth={3} dot={false} />,
          <Line key="target" type="monotone" dataKey="targetMonthlyIncomeUSD" name="Objetivo con inflación" stroke="#f59e0b" strokeWidth={2} strokeDasharray="6 4" dot={false} />
        ]
      : chartMode === 'CASHFLOW'
        ? [
            <Line key="salary" type="monotone" dataKey="monthlySalaryUSD" name="Salario mensual" stroke="#a78bfa" strokeWidth={3} dot={false} />,
            <Line key="contribution" type="monotone" dataKey="monthlyContributionUSD" name="Aporte mensual" stroke="#3b82f6" strokeWidth={2} dot={false} />
          ]
        : [<Line key="allocation" type="stepAfter" dataKey="dividendAllocationPct" name="Orientación a dividendos" stroke="#22c55e" strokeWidth={3} dot={false} />];

  return (
    <div className="p-5 space-y-6">
      <div className="flex gap-2 rounded-lg border border-violet-500/20 bg-violet-500/10 px-3 py-2.5 text-xs text-violet-200">
        <Info size={16} className="shrink-0 mt-0.5" />
        <p>Son supuestos editables, no pronósticos. Los gastos reducen el aporte planificado; no retiran dinero del portafolio. El cambio de composición supone rebalanceo sin impuestos ni costos.</p>
      </div>

      <section className="space-y-3">
        <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2"><Route size={16} className="text-violet-400" /> Punto de partida y horizonte</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label="Edad actual" value={currentAge} onChange={updateCurrentAge} min={0} max={99} step={1} suffix="años" />
          <Field label="Edad final" value={endAge} onChange={value => setEndAge(Math.max(currentAge + 1, Math.round(value)))} min={currentAge + 1} max={100} step={1} suffix="años" />
          <Field label="Salario mensual actual" value={monthlySalary} onChange={setMonthlySalary} min={0} step={100} suffix="USD" />
          <Field label="Aporte mensual actual" value={initialContribution} onChange={setInitialContribution} min={0} step={50} suffix="USD" />
          <Field label="Ingreso mensual objetivo" value={targetIncome} onChange={setTargetIncome} min={0} step={50} suffix="USD" />
          <Field label="Inflación anual" value={inflation} onChange={setInflation} min={-10} max={100} suffix="%" />
          <Field label="Retenciones y comisiones" value={retention} onChange={setRetention} min={0} max={100} suffix="%" />
          <label className="flex items-end pb-2 gap-2 text-sm text-slate-300 cursor-pointer">
            <input type="checkbox" checked={reinvest} onChange={event => setReinvest(event.target.checked)} className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-violet-500 focus:ring-violet-500" />
            Reinvertir dividendos
          </label>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-slate-200">Perfiles de cartera</h4>
            <p className="text-xs text-slate-500 mt-0.5">Cada etapa mezcla estos dos perfiles según su porcentaje orientado a dividendos.</p>
          </div>
          <button
            type="button"
            onClick={() => setGrowthProfile(current => ({
              ...current,
              dividendYieldPct: Number(currentDividendYieldPct.toFixed(2)),
              dividendGrowthPct: Number((currentDividendGrowthPct || 0).toFixed(2))
            }))}
            className="text-xs text-cyan-400 hover:text-cyan-300 whitespace-nowrap"
          >
            Usar rendimiento actual
          </button>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          <ProfileEditor title="Crecimiento" description="Parte orientada principalmente a revalorizar capital." value={growthProfile} onChange={setGrowthProfile} />
          <ProfileEditor title="Dividendos" description="Parte orientada principalmente a generar ingresos." value={incomeProfile} onChange={setIncomeProfile} />
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-slate-200">Etapas de vida</h4>
            <p className="text-xs text-slate-500 mt-0.5">Cada etapa comienza a la edad indicada y continúa hasta la siguiente.</p>
          </div>
          <button type="button" onClick={addStage} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium">
            <Plus size={14} /> Agregar etapa
          </button>
        </div>

        <div className="space-y-3">
          {sortedStages.map(stage => (
            <div key={stage.id} className="rounded-xl border border-slate-700/50 bg-slate-900/30 p-4 space-y-3">
              <div className="flex items-end gap-3">
                <label className="space-y-1 flex-1">
                  <span className="text-xs font-medium text-slate-400">Nombre</span>
                  <input value={stage.name} onChange={event => updateStage(stage.id, { name: event.target.value })} className="w-full bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500" />
                </label>
                <div className="w-32"><Field label="Desde" value={stage.startAge} onChange={value => updateStage(stage.id, { startAge: Math.round(value) })} min={currentAge} max={endAge - 1} step={1} suffix="años" /></div>
                <button type="button" disabled={stages.length <= 1} onClick={() => removeStage(stage.id)} className="p-2.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-30" aria-label={`Eliminar etapa ${stage.name}`}><Trash2 size={16} /></button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <Field label="Crecimiento salarial" value={stage.salaryGrowthPct} onChange={value => updateStage(stage.id, { salaryGrowthPct: value })} min={-50} max={100} suffix="% anual" />
                <label className="space-y-1">
                  <span className="text-xs font-medium text-slate-400">Cómo crece el aporte</span>
                  <select value={stage.contributionMode} onChange={event => updateStage(stage.id, { contributionMode: event.target.value as ContributionMode })} className="w-full bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500">
                    <option value="ANNUAL_GROWTH">Incremento anual</option>
                    <option value="SALARY_PERCENTAGE">Porcentaje del salario</option>
                  </select>
                </label>
                {stage.contributionMode === 'SALARY_PERCENTAGE' ? (
                  <Field label="Porcentaje a aportar" value={stage.contributionRatePct} onChange={value => updateStage(stage.id, { contributionRatePct: value })} min={0} max={100} suffix="% salario" />
                ) : (
                  <Field label="Incremento del aporte" value={stage.contributionGrowthPct} onChange={value => updateStage(stage.id, { contributionGrowthPct: value })} min={-100} max={100} suffix="% anual" />
                )}
                <Field label="Tope de aporte (0 = libre)" value={stage.maxMonthlyContributionUSD} onChange={value => updateStage(stage.id, { maxMonthlyContributionUSD: value })} min={0} step={50} suffix="USD/mes" />
                <Field label="Gastos adicionales" value={stage.monthlyExtraExpensesUSD} onChange={value => updateStage(stage.id, { monthlyExtraExpensesUSD: value })} min={0} step={50} suffix="USD/mes" />
                <Field label="Gastos extraordinarios" value={stage.annualExtraExpensesUSD} onChange={value => updateStage(stage.id, { annualExtraExpensesUSD: value })} min={0} step={100} suffix="USD/año" />
                <Field label="Orientación a dividendos" value={stage.dividendAllocationPct} onChange={value => updateStage(stage.id, { dividendAllocationPct: value })} min={0} max={100} suffix="% cartera" />
              </div>
            </div>
          ))}
        </div>
      </section>

      <div aria-live="polite" className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-slate-900/40 rounded-xl p-4 border border-slate-700/50">
          <p className="text-xs text-slate-400">Capital a los {finalPoint.age}</p>
          <p className="text-lg font-bold text-cyan-300 mt-1">{formatUSD(finalPoint.capitalUSD)}</p>
          <p className="text-xs text-slate-500 mt-1">Aporte final: {formatUSD(finalPoint.monthlyContributionUSD)}/mes</p>
        </div>
        <div className="bg-slate-900/40 rounded-xl p-4 border border-slate-700/50">
          <p className="text-xs text-slate-400">Ingreso neto mensual</p>
          <p className="text-lg font-bold text-emerald-400 mt-1">{formatUSD(finalPoint.netMonthlyDividendUSD)}</p>
          <p className="text-xs text-slate-500 mt-1">Poder de compra actual: {formatUSD(finalPoint.realMonthlyDividendUSD)}</p>
        </div>
        <div className="bg-slate-900/40 rounded-xl p-4 border border-slate-700/50">
          <p className="text-xs text-slate-400">Edad del objetivo</p>
          <p className="text-lg font-bold text-violet-300 mt-1">{simulation.targetReachedAge === null ? 'No se alcanza' : `${simulation.targetReachedAge} años`}</p>
          <p className="text-xs text-slate-500 mt-1">Objetivo final: {formatUSD(finalPoint.targetMonthlyIncomeUSD)}/mes</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {([
          ['CAPITAL', 'Capital'],
          ['INCOME', 'Ingresos'],
          ['CASHFLOW', 'Salario y aportes'],
          ['ALLOCATION', 'Composición']
        ] as Array<[ChartMode, string]>).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setChartMode(id)} className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${chartMode === id ? 'bg-violet-500/15 text-violet-300 border-violet-500/30' : 'text-slate-400 border-slate-700/50 hover:text-slate-200'}`}>{label}</button>
        ))}
      </div>

      <div className="h-[380px] w-full" role="img" aria-label={`Proyección de vida: ${chartMode.toLowerCase()}`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={simulation.points} margin={{ top: 10, right: 24, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis dataKey="age" stroke="#94a3b8" fontSize={12} tickMargin={10} tickFormatter={value => `${value} años`} />
            <YAxis stroke="#94a3b8" fontSize={12} width={76} tickFormatter={value => chartMode === 'ALLOCATION' ? `${Number(value).toFixed(0)}%` : `US$ ${Number(value) >= 1000 ? `${(Number(value) / 1000).toFixed(0)}k` : Number(value).toFixed(0)}`} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '0.75rem' }}
              labelFormatter={(_, payload) => payload?.[0]?.payload ? `${payload[0].payload.age} años · ${payload[0].payload.stageName}` : ''}
              formatter={(value, name) => [chartMode === 'ALLOCATION' ? `${Number(value).toFixed(1)}%` : formatUSD(Number(value || 0)), String(name)]}
            />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            {chartLines}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
