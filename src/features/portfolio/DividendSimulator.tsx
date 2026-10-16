import { useMemo, useState } from 'react';
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
import { Calculator, Info, RefreshCw } from 'lucide-react';
import { simulateDividendPlan } from '../../lib/dividendSimulator';
import LifePlanSimulator from './LifePlanSimulator';

interface Props {
  currentCapitalUSD: number;
  currentDividendYieldPct: number;
  currentDividendShieldPct: number | null;
  currentDividendGrowthPct: number | null;
  monthlyExpensesUSD: number;
}

interface NumericFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}

function NumericField({ label, value, onChange, min, max, step = 0.1, suffix }: NumericFieldProps) {
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
          className="w-full bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 pr-12 text-sm text-white tabular-nums focus:outline-none focus:border-cyan-500"
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 pointer-events-none">{suffix}</span>
        )}
      </div>
    </label>
  );
}

function formatUSD(value: number | null) {
  if (value === null || !Number.isFinite(value)) return '—';
  return `US$ ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function DividendSimulator({
  currentCapitalUSD,
  currentDividendYieldPct,
  currentDividendShieldPct,
  currentDividendGrowthPct,
  monthlyExpensesUSD
}: Props) {
  const [initialCapital, setInitialCapital] = useState(Number(currentCapitalUSD.toFixed(2)));
  const [targetMonthlyIncome, setTargetMonthlyIncome] = useState(Number(monthlyExpensesUSD.toFixed(2)));
  const [dividendYield, setDividendYield] = useState(Number(currentDividendYieldPct.toFixed(2)));
  const [dividendGrowth, setDividendGrowth] = useState(Number((currentDividendGrowthPct || 0).toFixed(2)));
  const [assetGrowth, setAssetGrowth] = useState(0);
  const [inflation, setInflation] = useState(0);
  const [dividendRetention, setDividendRetention] = useState(30);
  const [monthlyContribution, setMonthlyContribution] = useState(0);
  const [years, setYears] = useState(20);
  const [reinvestDividends, setReinvestDividends] = useState(true);
  const [chartMode, setChartMode] = useState<'INCOME' | 'CAPITAL'>('INCOME');
  const [simulationMode, setSimulationMode] = useState<'SIMPLE' | 'LIFE'>('LIFE');

  const simulation = useMemo(() => simulateDividendPlan({
    initialCapitalUSD: initialCapital,
    targetMonthlyIncomeUSD: targetMonthlyIncome,
    dividendYieldPct: dividendYield,
    dividendGrowthPct: dividendGrowth,
    assetGrowthPct: assetGrowth,
    inflationPct: inflation,
    dividendRetentionPct: dividendRetention,
    monthlyContributionUSD: monthlyContribution,
    years,
    reinvestDividends
  }), [
    initialCapital,
    targetMonthlyIncome,
    dividendYield,
    dividendGrowth,
    assetGrowth,
    inflation,
    dividendRetention,
    monthlyContribution,
    years,
    reinvestDividends
  ]);

  const finalPoint = simulation.points[simulation.points.length - 1];
  const requiredGap = simulation.capitalRequiredTodayUSD === null
    ? null
    : Math.max(0, simulation.capitalRequiredTodayUSD - initialCapital);
  const targetStatus = targetMonthlyIncome <= 0
    ? 'Ingresá una meta'
    : simulation.targetReachedYear === null
      ? `No se alcanza en ${years} años`
      : simulation.targetReachedYear === 0
        ? 'Meta alcanzada hoy'
        : `Año ${simulation.targetReachedYear}`;

  const useCurrentValues = () => {
    setInitialCapital(Number(currentCapitalUSD.toFixed(2)));
    setDividendYield(Number(currentDividendYieldPct.toFixed(2)));
    setDividendGrowth(Number((currentDividendGrowthPct || 0).toFixed(2)));
    setTargetMonthlyIncome(Number(monthlyExpensesUSD.toFixed(2)));
  };

  return (
    <section className="bg-slate-800/50 rounded-2xl border border-cyan-500/20 overflow-hidden backdrop-blur-sm">
      <div className="p-5 border-b border-slate-700/50 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <Calculator size={18} className="text-cyan-400" /> Simulador de ingresos por dividendos
          </h3>
          <p className="text-xs text-slate-400 mt-1">Proyectá el capital y el ingreso mensual con supuestos editables.</p>
          <div className="flex bg-slate-900/50 p-1 rounded-lg border border-slate-700/50 mt-3 w-fit">
            <button type="button" onClick={() => setSimulationMode('LIFE')} className={`px-3 py-1.5 rounded-md text-xs font-medium ${simulationMode === 'LIFE' ? 'bg-violet-500/20 text-violet-300' : 'text-slate-400 hover:text-slate-200'}`}>Etapas de vida</button>
            <button type="button" onClick={() => setSimulationMode('SIMPLE')} className={`px-3 py-1.5 rounded-md text-xs font-medium ${simulationMode === 'SIMPLE' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-slate-200'}`}>Proyección simple</button>
          </div>
        </div>
        <div className="text-xs text-slate-400 sm:text-right space-y-1.5">
          <div>Yield observado: <span className="text-emerald-400 font-semibold">{currentDividendYieldPct.toFixed(2)}%</span></div>
          <div>Crecimiento interanual: <span className="text-violet-300 font-semibold">{currentDividendGrowthPct === null ? '—' : `${currentDividendGrowthPct.toFixed(1)}%`}</span></div>
          <div>Escudo actual: <span className="text-cyan-400 font-semibold">{currentDividendShieldPct === null ? '—' : `${currentDividendShieldPct.toFixed(1)}%`}</span></div>
          {simulationMode === 'SIMPLE' && (
            <button
              type="button"
              onClick={useCurrentValues}
              className="inline-flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              <RefreshCw size={13} /> Usar datos actuales
            </button>
          )}
        </div>
      </div>

      {simulationMode === 'LIFE' ? (
        <LifePlanSimulator
          currentCapitalUSD={currentCapitalUSD}
          currentDividendYieldPct={currentDividendYieldPct}
          currentDividendGrowthPct={currentDividendGrowthPct}
          monthlyExpensesUSD={monthlyExpensesUSD}
        />
      ) : (
      <div className="p-5 space-y-5">
        <div className="flex gap-2 rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-2.5 text-xs text-blue-200">
          <Info size={16} className="shrink-0 mt-0.5" />
          <p>El capital requerido se calcula con el yield de dividendos. El escudo indica qué porcentaje de tus gastos anuales cubren los dividendos actuales.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <NumericField label="Capital inicial" value={initialCapital} onChange={setInitialCapital} min={0} step={100} suffix="USD" />
          <NumericField label="Ingreso mensual objetivo" value={targetMonthlyIncome} onChange={setTargetMonthlyIncome} min={0} step={10} suffix="USD" />
          <NumericField label="Yield de dividendos" value={dividendYield} onChange={setDividendYield} min={0} max={30} suffix="%" />
          <NumericField label="Aporte mensual" value={monthlyContribution} onChange={setMonthlyContribution} min={0} step={10} suffix="USD" />
          <NumericField label="Crecimiento anual dividendos" value={dividendGrowth} onChange={setDividendGrowth} min={-50} max={50} suffix="%" />
          <NumericField label="Revalorización anual activos" value={assetGrowth} onChange={setAssetGrowth} min={-50} max={50} suffix="%" />
          <NumericField label="Inflación anual promedio" value={inflation} onChange={setInflation} min={-10} max={100} suffix="%" />
          <NumericField label="Retenciones y comisiones" value={dividendRetention} onChange={setDividendRetention} min={0} max={100} suffix="%" />
          <NumericField label="Horizonte" value={years} onChange={value => setYears(Math.min(60, Math.max(1, Math.round(value))))} min={1} max={60} step={1} suffix="años" />
        </div>

        <label className="inline-flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={reinvestDividends}
            onChange={event => setReinvestDividends(event.target.checked)}
            className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-cyan-500 focus:ring-cyan-500"
          />
          Reinvertir dividendos durante la proyección
        </label>

        {dividendYield <= 0 && (
          <div role="alert" className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-300">
            Ingresá un yield mayor que cero para calcular el capital requerido. Si todavía no registraste dividendos, el yield observado aparece en 0%.
          </div>
        )}

        <div aria-live="polite" className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-slate-900/40 rounded-xl p-4 border border-slate-700/50">
            <p className="text-xs text-slate-400">Capital requerido hoy</p>
            <p className="text-lg font-bold text-cyan-300 mt-1">{formatUSD(simulation.capitalRequiredTodayUSD)}</p>
            <p className="text-xs text-slate-500 mt-1">Brecha: {formatUSD(requiredGap)}</p>
          </div>
          <div className="bg-slate-900/40 rounded-xl p-4 border border-slate-700/50">
            <p className="text-xs text-slate-400">Ingreso mensual al año {years}</p>
            <p className="text-lg font-bold text-emerald-400 mt-1">{formatUSD(finalPoint.monthlyDividendUSD)}</p>
            <p className="text-xs text-slate-500 mt-1">En poder de compra actual: {formatUSD(finalPoint.realMonthlyDividendUSD)}</p>
          </div>
          <div className="bg-slate-900/40 rounded-xl p-4 border border-slate-700/50">
            <p className="text-xs text-slate-400">Cuándo alcanza la meta</p>
            <p className="text-lg font-bold text-violet-300 mt-1">{targetStatus}</p>
            <p className="text-xs text-slate-500 mt-1">Capital final: {formatUSD(finalPoint.capitalUSD)}</p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm font-medium text-slate-300">Proyección anual</p>
          <div className="flex bg-slate-900/50 p-1 rounded-lg border border-slate-700/50">
            <button
              type="button"
              onClick={() => setChartMode('INCOME')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${chartMode === 'INCOME' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Ingresos
            </button>
            <button
              type="button"
              onClick={() => setChartMode('CAPITAL')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${chartMode === 'CAPITAL' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Capital
            </button>
          </div>
        </div>

        <div className="h-[360px] w-full" role="img" aria-label={chartMode === 'INCOME' ? 'Proyección del ingreso mensual por dividendos frente al objetivo ajustado por inflación' : 'Proyección del capital frente al capital requerido'}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={simulation.points} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis dataKey="year" stroke="#94a3b8" fontSize={12} tickMargin={10} tickFormatter={value => `Año ${value}`} />
              <YAxis
                stroke="#94a3b8"
                fontSize={12}
                width={72}
                tickFormatter={value => `US$ ${Number(value) >= 1000 ? `${(Number(value) / 1000).toFixed(0)}k` : Number(value).toFixed(0)}`}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '0.75rem' }}
                labelFormatter={value => `Año ${value}`}
                formatter={(value, name) => [formatUSD(Number(value || 0)), String(name)]}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              {chartMode === 'INCOME' ? (
                <>
                  <Line type="monotone" dataKey="monthlyDividendUSD" name="Ingreso mensual" stroke="#22c55e" strokeWidth={3} dot={false} />
                  <Line type="monotone" dataKey="targetMonthlyIncomeUSD" name="Objetivo con inflación" stroke="#f59e0b" strokeWidth={2} strokeDasharray="6 4" dot={false} />
                </>
              ) : (
                <>
                  <Line type="monotone" dataKey="capitalUSD" name="Capital proyectado" stroke="#06b6d4" strokeWidth={3} dot={false} />
                  <Line type="monotone" dataKey="requiredCapitalUSD" name="Capital requerido" stroke="#a78bfa" strokeWidth={2} strokeDasharray="6 4" dot={false} connectNulls />
                </>
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <p className="text-xs text-slate-500">
          El yield proyectado cambia según la relación entre crecimiento de dividendos y revalorización del activo. La meta aumenta con inflación y los aportes se incorporan mensualmente.
        </p>
      </div>
      )}
    </section>
  );
}
