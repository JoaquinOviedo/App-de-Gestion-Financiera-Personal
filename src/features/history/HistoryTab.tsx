import { useStore } from '../../store/useStore';
import { Trash2 } from 'lucide-react';
import type { OrigenHistorial } from '../../types';

const originLabels: Record<OrigenHistorial, string> = {
  AUTO_SNAPSHOT: 'Automático',
  HISTORICO_AMCHARTS: 'Importado',
  IMPORTADOR_BROKER: 'Bróker',
  MANUAL: 'Manual heredado'
};

const originStyles: Record<OrigenHistorial, string> = {
  AUTO_SNAPSHOT: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  HISTORICO_AMCHARTS: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  IMPORTADOR_BROKER: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  MANUAL: 'bg-slate-500/10 text-slate-400 border-slate-500/20'
};

export default function HistoryTab() {
  const store = useStore();
  const { historial_patrimonio } = store;

  const sortedHistorial = [...historial_patrimonio].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

  return (
    <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 overflow-hidden backdrop-blur-sm">
          <div className="p-6 border-b border-slate-700/50">
            <h3 className="text-lg font-semibold text-slate-200">Historial Patrimonial</h3>
            <p className="text-xs text-slate-400 mt-1">Snapshots automáticos semanales e históricos importados.</p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900/30 text-slate-400 text-sm">
                  <th className="px-6 py-3 font-medium">Fecha</th>
                  <th className="px-6 py-3 font-medium text-right">Fondo Emergencia</th>
                  <th className="px-6 py-3 font-medium text-right">Fondo Vacaciones</th>
                  <th className="px-6 py-3 font-medium text-right">Inversiones</th>
                  <th className="px-6 py-3 font-medium text-right">Patrimonio Total</th>
                  <th className="px-6 py-3 font-medium">Origen / Nota</th>
                  <th className="px-6 py-3 font-medium text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {sortedHistorial.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                      Todavía no hay registros. El primer hito se creará automáticamente cuando la valuación esté completa.
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
                      <td className="px-6 py-4 whitespace-nowrap text-right text-violet-400 font-medium">
                        ${(record.valor_vacaciones ?? 0).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-blue-400 font-medium">
                        ${record.valor_inversiones.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-slate-200">
                        ${record.total.toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full w-fit border ${originStyles[record.origen]}`}>
                            {originLabels[record.origen]}
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
  );
}
