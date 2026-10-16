import { useState } from 'react';
import { useStore } from '../../store/useStore';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Plus, Trash2, ChevronDown, ChevronRight, Calculator, Shield, Plane } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePortfolioValuation } from '../../lib/portfolioValuation';
import { budgetIncomeShare, calculateBudgetTotals, getBudgetExpenseItems } from '../../lib/budget';

const formatIncomeShare = (amount: number, income: number) => {
  const share = budgetIncomeShare(amount, income);
  return share === null ? null : `${share.toLocaleString('es-AR', { maximumFractionDigits: 1 })}%`;
};

const expenseAmountTitle = (amount: number, income: number, symbol: string) => {
  const percent = formatIncomeShare(amount, income);
  return percent ? `${symbol}${amount.toLocaleString()} por mes · ${percent} del ingreso` : undefined;
};

function IncomeAmount({ amount, income, symbol, className = '', focusable = true }: {
  amount: number;
  income: number;
  symbol: string;
  className?: string;
  focusable?: boolean;
}) {
  const percent = formatIncomeShare(amount, income);
  const displayedAmount = `${symbol}${amount.toLocaleString()}`;

  return (
    <span
      className={`group relative inline-flex whitespace-nowrap tabular-nums ${percent ? 'cursor-help focus-visible:rounded-sm focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-slate-500' : ''} ${className}`}
      tabIndex={percent && focusable ? 0 : undefined}
      aria-label={percent ? `${displayedAmount}, ${percent} del ingreso mensual` : displayedAmount}
    >
      {displayedAmount}
      {percent && (
        <span aria-hidden="true" className="pointer-events-none absolute bottom-full right-0 z-30 mb-1.5 whitespace-nowrap rounded-md border border-slate-600 bg-slate-950 px-2 py-1 text-[11px] font-medium leading-4 text-slate-100 opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          {percent} del ingreso
        </span>
      )}
    </span>
  );
}

