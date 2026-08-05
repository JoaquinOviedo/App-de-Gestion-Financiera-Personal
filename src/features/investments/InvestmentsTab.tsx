import React, { useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { Shield, Search, Trash2, Edit2, Check, X } from 'lucide-react';
import { fetchAssetPrice, fetchCedearPriceARS, AssetPrice } from '../../lib/api';
import { getCedearRatio } from '../../lib/cedears';
import { useDolarMEP } from '../../lib/useDolarMEP';

export default function InvestmentsTab() {
  const store = useStore();
  const { fondo_emergencia, presupuesto, inversiones } = store;
  const { cotizacion: cotizacionMEP } = useDolarMEP();

  const monedaFondo = fondo_emergencia.moneda || 'ARS';

  // Fondo Emergencia
  const gastosMensualesFijos = presupuesto.categorias.reduce((acc, cat) => {
    return acc + cat.subgastos.reduce((subAcc, sub) => subAcc + (sub.costo_unitario * sub.frecuencia), 0);
  }, 0);

  // Convert expenses to match fondo_emergencia currency for progress calculation
  const gastosMensualesMonedaFondo = (presupuesto.moneda || 'ARS') === monedaFondo
    ? gastosMensualesFijos
    : (monedaFondo === 'USD' && cotizacionMEP > 0
        ? gastosMensualesFijos / cotizacionMEP
        : gastosMensualesFijos * cotizacionMEP);

  const metaFondo = gastosMensualesMonedaFondo * fondo_emergencia.meta_meses;
  const progresoFondo = metaFondo > 0 ? Math.min((fondo_emergencia.saldo_actual / metaFondo) * 100, 100) : 0;

  // Inversiones
  const [ticker, setTicker] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<AssetPrice | null>(null);
  
  const [tipoOp, setTipoOp] = useState<'COMPRA' | 'VENTA'>('COMPRA');
  const [cantidad, setCantidad] = useState('');
  const [precioOp, setPrecioOp] = useState('');
  const [fechaOp, setFechaOp] = useState(new Date().toISOString().split('T')[0]);

  // Inline editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCantidad, setEditCantidad] = useState<number>(0);
  const [editPrecio, setEditPrecio] = useState<number>(0);

  // Live prices (USD per unit/CEDEAR)
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    const updatePrices = async () => {
      const uniqueTickers = Array.from(new Set(inversiones.operaciones.map(op => op.ticker)));
      const newPrices: Record<string, number> = { ...livePrices };
      for (const t of uniqueTickers) {
        const ratio = getCedearRatio(t, store.cedear_ratios);
        
        // Strategy 1: Try to fetch the .BA (Buenos Aires/BYMA) CEDEAR price in ARS
        // and convert to USD using MEP. This gives the most accurate price matching broker.
        if (cotizacionMEP > 0) {
          const arsPrice = await fetchCedearPriceARS(t);
          if (arsPrice && arsPrice > 0) {
            // Convert ARS per CEDEAR → USD per CEDEAR
            newPrices[t] = arsPrice / cotizacionMEP;
            continue;
          }
        }
        
        // Strategy 2: Fallback to US underlying ticker price / ratio
        const data = await fetchAssetPrice(t);
        if (data) newPrices[t] = data.price / ratio;
      }
      setLivePrices(newPrices);
      setLastUpdate(new Date());
    };
    
    if (inversiones.operaciones.length > 0) {
      updatePrices();
    }
  }, [inversiones.operaciones.length, cotizacionMEP]);

  const handleSearch = async () => {
    if (!ticker) return;
    setSearching(true);
    const data = await fetchAssetPrice(ticker.toUpperCase());
    setSearchResult(data);
    if (data) {
      const ratio = getCedearRatio(data.ticker, store.cedear_ratios);
      setPrecioOp((data.price / ratio).toFixed(2));
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

  const handleStartEdit = (opId: string, currentCantidad: number, currentPrecio: number) => {
    setEditingId(opId);
    setEditCantidad(currentCantidad);
    setEditPrecio(currentPrecio);
  };

  const handleSaveEdit = (opId: string) => {
    store.updateOperacion(opId, {
      cantidad: editCantidad,
      precio_operacion: editPrecio
    });
    setEditingId(null);
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

  // Compute total portfolio values
  const totalPortfolioValueUSD = portfolioArray.reduce((acc, item) => {
    const avgPrice = item.costoTotal / item.cantidad;
    const currentPrice = livePrices[item.ticker] ?? avgPrice;
    return acc + (item.cantidad * currentPrice);
  }, 0);

  const totalPortfolioCostoUSD = portfolioArray.reduce((acc, item) => acc + item.costoTotal, 0);
  const totalPnLUSD = totalPortfolioValueUSD - totalPortfolioCostoUSD;

  return (
    <div className="space-y-8">
      {/* Fondo de Emergencia */}
      <div className="bg-slate-800/50 rounded-2xl border border-yellow-500/30 p-6 backdrop-blur-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-500/5 blur-3xl rounded-full"></div>
        <div className="flex items-center justify-between mb-6 relative z-10">
          <div className="flex items-center gap-3">
            <Shield className="text-yellow-400" size={24} />
            <h3 className="text-xl font-semibold text-slate-200">Fondo de Emergencia</h3>
          </div>
          {/* Currency Switcher */}
          <div className="flex items-center gap-2 bg-slate-900/60 p-1 rounded-xl border border-slate-700/50">
            <button
              onClick={() => store.setFondoEmergencia(fondo_emergencia.saldo_actual, fondo_emergencia.meta_meses, 'ARS')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${monedaFondo === 'ARS' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : 'text-slate-400 hover:text-slate-200'}`}
            >
              ARS ($)
            </button>
            <button
              onClick={() => store.setFondoEmergencia(fondo_emergencia.saldo_actual, fondo_emergencia.meta_meses, 'USD')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${monedaFondo === 'USD' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : 'text-slate-400 hover:text-slate-200'}`}
            >
              USD (US$)
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-400">Saldo Actual ({monedaFondo === 'USD' ? 'US$' : '$'})</label>
            <input 
              type="number"
              value={fondo_emergencia.saldo_actual || ''}
              onChange={(e) => store.setFondoEmergencia(Number(e.target.value), fondo_emergencia.meta_meses, monedaFondo)}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-yellow-500"
              placeholder="0.00"
            />
            {cotizacionMEP > 0 && (
              <p className="text-xs text-slate-400">
                {monedaFondo === 'ARS'
                  ? `≈ US$ ${(fondo_emergencia.saldo_actual / cotizacionMEP).toFixed(2)} USD (MEP: $${cotizacionMEP.toFixed(2)})`
                  : `≈ $ ${(fondo_emergencia.saldo_actual * cotizacionMEP).toLocaleString('es-AR', { maximumFractionDigits: 0 })} ARS (MEP: $${cotizacionMEP.toFixed(2)})`
                }
              </p>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-400">Meta en Meses de Gasto</label>
            <input 
              type="number"
              value={fondo_emergencia.meta_meses || ''}
              onChange={(e) => store.setFondoEmergencia(fondo_emergencia.saldo_actual, Number(e.target.value), monedaFondo)}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-yellow-500"
              placeholder="6"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-400">Meta Calculada ({monedaFondo === 'USD' ? 'US$' : '$'})</label>
            <div className="text-xl font-bold text-slate-200 py-2">
              {monedaFondo === 'USD' ? 'US$ ' : '$ '}{metaFondo.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        <div className="mt-6 relative z-10">
          <div className="flex justify-between text-sm text-slate-400 mb-2">
            <span>Progreso del Fondo</span>
            <span>{progresoFondo.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-slate-900/80 rounded-full h-3 overflow-hidden border border-slate-700/50">
            <div 
              className="bg-gradient-to-r from-yellow-500 to-amber-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${progresoFondo}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Operaciones e Inversiones */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        {/* Registrar Operación */}
        <div className="xl:col-span-4 bg-slate-800/50 rounded-2xl border border-slate-700/50 p-6 backdrop-blur-sm">
          <h3 className="text-lg font-semibold text-slate-200 mb-4">Registrar Operación</h3>
          
          <div className="space-y-4 mb-6">
            <label className="text-sm font-medium text-slate-400">Buscar Activo (Ticker)</label>
            <div className="flex gap-2">
              <input 
                type="text"
                placeholder="Ej: SPY, AAPL, QQQ"
                value={ticker}
                onChange={e => setTicker(e.target.value.toUpperCase())}
                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
              />
              <button 
                onClick={handleSearch}
                disabled={searching}
                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl transition-all font-medium flex items-center justify-center"
              >
                {searching ? '...' : <Search size={18} />}
              </button>
            </div>
          </div>

          {searchResult && (
            <form onSubmit={handleAddOperation} className="space-y-4 border-t border-slate-700/50 pt-4">
              <div className="p-3 bg-slate-900/50 rounded-xl border border-slate-700/50">
                <div className="font-bold text-white">{searchResult.ticker}</div>
                <div className="text-xs text-slate-400">{searchResult.name}</div>
                <div className="text-sm font-semibold text-emerald-400 mt-1">
                  Subyacente: ${searchResult.price} USD (Ratio {getCedearRatio(searchResult.ticker)}:1)
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button 
                  type="button"
                  onClick={() => setTipoOp('COMPRA')}
                  className={`py-2 text-sm font-semibold rounded-lg transition-all ${tipoOp === 'COMPRA' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-900/50 text-slate-400'}`}
                >
                  Compra
                </button>
                <button 
                  type="button"
                  onClick={() => setTipoOp('VENTA')}
                  className={`py-2 text-sm font-semibold rounded-lg transition-all ${tipoOp === 'VENTA' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-slate-900/50 text-slate-400'}`}
                >
                  Venta
                </button>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-400 mb-1 block">Cantidad</label>
                <input 
                  type="number"
                  step="any"
                  required
                  placeholder="Ej: 10"
                  value={cantidad}
                  onChange={e => setCantidad(e.target.value)}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-400 mb-1 block">Precio por Unidad/CEDEAR (USD)</label>
                <input 
                  type="number"
                  step="any"
                  required
                  value={precioOp}
                  onChange={e => setPrecioOp(e.target.value)}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-400 mb-1 block">Fecha</label>
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
            <div>
              <h3 className="text-lg font-semibold text-slate-200">Portafolio Activo</h3>
              <p className="text-xs text-slate-400 mt-0.5">Saldo consolidado por activo (Ajustado por Ratio CEDEAR)</p>
            </div>
            <div className="flex items-center gap-3">
              {cotizacionMEP > 0 && (
                <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-lg flex items-center gap-1 font-mono">
                  MEP: ${cotizacionMEP.toFixed(2)}
                </span>
              )}
              {lastUpdate && (
                <span className="text-xs text-slate-400">Precios: {lastUpdate.toLocaleTimeString()}</span>
              )}
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900/30 text-slate-400 text-sm">
                  <th className="px-6 py-3 font-medium">Activo</th>
                  <th className="px-6 py-3 font-medium text-center">Ratio</th>
                  <th className="px-6 py-3 font-medium text-right">Cantidad</th>
                  <th className="px-6 py-3 font-medium text-right">Precio Prom.</th>
                  <th className="px-6 py-3 font-medium text-right">Precio Actual</th>
                  <th className="px-6 py-3 font-medium text-right">Valor Total (USD)</th>
                  <th className="px-6 py-3 font-medium text-right">P&L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {portfolioArray.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                      Tu portafolio está vacío. Realiza una compra o importa tu cartera para empezar.
                    </td>
                  </tr>
                ) : (
                  portfolioArray.map(item => {
                    const ratio = getCedearRatio(item.ticker, store.cedear_ratios);
                    const avgPrice = item.costoTotal / item.cantidad;
                    const currentPrice = livePrices[item.ticker] ?? avgPrice; 
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
                        <td className="px-6 py-4 text-center">
                          <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded text-xs border border-blue-500/20 font-mono">
                            {ratio}:1
                          </span>
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
                        <td className="px-6 py-4 text-right font-bold text-indigo-300">
                          ${currentValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          {cotizacionMEP > 0 && (
                            <div className="text-[10px] text-slate-400 font-normal">
                              ≈ ${(currentValue * cotizacionMEP).toLocaleString('es-AR', { maximumFractionDigits: 0 })} ARS
                            </div>
                          )}
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
              {portfolioArray.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-900/60 border-t border-slate-700 font-semibold text-slate-200">
                    <td colSpan={5} className="px-6 py-3 text-right text-sm">TOTAL PORTAFOLIO:</td>
                    <td className="px-6 py-3 text-right text-indigo-300 text-base font-bold">
                      ${totalPortfolioValueUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      {cotizacionMEP > 0 && (
                        <div className="text-[10px] text-slate-400 font-normal">
                          ≈ ${(totalPortfolioValueUSD * cotizacionMEP).toLocaleString('es-AR', { maximumFractionDigits: 0 })} ARS
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className={`text-sm font-bold ${totalPnLUSD >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {totalPnLUSD >= 0 ? '+' : ''}${totalPnLUSD.toFixed(2)}
                      </div>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Operations List with Delete / Edit */}
          <div className="p-6 border-t border-slate-700/50 bg-slate-900/40">
            <h4 className="text-md font-semibold text-slate-300 mb-4">Detalle de Operaciones (Edición / Eliminación)</h4>
            {inversiones.operaciones.length === 0 ? (
              <p className="text-sm text-slate-500">No hay operaciones registradas.</p>
            ) : (
              <div className="overflow-x-auto max-h-60">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-700/50">
                      <th className="py-2 px-3">Fecha</th>
                      <th className="py-2 px-3">Tipo</th>
                      <th className="py-2 px-3">Ticker</th>
                      <th className="py-2 px-3 text-right">Cantidad</th>
                      <th className="py-2 px-3 text-right">Precio USD</th>
                      <th className="py-2 px-3 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {inversiones.operaciones.map((op) => {
                      const isEditing = editingId === op.id;
                      return (
                        <tr key={op.id} className="hover:bg-slate-800/50">
                          <td className="py-2 px-3 text-slate-300">{op.fecha}</td>
                          <td className="py-2 px-3">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${op.tipo === 'COMPRA' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                              {op.tipo}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-bold text-white">{op.ticker}</td>
                          
                          <td className="py-2 px-3 text-right">
                            {isEditing ? (
                              <input
                                type="number"
                                step="any"
                                className="w-20 bg-slate-900 border border-slate-600 rounded px-1 text-right text-white"
                                value={editCantidad}
                                onChange={(e) => setEditCantidad(parseFloat(e.target.value) || 0)}
                              />
                            ) : (
                              op.cantidad
                            )}
                          </td>

                          <td className="py-2 px-3 text-right text-emerald-400">
                            {isEditing ? (
                              <input
                                type="number"
                                step="any"
                                className="w-20 bg-slate-900 border border-slate-600 rounded px-1 text-right text-emerald-400"
                                value={editPrecio}
                                onChange={(e) => setEditPrecio(parseFloat(e.target.value) || 0)}
                              />
                            ) : (
                              `$${op.precio_operacion.toFixed(2)}`
                            )}
                          </td>

                          <td className="py-2 px-3 text-center">
                            {isEditing ? (
                              <div className="flex justify-center gap-1">
                                <button
                                  onClick={() => handleSaveEdit(op.id)}
                                  className="p-1 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 rounded"
                                  title="Guardar"
                                >
                                  <Check size={14} />
                                </button>
                                <button
                                  onClick={() => setEditingId(null)}
                                  className="p-1 bg-slate-700 text-slate-300 hover:bg-slate-600 rounded"
                                  title="Cancelar"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ) : (
                              <div className="flex justify-center gap-1">
                                <button
                                  onClick={() => handleStartEdit(op.id, op.cantidad, op.precio_operacion)}
                                  className="p-1 text-blue-400 hover:bg-blue-500/10 rounded"
                                  title="Editar"
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button
                                  onClick={() => store.removeOperacion(op.id)}
                                  className="p-1 text-red-400 hover:bg-red-500/10 rounded"
                                  title="Eliminar"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
