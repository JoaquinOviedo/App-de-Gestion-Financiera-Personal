import { useState } from 'react';
import { useStore } from '../../store/useStore';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Wallet, Shield, LineChart } from 'lucide-react';
import { useDolarCCL } from '../../lib/useDolarCCL';

export default function PortfolioTab() {
  const historial_patrimonio = useStore(state => state.historial_patrimonio);
  const inversiones = useStore(state => state.inversiones);
  const fondo_emergencia = useStore(state => state.fondo_emergencia);
  const { cotizacion: cotizacionCCL } = useDolarCCL();

  const [filter, setFilter] = useState<'TOTAL' | 'INVERSIONES' | 'EMERGENCIA'>('TOTAL');

  // Investments operations values are stored in USD
  const currentInversionesValueUSD = inversiones.operaciones.reduce((acc, op) => acc + (op.cantidad * op.precio_operacion), 0);
  
  // Emergency fund: convert ARS → USD using CCL rate. If moneda is undefined, it defaults to ARS.
  const fondoIsUSD = fondo_emergencia.moneda === 'USD';
  const currentEmergenciaValueUSD = fondoIsUSD
    ? fondo_emergencia.saldo_actual
    : (cotizacionCCL > 0 ? fondo_emergencia.saldo_actual / cotizacionCCL : 0);
  
  const currentRecord = {
    fecha: new Date().toISOString().split('T')[0],
    valor_inversiones: currentInversionesValueUSD,
    valor_emergencia: currentEmergenciaValueUSD,
    total: currentInversionesValueUSD + currentEmergenciaValueUSD,
    id: 'current',
    origen: 'AUTO_SNAPSHOT' as const
  };

  const chartData = [...historial_patrimonio]
    .map(r => {
      // Historical investment values: use balance_usd if available (from amCharts import), otherwise use stored value (already in USD)
      const valorInversionesUSD = r.balance_usd ?? r.valor_inversiones;
      // Historical emergency values: convert ARS → USD. If no rate available, show 0 to avoid inflating chart.
      const valorEmergenciaUSD = fondoIsUSD
        ? r.valor_emergencia
        : (cotizacionCCL > 0 ? r.valor_emergencia / cotizacionCCL : 0);
      return {
        ...r,
        valor_inversiones: valorInversionesUSD,
        valor_emergencia: valorEmergenciaUSD,
        total: valorInversionesUSD + valorEmergenciaUSD
      };
    })
    .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
    .concat(currentRecord);

  const getMetricCards = () => {
    if (chartData.length < 2) return null;
    
    const current = chartData[chartData.length - 1].total;
    
    const calculateGrowth = (monthsAgo: number) => {
      const pastDate = new Date();
      pastDate.setMonth(pastDate.getMonth() - monthsAgo);
      
      let closestRecord = chartData[0];
      let minDiff = Infinity;
      
      chartData.slice(0, -1).forEach(record => {
        const diff = Math.abs(new Date(record.fecha).getTime() - pastDate.getTime());
        if (diff < minDiff) {
          minDiff = diff;
          closestRecord = record;
        }
      });
      
      const growth = current - closestRecord.total;
      const pct = closestRecord.total > 0 ? (growth / closestRecord.total) * 100 : 0;
      
      return {
        amount: growth,
        percentage: pct,
        isPositive: growth >= 0
      };
    };

    const metrics = [
      { label: 'Último Mes', data: calculateGrowth(1) },
      { label: '6 Meses', data: calculateGrowth(6) },
      { label: '1 Año', data: calculateGrowth(12) }
    ];

    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {metrics.map((m, i) => (
          <div key={i} className="bg-slate-800/50 border border-slate-700/50 p-6 rounded-2xl backdrop-blur-sm relative overflow-hidden">
            <div className={`absolute top-0 right-0 w-24 h-24 blur-2xl rounded-full opacity-20 ${m.data.isPositive ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
            <p className="text-slate-400 font-medium mb-1">{m.label}</p>
            <div className="flex items-end gap-3">
              <h4 className={`text-2xl font-bold ${m.data.isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                {m.data.isPositive ? '+' : ''}US$ {Math.abs(m.data.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h4>
              <span className={`flex items-center text-sm font-semibold mb-1 ${m.data.isPositive ? 'text-emerald-500' : 'text-red-500'}`}>
                {m.data.isPositive ? <TrendingUp size={16} className="mr-1" /> : <TrendingDown size={16} className="mr-1" />}
                {m.data.percentage.toFixed(2)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const getChartColor = () => {
    switch (filter) {
      case 'INVERSIONES': return '#3b82f6';
      case 'EMERGENCIA': return '#eab308';
      default: return '#10b981';
    }
  };

  const getDataKey = () => {
    switch (filter) {
      case 'INVERSIONES': return 'valor_inversiones';
      case 'EMERGENCIA': return 'valor_emergencia';
      default: return 'total';
    }
  };

  return (
    <div className="space-y-6">
      
      {getMetricCards()}

      <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-6 backdrop-blur-sm">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
          <div>
            <h3 className="text-xl font-semibold text-slate-200">Evolución del Patrimonio (en USD)</h3>
            <p className="text-xs text-slate-400 mt-1">Todos los valores se expresan en Dólares Estadounidenses (USD)</p>
          </div>
          
          <div className="flex bg-slate-900/50 p-1 rounded-xl border border-slate-700/50">
            <button 
              onClick={() => setFilter('TOTAL')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${filter === 'TOTAL' ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Total
            </button>
            <button 
              onClick={() => setFilter('INVERSIONES')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${filter === 'INVERSIONES' ? 'bg-blue-500/20 text-blue-400' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <Wallet size={14} /> Inversiones
            </button>
            <button 
              onClick={() => setFilter('EMERGENCIA')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${filter === 'EMERGENCIA' ? 'bg-yellow-500/20 text-yellow-400' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <Shield size={14} /> Emergencia
            </button>
          </div>
        </div>

        <div className="h-[400px] w-full">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={getChartColor()} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={getChartColor()} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis 
                  dataKey="fecha" 
                  stroke="#94a3b8" 
                  fontSize={12}
                  tickMargin={10}
                  tickFormatter={(val) => val.includes('Hoy') ? 'Hoy' : val}
                />
                <YAxis 
                  stroke="#94a3b8" 
                  fontSize={12}
                  tickFormatter={(val) => `US$ ${val >= 1000 ? (val/1000).toFixed(0) + 'k' : val}`}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '0.75rem', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }}
                  itemStyle={{ color: getChartColor(), fontWeight: 'bold' }}
                  labelStyle={{ color: '#94a3b8', marginBottom: '0.5rem' }}
                  formatter={(value: any) => [`US$ ${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, filter === 'TOTAL' ? 'Patrimonio Total (USD)' : (filter === 'INVERSIONES' ? 'Inversiones (USD)' : 'Fondo de Emergencia (USD)')]}
                />
                <Area 
                  type="monotone" 
                  dataKey={getDataKey()} 
                  stroke={getChartColor()} 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorValue)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-500">
              <LineChart size={48} className="mb-4 opacity-50" />
              <p>No hay suficientes datos para graficar.</p>
              <p className="text-sm">Agrega hitos históricos o empieza a invertir.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