export default function BudgetTab() {
  const store = useStore();
  const presupuesto = store.presupuesto;
  const valuation = usePortfolioValuation();
  const cotizacionMEP = valuation.status === 'ready' ? valuation.cotizacionMEP : 0;
  const monedaPresupuesto = presupuesto.moneda || 'ARS';
  
  const [openCategorias, setOpenCategorias] = useState<Record<string, boolean>>({});
  const [showExpenseDetails, setShowExpenseDetails] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  const toggleCategoria = (id: string) => {
    setOpenCategorias(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleAddCategoria = () => {
    if (!newCatName.trim()) return;
    store.addCategoria({
      id: crypto.randomUUID(),
      nombre: newCatName,
      subgastos: []
    });
    setNewCatName('');
  };

  const handleAddSubgasto = (catId: string) => {
    store.addSubgasto(catId, {
      id: crypto.randomUUID(),
      nombre: 'Nuevo Gasto',
      costo_unitario: 0,
      frecuencia: 1
    });
    setOpenCategorias(prev => ({ ...prev, [catId]: true }));
  };

  const totals = calculateBudgetTotals(presupuesto);
  const totalGastos = totals.gastos;
  const ahorroLibre = totals.libre;
  const expenseItems = getBudgetExpenseItems(presupuesto);

  const chartData = [
    ...expenseItems.filter(item => item.value > 0).map(item => ({
      name: `${item.categoryName} · ${item.name}`,
      value: item.value,
      color: item.color,
      isExpense: true,
    })),
    { name: 'Aporte a Emergencia', value: presupuesto.asignacion_emergencia, color: '#eab308', isExpense: false },
    { name: 'Vacaciones', value: presupuesto.asignacion_vacaciones, color: '#8b5cf6', isExpense: false },
    { name: 'Inversiones y Ahorro', value: presupuesto.asignacion_inversiones, color: '#3b82f6', isExpense: false },
    { name: 'Libre', value: ahorroLibre > 0 ? ahorroLibre : 0, color: '#10b981', isExpense: false }
  ];

  const currSymbol = monedaPresupuesto === 'USD' ? 'US$' : '$';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Left Column - Inputs */}
      <div className="lg:col-span-7 space-y-6">
        
        {/* Ingreso Card */}
        <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-6 backdrop-blur-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
              <Calculator size={20} className="text-emerald-400" />
              Ingreso Mensual
            </h3>
            {/* Currency Selector */}
            <div className="flex items-center gap-2 bg-slate-900/60 p-1 rounded-xl border border-slate-700/50">
              <button
                onClick={() => store.setPresupuestoMoneda('ARS')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${monedaPresupuesto === 'ARS' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-slate-400 hover:text-slate-200'}`}
              >
                ARS ($)
              </button>
              <button
                onClick={() => store.setPresupuestoMoneda('USD')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${monedaPresupuesto === 'USD' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-slate-400 hover:text-slate-200'}`}
              >
                USD (US$)
              </button>
            </div>
          </div>

          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">{currSymbol}</span>
            <input 
              type="number" 
              value={presupuesto.ingreso_mensual || ''}
              onChange={(e) => store.setIngresoMensual(Number(e.target.value))}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all text-lg font-medium"
              placeholder="0.00"
            />
          </div>
          {cotizacionMEP > 0 && presupuesto.ingreso_mensual > 0 && (
            <p className="text-xs text-slate-400 mt-2">
              {monedaPresupuesto === 'ARS'
                ? `≈ US$ ${(presupuesto.ingreso_mensual / cotizacionMEP).toFixed(2)} USD (Dólar MEP: $${cotizacionMEP.toFixed(2)})`
                : `≈ $ ${(presupuesto.ingreso_mensual * cotizacionMEP).toLocaleString('es-AR', { maximumFractionDigits: 0 })} ARS (Dólar MEP: $${cotizacionMEP.toFixed(2)})`
              }
            </p>
          )}
        </div>

        {/* Categorias */}
        <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-6 backdrop-blur-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-slate-200">Estructura de Gastos</h3>
          </div>

          <div className="space-y-4 mb-6">
            {presupuesto.categorias.map(cat => (
              <div key={cat.id} className="border border-slate-700 rounded-xl overflow-hidden bg-slate-800/30">
                <div 
                  className="w-full px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-slate-700/30 transition-colors"
                  onClick={() => toggleCategoria(cat.id)}
                >
                  <div className="flex items-center gap-2 font-medium">
                    {openCategorias[cat.id] ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronRight size={18} className="text-slate-400" />}
                    {cat.nombre}
                  </div>
                  <div className="flex items-center gap-4">
                    <span
                      className="cursor-help text-slate-400 font-medium"
                      title={expenseAmountTitle(cat.subgastos.reduce((a, b) => a + (b.costo_unitario * b.frecuencia), 0), presupuesto.ingreso_mensual, currSymbol)}
                    >
                      {currSymbol}{cat.subgastos.reduce((a, b) => a + (b.costo_unitario * b.frecuencia), 0).toLocaleString()}
                    </span>
                    <button 
                      onClick={(e) => { e.stopPropagation(); store.removeCategoria(cat.id); }}
                      className="text-slate-500 hover:text-red-400 p-1 rounded-md hover:bg-red-400/10 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <AnimatePresence>
                  {openCategorias[cat.id] && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-slate-700 bg-slate-900/30 overflow-hidden"
                    >
                      <div className="p-4 space-y-3">
                        {cat.subgastos.map(sub => (
                          <div key={sub.id} className="grid grid-cols-12 gap-3 items-center">
                            <div className="col-span-5 flex items-center gap-2 min-w-0">
                              <span
                                className="h-3 w-3 shrink-0 rounded-full"
                                style={{ backgroundColor: expenseItems.find(item => item.categoryId === cat.id && item.id === sub.id)?.color }}
                              />
                              <input 
                                type="text"
                                value={sub.nombre}
                                onChange={(e) => store.updateSubgasto(cat.id, sub.id, { nombre: e.target.value })}
                                className="min-w-0 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500 text-white"
                                placeholder="Nombre del gasto"
                              />
                            </div>
                            <div className="col-span-3 relative">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm">{currSymbol}</span>
                              <input 
                                type="number"
                                value={sub.costo_unitario || ''}
                                onChange={(e) => store.updateSubgasto(cat.id, sub.id, { costo_unitario: Number(e.target.value) })}
                                title={expenseAmountTitle(sub.costo_unitario * sub.frecuencia, presupuesto.ingreso_mensual, currSymbol)}
                                className={`w-full bg-slate-800 border border-slate-700 rounded-lg py-1.5 pr-2 text-sm focus:outline-none focus:border-indigo-500 text-white ${monedaPresupuesto === 'USD' ? 'pl-9' : 'pl-6'}`}
                                placeholder="Costo"
                              />
                            </div>
                            <div className="col-span-3 flex items-center gap-2">
                              <span className="text-slate-400 text-xs">x</span>
                              <input 
                                type="number"
                                value={sub.frecuencia || ''}
                                onChange={(e) => store.updateSubgasto(cat.id, sub.id, { frecuencia: Number(e.target.value) })}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-500 text-white"
                                placeholder="Frec."
                                min="1"
                              />
                            </div>
                            <div className="col-span-1 text-right">
                              <button 
                                onClick={() => store.removeSubgasto(cat.id, sub.id)}
                                className="text-slate-500 hover:text-red-400 p-1"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        ))}
                        <button 
                          onClick={() => handleAddSubgasto(cat.id)}
                          className="flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 font-medium py-2"
                        >
                          <Plus size={16} /> Agregar Ítem
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <input 
              type="text"
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddCategoria()}
              className="flex-1 bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder="Nueva categoría (ej. Vivienda, Salud)..."
            />
            <button 
              onClick={handleAddCategoria}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl transition-colors font-medium"
            >
              Agregar
            </button>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-2xl border border-yellow-500/30 p-6 backdrop-blur-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 blur-3xl rounded-full" />
          <h3 className="text-lg font-semibold text-yellow-300 mb-3 flex items-center gap-2">
            <Shield size={20} /> Aporte al fondo de emergencia
          </h3>
          <p className="text-sm text-slate-400 mb-4">Plan mensual separado de los gastos. El saldo acumulado se carga en Inversiones.</p>
          <label htmlFor="budget-emergency-allocation" className="text-xs text-slate-400 block mb-2">
            Aporte mensual ({monedaPresupuesto})
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">{currSymbol}</span>
            <input
              id="budget-emergency-allocation"
              type="number"
              min="0"
              step="any"
              value={presupuesto.asignacion_emergencia || ''}
              onChange={event => store.setAsignacionEmergencia(Number(event.target.value))}
              className="w-full bg-slate-900/50 border border-yellow-500/50 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-yellow-500/50 transition-all text-lg font-medium"
              placeholder="0.00"
            />
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-2xl border border-violet-500/30 p-6 backdrop-blur-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/10 blur-3xl rounded-full" />
          <h3 className="text-lg font-semibold text-violet-300 mb-3 flex items-center gap-2">
            <Plane size={20} /> Vacaciones
          </h3>
          <p className="text-sm text-slate-400 mb-4">Reservá una parte de tus ingresos cada mes, separada de los gastos habituales.</p>
          <label htmlFor="budget-vacation-allocation" className="text-xs text-slate-400 block mb-2">
            Aporte mensual ({monedaPresupuesto})
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">{currSymbol}</span>
            <input
              id="budget-vacation-allocation"
              type="number"
              min="0"
              step="any"
              value={presupuesto.asignacion_vacaciones || ''}
              onChange={event => store.setAsignacionVacaciones(Number(event.target.value))}
              className="w-full bg-slate-900/50 border border-violet-500/50 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all text-lg font-medium"
              placeholder="0.00"
            />
          </div>
        </div>

        {/* Asignacion a Inversiones */}
        <div className="bg-slate-800/50 rounded-2xl border border-indigo-500/30 p-6 backdrop-blur-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-3xl rounded-full"></div>
          <h3 className="text-lg font-semibold text-indigo-300 mb-4 flex items-center gap-2">
            Ahorro e Inversiones
          </h3>
          <p className="text-sm text-slate-400 mb-4">Destina una parte de tus ingresos para tu futuro.</p>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">{currSymbol}</span>
            <input 
              type="number" 
              min="0"
              step="any"
              value={presupuesto.asignacion_inversiones || ''}
              onChange={(e) => store.setAsignacionInversiones(Number(e.target.value))}
              className="w-full bg-slate-900/50 border border-indigo-500/50 rounded-xl py-3 pl-8 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all text-lg font-medium"
              placeholder="0.00"
            />
          </div>
        </div>

      </div>

      {/* Right Column - Summary & Chart */}
      <div className="lg:col-span-5">
        <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-6 backdrop-blur-sm sticky top-24">
          <h3 className="text-lg font-semibold text-slate-200 mb-6">Resumen Mensual</h3>
          
          <div className="h-64 w-full relative mb-8">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={0}
                  dataKey="value"
                  stroke="none"
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.color}
                      stroke={entry.isExpense ? 'none' : '#1e293b'}
                      strokeWidth={entry.isExpense ? 0 : 3}
                    />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value) => {
                    const amount = Number(value ?? 0);
                    const percent = formatIncomeShare(amount, presupuesto.ingreso_mensual);
                    return `${currSymbol}${amount.toLocaleString()}${percent ? ` · ${percent} del ingreso` : ''}`;
                  }}
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '0.75rem', color: '#f8fafc' }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Center Text */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
              <span className="block text-slate-400 text-xs font-medium">Restante</span>
              <IncomeAmount amount={ahorroLibre} income={presupuesto.ingreso_mensual} symbol={currSymbol} className={`text-xl font-bold ${ahorroLibre >= 0 ? 'text-emerald-400' : 'text-red-400'}`} />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center py-2 border-b border-slate-700/50">
              <span className="text-slate-400">Ingreso Total</span>
              <span className="font-semibold">{currSymbol}{presupuesto.ingreso_mensual.toLocaleString()}</span>
            </div>
            <div className="border-b border-slate-700/50">
              <button
                type="button"
                onClick={() => setShowExpenseDetails(open => !open)}
                aria-expanded={showExpenseDetails}
                aria-controls="budget-expense-details"
                className="flex w-full items-center justify-between gap-3 py-2 text-left hover:text-white transition-colors"
              >
                <span className="flex items-center gap-2 text-slate-400">
                  {showExpenseDetails ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                  <span className="h-3 w-3 shrink-0 rounded-full bg-red-500" />
                  Gastos
                </span>
                <IncomeAmount amount={totalGastos} income={presupuesto.ingreso_mensual} symbol={currSymbol} focusable={false} className="shrink-0 font-semibold" />
              </button>
              {showExpenseDetails && (
                <div id="budget-expense-details" className="space-y-3 pb-3 pl-5 text-sm">
                  {presupuesto.categorias.length === 0 && <p className="text-xs text-slate-500">Sin gastos cargados.</p>}
                  {presupuesto.categorias.map(category => {
                    const items = expenseItems.filter(item => item.categoryId === category.id);
                    return (
                      <div key={category.id} className="space-y-1.5">
                        <div className="flex justify-between gap-2 text-xs font-medium text-slate-400">
                          <span className="truncate">{category.nombre}</span>
                          <IncomeAmount amount={items.reduce((sum, item) => sum + item.value, 0)} income={presupuesto.ingreso_mensual} symbol={currSymbol} className="shrink-0" />
                        </div>
                        {items.map(item => (
                          <div key={item.id} className="flex items-center justify-between gap-2 pl-2 text-slate-300">
                            <span className="flex min-w-0 items-center gap-2">
                              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                              <span className="truncate" title={item.name}>{item.name}</span>
                            </span>
                            <IncomeAmount amount={item.value} income={presupuesto.ingreso_mensual} symbol={currSymbol} className="shrink-0" />
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-700/50">
              <span className="flex items-center gap-2 text-slate-400">
                <div className="w-3 h-3 rounded-full bg-yellow-500" /> Emergencia
              </span>
              <IncomeAmount amount={presupuesto.asignacion_emergencia} income={presupuesto.ingreso_mensual} symbol={currSymbol} className="shrink-0 font-semibold" />
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-700/50">
              <span className="flex items-center gap-2 text-slate-400">
                <span className="w-3 h-3 rounded-full bg-violet-500" /> Vacaciones
              </span>
              <IncomeAmount amount={presupuesto.asignacion_vacaciones} income={presupuesto.ingreso_mensual} symbol={currSymbol} className="shrink-0 font-semibold" />
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-700/50">
              <span className="flex items-center gap-2 text-slate-400">
                <span className="w-3 h-3 rounded-full bg-blue-500" /> Inversiones
              </span>
              <IncomeAmount amount={presupuesto.asignacion_inversiones} income={presupuesto.ingreso_mensual} symbol={currSymbol} className="shrink-0 font-semibold" />
            </div>
            <div className="flex justify-between items-center py-2 pt-4">
              <span className="flex items-center gap-2 font-medium">
                <div className="w-3 h-3 rounded-full bg-emerald-500"></div> Ahorro Libre
              </span>
              <IncomeAmount amount={ahorroLibre} income={presupuesto.ingreso_mensual} symbol={currSymbol} className={`shrink-0 text-lg font-bold ${ahorroLibre >= 0 ? 'text-emerald-400' : 'text-red-400'}`} />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
