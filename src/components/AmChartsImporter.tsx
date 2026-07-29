import React, { useState, useRef } from 'react';
import { Upload, X, Check, AlertCircle } from 'lucide-react';
import { useStore } from '../store/useStore';
import { RegistroHistorial } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface AmChartsData {
  date: number | string;
  totalMovement: number;
  totalBalanceUSD: number;
}

interface ProcessedWeek {
  isoWeek: string;
  closeDate: string;
  avgUsd: number;
  totalMovement: number;
}

interface Props {
  onClose: () => void;
}

// Helper to get ISO week string (e.g. "2023-W44")
function getISOWeek(date: Date) {
  const target = new Date(date.valueOf());
  const dayNr = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  const weekNumber = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
  return `${target.getFullYear()}-W${weekNumber.toString().padStart(2, '0')}`;
}

export default function AmChartsImporter({ onClose }: Props) {
  const [processedData, setProcessedData] = useState<ProcessedWeek[]>([]);
  const [errorCount, setErrorCount] = useState(0);
  const [replaceMode, setReplaceMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { importarHistorialAmCharts } = useStore();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json: AmChartsData[] = JSON.parse(event.target?.result as string);
        processAmChartsData(json);
      } catch (error) {
        alert("Error al leer el archivo JSON. Asegúrate de que tenga el formato correcto.");
      }
    };
    reader.readAsText(file);
  };

  const processAmChartsData = (data: AmChartsData[]) => {
    let errors = 0;
    const normalizedData = data
      .filter(item => {
        if (!item || typeof item.totalBalanceUSD !== 'number') {
          errors++;
          return false;
        }
        if (item.totalBalanceUSD > 100000) {
          errors++;
          return false;
        }
        return true;
      })
      .map(item => {
        // Handle both numeric timestamps and ISO date strings (e.g. "2024-05-01T00:00:00-03:00")
        let timestamp: number;
        if (typeof item.date === 'number') {
          timestamp = item.date;
        } else {
          timestamp = new Date(item.date).getTime();
        }
        return {
          ...item,
          timestamp
        };
      })
      .filter(item => !isNaN(item.timestamp));

    const groupedByWeek: Record<string, typeof normalizedData> = {};

    normalizedData.forEach(item => {
      const date = new Date(item.timestamp);
      const week = getISOWeek(date);
      if (!groupedByWeek[week]) groupedByWeek[week] = [];
      groupedByWeek[week].push(item);
    });

    const processed: ProcessedWeek[] = Object.keys(groupedByWeek).map(week => {
      const group = groupedByWeek[week];
      const sumUsd = group.reduce((acc, curr) => acc + curr.totalBalanceUSD, 0);
      const sumMovement = group.reduce((acc, curr) => acc + (curr.totalMovement || 0), 0);
      const maxTimestamp = Math.max(...group.map(i => i.timestamp));
      const maxDate = new Date(maxTimestamp);

      return {
        isoWeek: week,
        closeDate: maxDate.toISOString().split('T')[0],
        avgUsd: sumUsd / group.length,
        totalMovement: sumMovement
      };
    });

    processed.sort((a, b) => new Date(a.closeDate).getTime() - new Date(b.closeDate).getTime());

    setProcessedData(processed);
    setErrorCount(errors);
  };

  const handleConfirm = () => {
    const registros: RegistroHistorial[] = processedData.map(week => ({
      id: uuidv4(),
      fecha: week.closeDate,
      valor_inversiones: week.avgUsd,
      valor_emergencia: 0,
      total: week.avgUsd,
      origen: 'HISTORICO_AMCHARTS',
      nota: `Promedio semanal ${week.isoWeek}`,
      balance_usd: week.avgUsd,
      movimiento: week.totalMovement
    }));

    importarHistorialAmCharts(registros, replaceMode);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-800">
          <div>
            <h2 className="text-xl font-semibold text-white">Importador Histórico (amCharts)</h2>
            <p className="text-gray-400 text-sm mt-1">Carga tu historial JSON exportado desde amCharts</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {processedData.length === 0 ? (
            <div className="border-2 border-dashed border-gray-700 rounded-xl p-12 text-center flex flex-col items-center justify-center">
              <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mb-4">
                <Upload size={32} className="text-blue-500" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">Sube tu archivo JSON</h3>
              <p className="text-gray-400 text-sm mb-6 max-w-md">
                El archivo debe contener el array de objetos con `date`, `totalMovement` y `totalBalanceUSD`.
              </p>
              <input 
                type="file" 
                accept=".json" 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleFileUpload}
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                Seleccionar Archivo
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Stats & Controls */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-800">
                  <div className="text-gray-400 text-sm">Semanas a importar</div>
                  <div className="text-2xl font-semibold text-white">{processedData.length}</div>
                </div>
                <div className="bg-red-500/10 rounded-lg p-4 border border-red-500/20">
                  <div className="text-red-400 text-sm flex items-center gap-1">
                    <AlertCircle size={14} /> Errores descartados
                  </div>
                  <div className="text-2xl font-semibold text-red-500">{errorCount}</div>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-800 flex items-center justify-between">
                  <div>
                    <div className="text-gray-400 text-sm">Modo de importación</div>
                    <div className="text-sm font-medium text-white mt-1">
                      {replaceMode ? 'Reemplazar anteriores' : 'Añadir al historial'}
                    </div>
                  </div>
                  <button 
                    onClick={() => setReplaceMode(!replaceMode)}
                    className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                    title="Alternar modo"
                  >
                    🔄
                  </button>
                </div>
              </div>

              {/* Preview Table */}
              <div className="border border-gray-800 rounded-lg overflow-hidden bg-gray-900/50">
                <div className="overflow-x-auto max-h-[400px]">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-800 text-gray-400 sticky top-0">
                      <tr>
                        <th className="p-3 font-medium">Semana ISO</th>
                        <th className="p-3 font-medium">Fecha de Cierre</th>
                        <th className="p-3 font-medium text-right">Promedio USD</th>
                        <th className="p-3 font-medium text-right">Movimiento (ARS)</th>
                        <th className="p-3 font-medium text-center">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {processedData.map((week, idx) => (
                        <tr key={idx} className="hover:bg-gray-800/50 transition-colors">
                          <td className="p-3 text-white">{week.isoWeek}</td>
                          <td className="p-3 text-gray-300">{week.closeDate}</td>
                          <td className="p-3 text-emerald-400 text-right font-medium">
                            ${week.avgUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="p-3 text-gray-300 text-right">
                            ${week.totalMovement.toLocaleString('es-AR')}
                          </td>
                          <td className="p-3 text-center">
                            <span className="inline-flex items-center justify-center bg-emerald-500/20 text-emerald-400 p-1 rounded-full">
                              <Check size={14} />
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {processedData.length > 0 && (
          <div className="p-6 border-t border-gray-800 flex justify-end gap-3 bg-gray-900/80">
            <button 
              onClick={() => { setProcessedData([]); setErrorCount(0); }}
              className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button 
              onClick={handleConfirm}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              <Check size={18} /> Confirmar y Actualizar Base de Datos
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
