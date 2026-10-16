import { useState } from 'react';
import { useStore } from '../../store/useStore';
import { ClipboardPaste, Plane, Shield, ShieldCheck } from 'lucide-react';
import { getCedearRatio } from '../../lib/cedears';
import { usePortfolioValuation } from '../../lib/portfolioValuation';
import ValuationStatus from '../../components/ValuationStatus';
import CurrentPortfolioImporter from '../../components/CurrentPortfolioImporter';
import EmergencyFundSimulator from './EmergencyFundSimulator';
import { emergencyCoverageValueUSD, normalizeEmergencyFund } from '../../lib/emergencyFund';
import { normalizeVacationFund } from '../../lib/vacationFund';

export default function InvestmentsTab() {
  const store = useStore();
  const { fondo_emergencia, presupuesto } = store;
  const [showPortfolioImporter, setShowPortfolioImporter] = useState(false);
  const [showEmergencySimulator, setShowEmergencySimulator] = useState(false);
  const valuation = usePortfolioValuation();
  const cotizacionMEP = valuation.status === 'ready' ? valuation.cotizacionMEP : 0;

  const saldosFondo = normalizeEmergencyFund(fondo_emergencia);
  const saldosVacaciones = normalizeVacationFund(store.fondo_vacaciones);

  // Fondo Emergencia
  const gastosMensualesFijos = presupuesto.categorias.reduce((acc, cat) => {
    return acc + cat.subgastos.reduce((subAcc, sub) => subAcc + (sub.costo_unitario * sub.frecuencia), 0);
  }, 0);

  const gastosMensualesUSD = presupuesto.moneda === 'USD'
    ? gastosMensualesFijos
    : cotizacionMEP > 0
      ? gastosMensualesFijos / cotizacionMEP
      : 0;
  const metaFondoUSD = gastosMensualesUSD * saldosFondo.meta_meses;
  const valorFondoUSD = valuation.status === 'ready' ? valuation.valorEmergenciaUSD : 0;
  const valorCoberturaUSD = valuation.status === 'ready'
    ? emergencyCoverageValueUSD(saldosFondo, cotizacionMEP)
    : 0;
  const progresoFondo = metaFondoUSD > 0 ? Math.min((valorCoberturaUSD / metaFondoUSD) * 100, 100) : 0;
  const valorVacacionesUSD = valuation.status === 'ready' ? valuation.valorVacacionesUSD : 0;
  const faltanteVacacionesUSD = Math.max(0, saldosVacaciones.objetivo_usd - valorVacacionesUSD);
  const updateFondo = (ars: number, usd: number, meses = saldosFondo.meta_meses) =>
    store.setFondoEmergencia({ ARS: ars, USD: usd }, meses);

  const portfolioArray = valuation.status === 'ready' ? valuation.positions : [];
  const livePrices = valuation.status === 'ready' ? valuation.prices : {};
  const lastUpdate = valuation.status === 'ready' ? valuation.lastUpdate : null;
  const totalPortfolioValueUSD = valuation.status === 'ready' ? valuation.totalInversionesUSD : 0;
  const totalPortfolioCostoUSD = portfolioArray.reduce((acc, item) => acc + item.costoTotal, 0);
  const totalPnLUSD = totalPortfolioValueUSD - totalPortfolioCostoUSD;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-stretch">
      {/* Fondo de Emergencia */}
      <div className="xl:col-span-2 flex min-w-0 flex-col bg-slate-800/50 rounded-2xl border border-yellow-500/30 p-4 sm:p-5 backdrop-blur-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-yellow-500/5 blur-3xl rounded-full"></div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 relative z-10">
          <div className="flex items-center gap-2.5">
            <Shield className="text-yellow-400" size={20} />
            <h3 className="text-base font-semibold text-slate-200">Fondo de Emergencia</h3>
          </div>
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setShowEmergencySimulator(current => !current)}
              disabled={valuation.status !== 'ready'}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-yellow-500/10 text-yellow-300 border border-yellow-500/20 hover:bg-yellow-500/20 transition-colors disabled:opacity-40"
            >
              <ShieldCheck size={14} /> {showEmergencySimulator ? 'Ocultar cobertura' : 'Evaluar cobertura'}
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 relative z-10 items-start">
          <div className="space-y-1">
            <label htmlFor="emergency-ars" className="text-xs font-medium text-slate-400">Saldo en pesos (ARS)</label>
            <input 
              id="emergency-ars"
              type="number"
              min="0"
              step="any"
              value={saldosFondo.saldo_ars || ''}
              onChange={(e) => updateFondo(Number(e.target.value), saldosFondo.saldo_usd)}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500"
              placeholder="0.00"
            />
          </div>
          <div className="space-y-1">
            <div className="flex min-h-5 items-center justify-between gap-2">
              <label htmlFor="emergency-usd" className="text-xs font-medium text-slate-400">Saldo en dólares (USD)</label>
              <label className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 text-[11px] font-medium text-slate-400 hover:text-slate-200">
                <input
                  type="checkbox"
                  checked={saldosFondo.incluir_usd_en_cobertura}
                  onChange={event => store.setIncluirUsdEnCobertura(event.target.checked)}
                  className="peer sr-only"
                  aria-label="Contar USD en cobertura"
                />
                <span className={`inline-flex h-4 w-7 shrink-0 items-center rounded-full p-0.5 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-yellow-400 ${saldosFondo.incluir_usd_en_cobertura ? 'bg-yellow-500' : 'bg-slate-600'}`} aria-hidden="true">
                  <span className={`h-3 w-3 rounded-full bg-white shadow-sm transition-transform ${saldosFondo.incluir_usd_en_cobertura ? 'translate-x-3' : ''}`} />
                </span>
                Cobertura
              </label>
            </div>
            <input
              id="emergency-usd"
              type="number"
              min="0"
              step="any"
              value={saldosFondo.saldo_usd || ''}
              onChange={(e) => updateFondo(saldosFondo.saldo_ars, Number(e.target.value))}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500"
              placeholder="0.00"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="emergency-months" className="text-xs font-medium text-slate-400">Meta en meses de gasto</label>
            <input 
              id="emergency-months"
              type="number"
              min="1"
              step="1"
              value={saldosFondo.meta_meses || ''}
              onChange={(e) => updateFondo(saldosFondo.saldo_ars, saldosFondo.saldo_usd, Number(e.target.value))}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500"
              placeholder="6"
            />
          </div>
        </div>
        <div className="relative z-10 mt-auto border-t border-slate-700/50 pt-4">
          {valuation.status === 'ready' ? (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="min-w-0">
                  <p className="text-[11px] text-slate-400">Fondo total</p>
                  <p className="text-sm font-semibold tabular-nums text-slate-200">US$ {valorFondoUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-slate-400">Para cobertura</p>
                  <p className="text-sm font-semibold tabular-nums text-yellow-300">US$ {valorCoberturaUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-slate-400">Meta</p>
                  <p className="text-sm font-semibold tabular-nums text-slate-200">US$ {metaFondoUSD.toLocaleString('en-US', { maximumFractionDigits: 2 })}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-slate-400">
                <span>Cobertura <strong className="font-semibold text-yellow-300">{progresoFondo.toFixed(1)}%</strong></span>
                <span>MEP ${cotizacionMEP.toFixed(2)}</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full border border-slate-700/50 bg-slate-900/80" role="progressbar" aria-label="Cobertura del fondo de emergencia" aria-valuenow={progresoFondo} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full rounded-full bg-gradient-to-r from-yellow-500 to-amber-400 transition-all duration-500" style={{ width: `${progresoFondo}%` }} />
              </div>
            </>
          ) : (
            <p className="text-xs text-slate-400">El total en USD se mostrará cuando esté disponible la cotización MEP.</p>
          )}
        </div>
      </div>

      <div className="flex min-w-0 flex-col bg-slate-800/50 rounded-2xl border border-violet-500/30 p-4 sm:p-5 backdrop-blur-sm">
        <div className="flex items-center gap-2.5 mb-4">
          <Plane className="text-violet-400" size={20} />
          <h3 className="text-base font-semibold text-slate-200">Fondo de Vacaciones</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label htmlFor="vacation-ars" className="text-xs font-medium text-slate-400">Saldo en pesos (ARS)</label>
            <input
              id="vacation-ars"
              type="number"
              min="0"
              step="any"
              value={saldosVacaciones.saldo_ars || ''}
              onChange={event => store.setFondoVacaciones({ ARS: Number(event.target.value), USD: saldosVacaciones.saldo_usd })}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
              placeholder="0.00"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="vacation-usd" className="text-xs font-medium text-slate-400">Saldo en dólares (USD)</label>
            <input
              id="vacation-usd"
              type="number"
              min="0"
              step="any"
              value={saldosVacaciones.saldo_usd || ''}
              onChange={event => store.setFondoVacaciones({ ARS: saldosVacaciones.saldo_ars, USD: Number(event.target.value) })}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
              placeholder="0.00"
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label htmlFor="vacation-goal-usd" className="text-xs font-medium text-slate-400">Objetivo en dólares (USD)</label>
            <input
              id="vacation-goal-usd"
              type="number"
              min="0"
              step="any"
              value={saldosVacaciones.objetivo_usd || ''}
              onChange={event => store.setObjetivoVacaciones(Number(event.target.value))}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
              placeholder="0.00"
            />
          </div>
        </div>
        <div className="mt-auto border-t border-slate-700/50 pt-4 text-xs text-slate-400">
          {valuation.status === 'ready'
            ? <>
                <div className="flex flex-wrap items-end justify-between gap-x-2">
                  <div>
                    <p className="text-[11px]">Fondo total</p>
                    <p className="text-sm font-semibold tabular-nums text-violet-300">US$ {valorVacacionesUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                  <span className="text-[11px] text-slate-500">MEP ${cotizacionMEP.toFixed(2)}</span>
                </div>
                {saldosVacaciones.objetivo_usd > 0 && (
                  <p className="mt-2">
                    {faltanteVacacionesUSD > 0
                      ? `Faltan US$ ${faltanteVacacionesUSD.toLocaleString('en-US', { maximumFractionDigits: 2 })} para el objetivo`
                      : 'Objetivo alcanzado'}
                  </p>
                )}
              </>
            : 'El total en USD se mostrará cuando esté disponible la cotización MEP.'}
        </div>
      </div>
      </div>

      {showEmergencySimulator && valuation.status === 'ready' && (
        <EmergencyFundSimulator
          emergencyFundUSD={valorCoberturaUSD}
          monthlyExpensesUSD={gastosMensualesUSD}
          targetMonths={fondo_emergencia.meta_meses}
          includesDollars={saldosFondo.incluir_usd_en_cobertura}
        />
      )}

      {/* Portafolio Actual */}
      <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 overflow-hidden backdrop-blur-sm">
          <div className="p-6 border-b border-slate-700/50 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-200">Portafolio Activo</h3>
              <p className="text-xs text-slate-400 mt-0.5">Saldo consolidado por activo (Ajustado por Ratio CEDEAR)</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              {cotizacionMEP > 0 && (
                <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-lg flex items-center gap-1 font-mono">
                  MEP: ${cotizacionMEP.toFixed(2)}
                </span>
              )}
              {lastUpdate && (
                <span className="text-xs text-slate-400">Precios: {lastUpdate.toLocaleTimeString()}</span>
              )}
              <button
                type="button"
                onClick={() => setShowPortfolioImporter(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors shadow-lg shadow-indigo-500/20"
              >
                <ClipboardPaste size={16} />
                Pegar cartera
              </button>
            </div>
          </div>
          {valuation.status !== 'ready' && (
            <div className="p-6"><ValuationStatus valuation={valuation} /></div>
          )}
          
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
                {valuation.status !== 'ready' ? (
                  <tr><td colSpan={7} className="px-6 py-8 text-center text-slate-500">Esperando una valuación completa…</td></tr>
                ) : portfolioArray.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                      Tu portafolio está vacío. Importa tu cartera desde Administración para empezar.
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
              {valuation.status === 'ready' && portfolioArray.length > 0 && (
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

      </div>

      {showPortfolioImporter && (
        <CurrentPortfolioImporter onClose={() => setShowPortfolioImporter(false)} />
      )}
    </div>
  );
}
