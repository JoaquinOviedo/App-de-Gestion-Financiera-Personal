import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { Plus, Trash2, Calendar, DollarSign, FileText } from 'lucide-react';

export default function HistoryTab() {
  const store = useStore();
  const { historial_patrimonio } = store;

  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [valInversiones, setValInversiones] = useState('');
  const [valEmergencia, setValEmergencia] = useState('');
  const [nota, setNota] = useState('');

  const handleAddHistorial = (e: React.FormEvent) => {
    e.preventDefault();
    const inv = Number(valInversiones) || 0;
    const emg = Number(valEmergencia) || 0;
    
    if (inv === 0 && emg === 0) return;

    store.addHistorial({
      fecha,
      valor_inversiones: inv,
      valor_emergencia: emg,
      total: inv + emg,
      origen: 'MANUAL',
      nota
    });

    setValInversiones('');
    setValEmergencia('');
    setNota('');
  };

  const sortedHistorial = [...historial_patrimonio].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Formulario de Carga */}
      <div className="lg:col-span-4 space-y-6">
        <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-6 backdrop-blur-sm">
          <h3 className="text-lg font-semibold text-slate-200 mb-6 flex items-center gap-2">
            <Plus size={20} className="text-indigo-400" />
            Cargar Hito Histórico
          </h3>

          <form onSubmit={handleAddHistorial} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                <Calendar size={14} /> Fecha
              </label>
              <input 
                type="date"
                required
                value={fecha}
                onChange={e => setFecha(e.target.value)}
                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                <DollarSign size={14} /> Inversiones (Valor Total)
              </label>
              <input 
                type="number"
                value={valInversiones}
                onChange={e => setValInversiones(e.target.value)}
                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                placeholder="0.00"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                <DollarSign size={14} /> Fondo de Emergencia
              </label>
              <input 
                type="number"
                value={valEmergencia}
                onChange={e => setValEmergencia(e.target.value)}
                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                placeholder="0.00"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                <FileText size={14} /> Nota / Etiqueta
              </label>
              <input 
                type="text"
                value={nota}
                onChange={e => setNota(e.target.value)}
                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                placeholder="Ej. Fin de año 2024"
              />
            </div>

            <button 
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-indigo-500/20 mt-4"
            >
              Registrar Hito
            </button>
          </form>
        </div>
      </div>

      {/* Tabla de Registros */}
      <div className="lg:col-span-8">
        <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 overflow-hidden backdrop-blur-sm">
          <div className="p-6 border-b border-slate-700/50">
            <h3 className="text-lg font-semibold text-slate-200">Historial Patrimonial</h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900/30 text-slate-400 text-sm">
                  <th className="px-6 py-3 font-medium">Fecha</th>
                  <th className="px-6 py-3 font-medium text-right">Fondo Emergencia</th>
                  <th className="px-6 py-3 font-medium text-right">Inversiones</th>
                  <th className="px-6 py-3 font-medium text-right">Patrimonio Total</th>
                  <th className="px-6 py-3 font-medium">Origen / Nota</th>
                  <th className="px-6 py-3 font-medium text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {sortedHistorial.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                      No hay registros históricos. Agrega uno para empezar.
                    </td>
                  </tr>
                ) : (
                  sortedHistorial.map(record => (
                    <tr key={record.id} className="hover:bg-slate-700/20 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-slate-300">
                        {record.fecha}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-emerald-400 font-medium">
                        ${record.valor_emergencia.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-blue-400 font-medium">
                        ${record.valor_inversiones.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-slate-200">
                        ${record.total.toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full w-fit ${
                            record.origen === 'AUTO_SNAPSHOT' 
                              ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' 
                              : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                          }`}>
                            {record.origen === 'AUTO_SNAPSHOT' ? 'Automático' : 'Manual'}
                          </span>
                          {record.nota && (
                            <span className="text-sm text-slate-400 mt-1 truncate max-w-[150px]" title={record.nota}>
                              {record.nota}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button 
                          onClick={() => store.removeHistorial(record.id)}
                          className="text-slate-500 hover:text-red-400 p-1 rounded-md transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
