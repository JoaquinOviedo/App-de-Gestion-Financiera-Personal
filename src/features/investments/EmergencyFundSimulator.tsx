import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { simulateEmergencyScenario } from '../../lib/emergencyFundSimulator';

interface Props {
  emergencyFundUSD: number;
  monthlyExpensesUSD: number;
  targetMonths: number;
  includesDollars: boolean;
}

interface NumericFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix: string;
}

function NumericField({ label, value, onChange, min, max, step = 1, suffix }: NumericFieldProps) {
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
          className="w-full bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 pr-14 text-sm text-white tabular-nums focus:outline-none focus:border-yellow-500"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 pointer-events-none">{suffix}</span>
      </div>
    </label>
  );
}

function formatUSD(value: number) {
  const sign = value < 0 ? '-' : '';
  return `${sign}US$ ${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function EmergencyFundSimulator({ emergencyFundUSD, monthlyExpensesUSD, targetMonths, includesDollars }: Props) {
  const [scenarioMonths, setScenarioMonths] = useState(Math.max(1, Math.round(targetMonths || 6)));
  const [incomeLossPct, setIncomeLossPct] = useState(100);
  const [oneTimeEmergencyUSD, setOneTimeEmergencyUSD] = useState(0);
  const [extraMonthlyExpensesUSD, setExtraMonthlyExpensesUSD] = useState(0);

  const simulation = useMemo(() => simulateEmergencyScenario({
    emergencyFundUSD,
    fixedMonthlyExpensesUSD: monthlyExpensesUSD,
    targetMonths,
    scenarioMonths,
    incomeLossPct,
    oneTimeEmergencyUSD,
    extraMonthlyExpensesUSD
  }), [
    emergencyFundUSD,
    monthlyExpensesUSD,
    targetMonths,
    scenarioMonths,
    incomeLossPct,
    oneTimeEmergencyUSD,
    extraMonthlyExpensesUSD
  ]);

  const survivesScenario = simulation.finalBalanceUSD >= 0;
  const chartColor = survivesScenario ? '#eab308' : '#ef4444';
  const depletionMessage = simulation.depletionMonth === null
    ? `No se agota durante los ${scenarioMonths} meses`
    : simulation.depletionMonth === 0
      ? 'Se agota con el gasto inicial'
      : `Se agota en el mes ${simulation.depletionMonth}`;

  return (
    <section className="bg-slate-800/50 rounded-2xl border border-yellow-500/25 overflow-hidden backdrop-blur-sm">
      <div className="p-5 border-b border-slate-700/50">
        <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
          <ShieldCheck size={18} className="text-yellow-400" /> Simulador de cobertura ante imprevistos
        </h3>
        <p className="text-xs text-slate-400 mt-1">Probá cuánto resiste {includesDollars ? 'el fondo completo' : 'la parte en pesos del fondo'} frente a una pérdida de ingresos y gastos inesperados.</p>
      </div>

      <div className="p-5 space-y-5">
        {monthlyExpensesUSD <= 0 && (
          <div role="alert" className="flex gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-300">
            <AlertTriangle size={17} className="shrink-0 mt-0.5" />
            Configurá los gastos mensuales para calcular los meses de cobertura.
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <NumericField
            label="Duración del imprevisto"
            value={scenarioMonths}
            onChange={value => setScenarioMonths(Math.min(120, Math.max(1, Math.round(value))))}
            min={1}
            max={120}
            suffix="meses"
          />
          <NumericField
            label="Pérdida de ingresos"
            value={incomeLossPct}
            onChange={value => setIncomeLossPct(Math.min(100, Math.max(0, value)))}
            min={0}
            max={100}
            suffix="%"
          />
          <NumericField
            label="Gasto extraordinario inicial"
            value={oneTimeEmergencyUSD}
            onChange={setOneTimeEmergencyUSD}
            min={0}
            step={50}
            suffix="USD"
          />
          <NumericField
            label="Gasto adicional mensual"
            value={extraMonthlyExpensesUSD}
            onChange={setExtraMonthlyExpensesUSD}
            min={0}
            step={10}
            suffix="USD"
          />
        </div>

        <div aria-live="polite" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <div className="bg-slate-900/40 rounded-xl p-4 border border-slate-700/50">
            <p className="text-xs text-slate-400">Cobertura actual</p>
            <p className="text-lg font-bold text-yellow-300 mt-1">
              {simulation.currentCoverageMonths === null ? '—' : `${simulation.currentCoverageMonths.toFixed(1)} meses`}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {simulation.targetCoveragePct === null ? 'Sin meta calculable' : `${simulation.targetCoveragePct.toFixed(1)}% de la meta de ${targetMonths} meses`}
            </p>
          </div>
          <div className="bg-slate-900/40 rounded-xl p-4 border border-slate-700/50">
            <p className="text-xs text-slate-400">Uso mensual del fondo</p>
            <p className="text-lg font-bold text-orange-300 mt-1">{formatUSD(simulation.monthlyFundUseUSD)}</p>
            <p className="text-xs text-slate-500 mt-1">Según pérdida de ingresos y gasto adicional</p>
          </div>
          <div className="bg-slate-900/40 rounded-xl p-4 border border-slate-700/50">
            <p className="text-xs text-slate-400">Costo total del escenario</p>
            <p className="text-lg font-bold text-slate-200 mt-1">{formatUSD(simulation.scenarioCostUSD)}</p>
            <p className="text-xs text-slate-500 mt-1">Fondo considerado: {formatUSD(emergencyFundUSD)}</p>
          </div>
          <div className="bg-slate-900/40 rounded-xl p-4 border border-slate-700/50">
            <p className="text-xs text-slate-400">Saldo al finalizar</p>
            <p className={`text-lg font-bold mt-1 ${survivesScenario ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatUSD(simulation.finalBalanceUSD)}
            </p>
            <p className="text-xs text-slate-500 mt-1">{depletionMessage}</p>
          </div>
        </div>

        <div className="h-[320px] w-full" role="img" aria-label="Proyección mensual del saldo del fondo de emergencia durante el escenario">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={simulation.points} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="emergencyBalance" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chartColor} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickMargin={10} tickFormatter={value => `Mes ${value}`} />
              <YAxis
                stroke="#94a3b8"
                fontSize={12}
                width={72}
                tickFormatter={value => `US$ ${Math.abs(Number(value)) >= 1000 ? `${(Number(value) / 1000).toFixed(0)}k` : Number(value).toFixed(0)}`}
              />
              <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="5 4" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '0.75rem' }}
                labelFormatter={value => `Mes ${value}`}
                formatter={value => [formatUSD(Number(value || 0)), 'Saldo del fondo']}
              />
              <Area
                type="monotone"
                dataKey="balanceUSD"
                stroke={chartColor}
                strokeWidth={3}
                fill="url(#emergencyBalance)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <p className="text-xs text-slate-500">
          La pérdida de ingresos indica qué porcentaje de tus gastos fijos debería cubrir el fondo. El gasto extraordinario se descuenta al inicio y el adicional se repite cada mes.
        </p>
      </div>
    </section>
  );
}
