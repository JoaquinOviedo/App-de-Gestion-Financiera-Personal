import { useState } from 'react';
import { useStore } from '../../store/useStore';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { Calculator, Coins, LineChart as LineChartIcon, Plane, RefreshCw, Shield, Wallet } from 'lucide-react';
import { usePortfolioValuation } from '../../lib/portfolioValuation';
import {
  buildPerformanceSeries,
  calculateDividendShield,
  PortfolioHistoryPoint
} from '../../lib/portfolioAnalytics';
import ValuationStatus from '../../components/ValuationStatus';
import DividendSimulator from './DividendSimulator';
import { usePortfolioDividends } from '../../lib/portfolioDividends';
import { sortHistoryForChart } from '../../lib/amChartsHistory';
import { buildYieldBasedHistoricalMonthlyDividends } from '../../lib/historicalDividends';

type ChartView = 'TOTAL' | 'INVERSIONES' | 'EMERGENCIA' | 'VACACIONES' | 'DIVIDENDOS';
type PeriodFilter = '1M' | '6M' | '1Y' | 'TODO';

const chartViews: Array<{ id: ChartView; label: string }> = [
  { id: 'TOTAL', label: 'Patrimonio' },
  { id: 'INVERSIONES', label: 'Inversiones' },
  { id: 'EMERGENCIA', label: 'Emergencia' },
  { id: 'VACACIONES', label: 'Vacaciones' },
  { id: 'DIVIDENDOS', label: 'Dividendos' }
];

const periodFilters: Array<{ id: PeriodFilter; label: string }> = [
  { id: '1M', label: '1 mes' },
  { id: '6M', label: '6 meses' },
  { id: '1Y', label: '1 año' },
  { id: 'TODO', label: 'Todo' }
];

const chartColors: Record<ChartView, string> = {
  TOTAL: '#10b981',
  INVERSIONES: '#3b82f6',
  EMERGENCIA: '#eab308',
  VACACIONES: '#8b5cf6',
  DIVIDENDOS: '#22c55e'
};

const dataKeys: Record<Exclude<ChartView, 'DIVIDENDOS'>, string> = {
  TOTAL: 'total',
  INVERSIONES: 'valor_inversiones',
  EMERGENCIA: 'valor_emergencia',
  VACACIONES: 'valor_vacaciones',
};

const viewLabels: Record<ChartView, string> = {
  TOTAL: 'Patrimonio total',
  INVERSIONES: 'Inversiones',
  EMERGENCIA: 'Fondo de emergencia',
  VACACIONES: 'Fondo de vacaciones',
  DIVIDENDOS: 'Dividendos netos TTM'
};

function formatDate(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');
}

function getPeriodStart(endDate: string, period: PeriodFilter) {
  if (period === 'TODO') return undefined;
  const date = new Date(`${endDate}T12:00:00`);

  if (period === '1M') date.setMonth(date.getMonth() - 1);
  if (period === '6M') date.setMonth(date.getMonth() - 6);
  if (period === '1Y') date.setFullYear(date.getFullYear() - 1);

  return formatDate(date);
}

