import { useState } from 'react';
import { useStore } from '../../store/useStore';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Plus, Trash2, ChevronDown, ChevronRight, Calculator } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function BudgetTab() {
  const store = useStore();
  const presupuesto = store.presupuesto;
  
  const [openCategorias, setOpenCategorias] = useState<Record<string, boolean>>({});
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

  const totalGastos = presupuesto.categorias.reduce((acc, cat) => {
    return acc + cat.subgastos.reduce((subAcc, sub) => subAcc + (sub.costo_unitario * sub.frecuencia), 0);
  }, 0);

  const ahorroLibre = presupuesto.ingreso_mensual - totalGastos - presupuesto.asignacion_inversiones;

  const chartData = [
    { name: 'Gastos Fijos/Variables', value: totalGastos, color: '#f43f5e' }, 
    { name: 'Inversiones y Ahorro', value: presupuesto.asignacion_inversiones, color: '#3b82f6' }, 
    { name: 'Libre', value: ahorroLibre > 0 ? ahorroLibre : 0, color: '#10b981' } 
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Left Column - Inputs */}
      <div className="lg:col-span-7 space-y-6">
        
        {/* Ingreso Card */}
        <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-6 backdrop-blur-sm">
          <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
            <Calculator size={20} className="text-emerald-400" />
            Ingreso Mensual
          </h3>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">$</span>
            <input 
              type="number" 
              value={presupuesto.ingreso_mensual || ''}
              onChange={(e) => store.setIngresoMensual(Number(e.target.value))}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-xl py-3 pl-8 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all text-lg font-medium"
              placeholder="0.00"
            />
          </div>
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
                    <span className="text-slate-400 font-medium">
                      ${cat.subgastos.reduce((a, b) => a + (b.costo_unitario * b.frecuencia), 0).toLocaleString()}
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
                            <div className="col-span-5">
                              <input 
                                type="text"
                                value={sub.nombre}
                                onChange={(e) => store.updateSubgasto(cat.id, sub.id, { nombre: e.target.value })}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500 text-white"
                                placeholder="Nombre del gasto"
                              />
                            </div>
                            <div className="col-span-3 relative">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                              <input 
                                type="number"
                                value={sub.costo_unitario || ''}
                                onChange={(e) => store.updateSubgasto(cat.id, sub.id, { costo_unitario: Number(e.target.value) })}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg py-1.5 pl-6 pr-2 text-sm focus:outline-none focus:border-indigo-500 text-white"
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

        {/* Asignacion a Inversiones */}
        <div className="bg-slate-800/50 rounded-2xl border border-indigo-500/30 p-6 backdrop-blur-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-3xl rounded-full"></div>
          <h3 className="text-lg font-semibold text-indigo-300 mb-4 flex items-center gap-2">
            Ahorro e Inversiones
          </h3>
          <p className="text-sm text-slate-400 mb-4">Destina una parte de tus ingresos para tu futuro.</p>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">$</span>
            <input 
              type="number" 
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
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: any) => `$${value.toLocaleString()}`}
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '0.75rem', color: '#f8fafc' }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Center Text */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
              <span className="block text-slate-400 text-xs font-medium">Restante</span>
              <span className={`text-xl font-bold ${ahorroLibre >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                ${ahorroLibre.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center py-2 border-b border-slate-700/50">
              <span className="text-slate-400">Ingreso Total</span>
              <span className="font-semibold">${presupuesto.ingreso_mensual.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-700/50">
              <span className="flex items-center gap-2 text-slate-400">
                <div className="w-3 h-3 rounded-full bg-rose-500"></div> Gastos
              </span>
              <span className="font-semibold">${totalGastos.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-700/50">
              <span className="flex items-center gap-2 text-slate-400">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div> Inversiones
              </span>
              <span className="font-semibold">${presupuesto.asignacion_inversiones.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center py-2 pt-4">
              <span className="flex items-center gap-2 font-medium">
                <div className="w-3 h-3 rounded-full bg-emerald-500"></div> Ahorro Libre
              </span>
              <span className={`font-bold text-lg ${ahorroLibre >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                ${ahorroLibre.toLocaleString()}
              </span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
