import React, { useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { Shield, Search, TrendingUp } from 'lucide-react';
import { fetchAssetPrice, AssetPrice } from '../../lib/api';

export default function InvestmentsTab() {
  const store = useStore();
  const { fondo_emergencia, presupuesto, inversiones } = store;

  // Fondo Emergencia
  const gastosMensualesFijos = presupuesto.categorias.reduce((acc, cat) => {
    return acc + cat.subgastos.reduce((subAcc, sub) => subAcc + (sub.costo_unitario * sub.frecuencia), 0);
  }, 0);
  const metaFondo = gastosMensualesFijos * fondo_emergencia.meta_meses;
  const progresoFondo = metaFondo > 0 ? Math.min((fondo_emergencia.saldo_actual / metaFondo) * 100, 100) : 0;

  // Inversiones
  const [ticker, setTicker] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<AssetPrice | null>(null);
  
  const [tipoOp, setTipoOp] = useState<'COMPRA' | 'VENTA'>('COMPRA');
  const [cantidad, setCantidad] = useState('');
  const [precioOp, setPrecioOp] = useState('');
  const [fechaOp, setFechaOp] = useState(new Date().toISOString().split('T')[0]);

  // Live prices
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    const updatePrices = async () => {
      const uniqueTickers = Array.from(new Set(inversiones.operaciones.map(op => op.ticker)));
      const newPrices: Record<string, number> = { ...livePrices };
      for (const t of uniqueTickers) {
        const data = await fetchAssetPrice(t);
        if (data) newPrices[t] = data.price;
      }
      setLivePrices(newPrices);
      setLastUpdate(new Date());
    };
    
    if (inversiones.operaciones.length > 0) {
      updatePrices();
    }
  }, [inversiones.operaciones.length]);

  const handleSearch = async () => {
    if (!ticker) return;
    setSearching(true);
    const data = await fetchAssetPrice(ticker.toUpperCase());
    setSearchResult(data);
    if (data) {
      setPrecioOp(data.price.toString());
    }
    setSearching(false);
  };

  const handleAddOperation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchResult || !cantidad || !precioOp) return;

    store.addOperacion({
      id: crypto.randomUUID(),
      tipo: tipoOp,
      ticker: searchResult.ticker,
      nombre: searchResult.name,
      icono_url: '', 
      cantidad: Number(cantidad),
      precio_operacion: Number(precioOp),
      fecha: fechaOp
    });

    setTicker('');
    setSearchResult(null);
    setCantidad('');
    setPrecioOp('');
  };

  // Group operations by ticker to show current portfolio
  const portfolio = inversiones.operaciones.reduce((acc, op) => {
    if (!acc[op.ticker]) {
      acc[op.ticker] = { ticker: op.ticker, name: op.nombre, cantidad: 0, costoTotal: 0 };
    }
    if (op.tipo === 'COMPRA') {
      acc[op.ticker].cantidad += op.cantidad;
      acc[op.ticker].costoTotal += op.cantidad * op.precio_operacion;
    } else {
      acc[op.ticker].cantidad -= op.cantidad;
      const avgCost = acc[op.ticker].cantidad > 0 ? acc[op.ticker].costoTotal / (acc[op.ticker].cantidad + op.cantidad) : 0;
      acc[op.ticker].costoTotal -= op.cantidad * avgCost;
    }
    return acc;
  }, {} as Record<string, { ticker: string; name: string; cantidad: number; costoTotal: number }>);

  const portfolioArray = Object.values(portfolio).filter(p => p.cantidad > 0);

  return (
    <div className="space-y-8">
      {/* Fondo de Emergencia */}
      <div className="bg-slate-800/50 rounded-2xl border border-yellow-500/30 p-6 backdrop-blur-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-500/5 blur-3xl rounded-full"></div>
        <div className="flex items-center gap-3 mb-6 relative z-10">
          <Shield className="text-yellow-400" size={24} />
          <h3 className="text-xl font-semibold text-slate-200">Fondo de Emergencia</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-400">Saldo Actual ($)</label>
            <input 
              type="number"
              value={fondo_emergencia.saldo_actual || ''}
              onChange={(e) => store.setFondoEmergencia(Number(e.target.value), fondo_emergencia.meta_meses)}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-yellow-500"
              placeholder="0.00"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-400">Meta en Meses de Gasto (calculada del Presupuesto)</label>
            <input 
              type="number"
              value={fondo_emergencia.meta_meses || ''}
              onChange={(e) => store.setFondoEmergencia(fondo_emergencia.saldo_actual, Number(e.target.value))}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-yellow-500"
              placeholder="6"
              min="1"
            />
          </div>
          <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-4 flex flex-col justify-center">
            <div className="flex justify-between items-end mb-2">
              <span className="text-sm font-medium text-slate-400">Meta: ${metaFondo.toLocaleString()}</span>
              <span className="text-yellow-400 font-bold">{progresoFondo.toFixed(1)}%</span>
            </div>
            <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-yellow-500 rounded-full transition-all duration-500" style={{ width: `${progresoFondo}%` }}></div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        {/* Nueva Operación */}
        <div className="xl:col-span-4 bg-slate-800/50 rounded-2xl border border-slate-700/50 p-6 backdrop-blur-sm">
          <h3 className="text-lg font-semibold text-slate-200 mb-6 flex items-center gap-2">
            <TrendingUp size={20} className="text-blue-400" />
            Nueva Operación
          </h3>

          <div className="flex gap-2 mb-6">
            <input 
              type="text"
              value={ticker}
              onChange={e => setTicker(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Ticker (ej. AAPL, SPY, BTC-USD)"
              className="flex-1 bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 uppercase"
            />
            <button 
              onClick={handleSearch}
              disabled={searching}
              className="bg-slate-700 hover:bg-slate-600 text-white px-4 rounded-xl transition-colors flex items-center justify-center"
            >
              {searching ? '...' : <Search size={18} />}
            </button>
          </div>

          {searchResult && (
            <form onSubmit={handleAddOperation} className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="p-4 bg-slate-900/50 border border-blue-500/30 rounded-xl mb-4">
                <p className="text-sm text-slate-400">Activo Encontrado:</p>
                <p className="font-semibold text-white">{searchResult.name} ({searchResult.ticker})</p>
                <p className="text-blue-400 font-medium">Precio Actual: ${searchResult.price} {searchResult.currency}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setTipoOp('COMPRA')}
                  className={`py-2 rounded-lg font-medium transition-colors ${tipoOp === 'COMPRA' ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}
                >
                  COMPRA
                </button>
                <button
                  type="button"
                  onClick={() => setTipoOp('VENTA')}
                  className={`py-2 rounded-lg font-medium transition-colors ${tipoOp === 'VENTA' ? 'bg-red-500 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}
                >
                  VENTA
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-400">Cantidad (Nominales)</label>
                <input 
                  type="number"
                  step="any"
                  required
                  value={cantidad}
                  onChange={e => setCantidad(e.target.value)}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-400">Precio Operado (USD)</label>
                <input 
                  type="number"
                  step="any"
                  required
                  value={precioOp}
                  onChange={e => setPrecioOp(e.target.value)}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-400">Fecha</label>
                <input 
                  type="date"
                  required
                  value={fechaOp}
                  onChange={e => setFechaOp(e.target.value)}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <button 
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium px-4 py-3 rounded-xl transition-all shadow-lg shadow-blue-500/20 mt-4"
              >
                Registrar {tipoOp}
              </button>
            </form>
          )}
        </div>

        {/* Portafolio Actual */}
        <div className="xl:col-span-8 bg-slate-800/50 rounded-2xl border border-slate-700/50 overflow-hidden backdrop-blur-sm">
          <div className="p-6 border-b border-slate-700/50 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-slate-200">Portafolio Activo</h3>
            {lastUpdate && (
              <span className="text-xs text-slate-400">Precios actualizados: {lastUpdate.toLocaleTimeString()}</span>
            )}
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900/30 text-slate-400 text-sm">
                  <th className="px-6 py-3 font-medium">Activo</th>
                  <th className="px-6 py-3 font-medium text-right">Cantidad</th>
                  <th className="px-6 py-3 font-medium text-right">Precio Prom.</th>
                  <th className="px-6 py-3 font-medium text-right">Precio Actual</th>
                  <th className="px-6 py-3 font-medium text-right">P&L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {portfolioArray.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                      Tu portafolio está vacío. Realiza una compra para empezar.
                    </td>
                  </tr>
                ) : (
                  portfolioArray.map(item => {
                    const avgPrice = item.costoTotal / item.cantidad;
                    const currentPrice = livePrices[item.ticker] || avgPrice; 
                    const currentValue = item.cantidad * currentPrice;
                    const pnl = currentValue - item.costoTotal;
                    const pnlPct = item.costoTotal > 0 ? (pnl / item.costoTotal) * 100 : 0;
                    const isPositive = pnl >= 0;

                    return (
                      <tr key={item.ticker} className="hover:bg-slate-700/20 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-200">{item.ticker}</div>
                          <div className="text-xs text-slate-400 truncate max-w-[150px]">{item.name}</div>
                        </td>
                        <td className="px-6 py-4 text-right text-slate-300 font-medium">
                          {item.cantidad.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                        </td>
                        <td className="px-6 py-4 text-right text-slate-400">
                          ${avgPrice.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-slate-200">
                          ${currentPrice.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className={`font-bold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                            {isPositive ? '+' : ''}${pnl.toFixed(2)}
                          </div>
                          <div className={`text-xs font-semibold ${isPositive ? 'text-emerald-500' : 'text-red-500'}`}>
                            {isPositive ? '+' : ''}{pnlPct.toFixed(2)}%
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