function formatUSD(value: number) {
  return `US$ ${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function PortfolioTab() {
  const historial = useStore(state => state.historial_patrimonio);
  const fondoEmergencia = useStore(state => state.fondo_emergencia);
  const presupuesto = useStore(state => state.presupuesto);
  const movements = useStore(state => state.movimientos_portafolio || []);
  const valuation = usePortfolioValuation();
  const dividends = usePortfolioDividends(valuation.status === 'ready' ? valuation.positions : []);
  const [view, setView] = useState<ChartView>('TOTAL');
  const [period, setPeriod] = useState<PeriodFilter>('1Y');
  const [showSimulator, setShowSimulator] = useState(false);

  if (valuation.status !== 'ready') return <ValuationStatus valuation={valuation} />;

  const cotizacionMEP = valuation.cotizacionMEP;
  const fondoIsUSD = (fondoEmergencia.moneda_legacy || fondoEmergencia.moneda) === 'USD';
  const currentRecord: PortfolioHistoryPoint = {
    fecha: new Date().toISOString().split('T')[0],
    valor_inversiones: valuation.totalInversionesUSD,
    valor_emergencia: valuation.valorEmergenciaUSD,
    valor_vacaciones: valuation.valorVacacionesUSD,
    total: valuation.totalPatrimonioUSD
  };

  const normalizedHistory: PortfolioHistoryPoint[] = sortHistoryForChart(historial)
    .map(record => {
      const valorInversionesUSD = record.balance_usd ?? record.valor_inversiones;
      const valorEmergenciaUSD = record.valores_normalizados_usd
        ? record.valor_emergencia
        : fondoIsUSD
          ? record.valor_emergencia
          : cotizacionMEP > 0
            ? record.valor_emergencia / cotizacionMEP
            : 0;
      const valorVacacionesUSD = record.valor_vacaciones ?? 0;

      return {
        fecha: record.fecha,
        valor_inversiones: valorInversionesUSD,
        valor_emergencia: valorEmergenciaUSD,
        valor_vacaciones: valorVacacionesUSD,
        total: valorInversionesUSD + valorEmergenciaUSD + valorVacacionesUSD
      };
    });

  const pointsByDate = new Map<string, PortfolioHistoryPoint>();
  [...normalizedHistory, currentRecord]
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .forEach(point => pointsByDate.set(point.fecha, point));

  const performanceSeries = buildPerformanceSeries([...pointsByDate.values()], movements);
  const latestDate = performanceSeries[performanceSeries.length - 1]?.fecha || currentRecord.fecha;
  const periodStart = getPeriodStart(latestDate, period);
  const visibleSeries = performanceSeries.filter(point => !periodStart || point.fecha >= periodStart);
  const ttmStartDate = getPeriodStart(latestDate, '1Y') || latestDate;
  const historyStartDate = performanceSeries[0]?.fecha || latestDate;
  const chartStartDate = period === 'TODO'
    ? historyStartDate
    : periodStart || ttmStartDate;
  const dividendsLastYear = dividends.status === 'ready'
    ? dividends.analytics.estimatedCurrentTrailingTwelveMonthsUSD
    : 0;
  const currentDividendYield = dividends.status === 'ready' && valuation.totalInversionesUSD > 0
    ? (dividendsLastYear / valuation.totalInversionesUSD) * 100
    : 0;
  const dividendSeries = buildYieldBasedHistoricalMonthlyDividends(
    performanceSeries,
    currentDividendYield,
    historial.length > 0 ? historyStartDate : null,
    latestDate,
  ).filter(point => {
    const month = point.fecha;
    return (!chartStartDate || month >= chartStartDate.slice(0, 7)) && month <= latestDate.slice(0, 7);
  });

  const monthlyExpenses = presupuesto.categorias.reduce((categoryTotal, category) => (
    categoryTotal + category.subgastos.reduce((expenseTotal, expense) => (
      expenseTotal + (expense.costo_unitario * expense.frecuencia)
    ), 0)
  ), 0);
  const monthlyExpensesUSD = presupuesto.moneda === 'USD'
    ? monthlyExpenses
    : cotizacionMEP > 0
      ? monthlyExpenses / cotizacionMEP
      : 0;
  const annualExpensesUSD = monthlyExpensesUSD * 12;
  const dividendShield = dividends.status === 'ready'
    ? calculateDividendShield(dividendsLastYear, annualExpensesUSD)
    : null;
  const selectedColor = chartColors[view];
  const selectedDataKey = view === 'DIVIDENDOS' ? 'dividendos' : dataKeys[view];
  const chartHasData = view === 'DIVIDENDOS'
    ? dividends.status === 'ready' && currentDividendYield > 0 && dividendSeries.length > 0
    : visibleSeries.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">Evolución y rendimiento</h2>
          <p className="text-sm text-slate-400 mt-1">Separá crecimiento de mercado, capital agregado e ingresos por dividendos.</p>
        </div>
        <div className="flex flex-wrap gap-2 self-start">
          <button
            type="button"
            onClick={() => setShowSimulator(current => !current)}
            disabled={dividends.status !== 'ready'}
            title={dividends.status !== 'ready' ? 'Esperando los dividendos obtenidos por API' : undefined}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-wait"
          >
            <Calculator size={16} /> {dividends.status !== 'ready' ? 'Calculando dividendos…' : showSimulator ? 'Ocultar simulador' : 'Simular dividendos'}
          </button>
        </div>
      </div>

      {showSimulator && (
        <DividendSimulator
          currentCapitalUSD={valuation.totalInversionesUSD}
          currentDividendYieldPct={currentDividendYield}
          currentDividendShieldPct={dividendShield}
          currentDividendGrowthPct={dividends.analytics.growthYoYPct}
          monthlyExpensesUSD={monthlyExpensesUSD}
        />
      )}

      {dividends.status === 'error' && (
        <div role="alert" className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          <span>{dividends.message}. Reintentá para actualizar las estimaciones automáticas.</span>
          <button type="button" onClick={dividends.retry} className="inline-flex items-center gap-2 text-amber-100 hover:text-white font-medium">
            <RefreshCw size={14} /> Reintentar
          </button>
        </div>
      )}

      {dividends.status === 'ready' && (dividends.unavailableTickers.length > 0 || dividends.staleTickers.length > 0) && (
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-xs text-blue-200">
          {dividends.unavailableTickers.length > 0 && `Sin historial público de dividendos: ${dividends.unavailableTickers.join(', ')}. `}
          {dividends.staleTickers.length > 0 && `Se usa el último caché disponible para: ${dividends.staleTickers.join(', ')}.`}
        </div>
      )}

      <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-5 sm:p-6 backdrop-blur-sm">
        <div className="flex flex-col gap-5 mb-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-semibold text-slate-200">
                {viewLabels[view]} (USD)
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                {view === 'DIVIDENDOS'
                    ? 'Estimación anual neta por mes: yield vigente aplicado al capital histórico. No son pagos reales.'
                    : 'Valores históricos y valuación actual expresados en USD.'}
              </p>
            </div>
            <div className="shrink-0 self-start">
              <div className="flex flex-nowrap bg-slate-900/50 p-1 rounded-lg border border-slate-700/50">
                {periodFilters.map(option => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setPeriod(option.id)}
                    className={`shrink-0 whitespace-nowrap px-3 py-1.5 rounded-md text-xs font-medium transition-all ${period === option.id ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {chartViews.map(option => (
              <button
                key={option.id}
                type="button"
                onClick={() => setView(option.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${view === option.id ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30' : 'text-slate-400 border-slate-700/50 hover:text-slate-200 hover:bg-slate-700/30'}`}
              >
                {option.id === 'INVERSIONES' && <Wallet size={13} className="inline mr-1.5 -mt-0.5" />}
                {option.id === 'EMERGENCIA' && <Shield size={13} className="inline mr-1.5 -mt-0.5" />}
                {option.id === 'VACACIONES' && <Plane size={13} className="inline mr-1.5 -mt-0.5" />}
                {option.id === 'DIVIDENDOS' && <Coins size={13} className="inline mr-1.5 -mt-0.5" />}
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="h-[400px] w-full">
          {!chartHasData ? (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-500">
              <LineChartIcon size={48} className="mb-4 opacity-50" />
              <p>{view === 'DIVIDENDOS'
                ? currentDividendYield > 0
                  ? 'No hay capital histórico para el período seleccionado.'
                  : 'No hay un yield positivo disponible para estimar dividendos.'
                : 'No hay datos para graficar.'}</p>
              <p className="text-sm mt-1">{view === 'DIVIDENDOS'
                ? 'La serie toma el yield neto vigente y lo aplica al capital de cada hito.'
                : 'Ampliá el período seleccionado o esperá una nueva actualización.'}</p>
            </div>
          ) : view === 'DIVIDENDOS' ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dividendSeries} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="fecha" stroke="#94a3b8" fontSize={12} tickMargin={10} />
                <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={value => `US$ ${Number(value).toFixed(0)}`} />
                <Tooltip
                  cursor={{ fill: '#334155', opacity: 0.2 }}
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '0.75rem' }}
                  itemStyle={{ color: selectedColor, fontWeight: 'bold' }}
                  formatter={(value, _name, item) => {
                    const quality = item.payload?.calidad;
                    const suffix = quality === 'ESTIMADO'
                      ? ' (estimado)'
                      : quality === 'MIXTO'
                        ? ' (parte estimada)'
                        : '';
                    return [formatUSD(Number(value || 0)), `Dividendos netos TTM${suffix}`];
                  }}
                />
                <Line type="monotone" dataKey="dividendos" name="Dividendos netos TTM" stroke={selectedColor} strokeWidth={3} dot={dividendSeries.length <= 24 ? { r: 4, fill: selectedColor } : false} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={visibleSeries} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={selectedColor} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={selectedColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="fecha" stroke="#94a3b8" fontSize={12} tickMargin={10} />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={12}
                  tickFormatter={value => `US$ ${Math.abs(Number(value)) >= 1000 ? `${(Number(value) / 1000).toFixed(0)}k` : Number(value).toFixed(0)}`}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '0.75rem' }}
                  itemStyle={{ color: selectedColor, fontWeight: 'bold' }}
                  labelStyle={{ color: '#94a3b8', marginBottom: '0.5rem' }}
                  formatter={value => [formatUSD(Number(value || 0)), viewLabels[view]]}
                />
                <Area
                  type="monotone"
                  dataKey={selectedDataKey}
                  stroke={selectedColor}
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorValue)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
