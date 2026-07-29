import React, { useState } from 'react';
import { 
  X, 
  Settings, 
  Briefcase, 
  FileText, 
  BarChart, 
  Percent, 
  Upload, 
  Download, 
  Shield,
  Database,
  Wrench
} from 'lucide-react';
import { useStore } from '../store/useStore';

interface Props {
  onClose: () => void;
  onOpenAmCharts: () => void;
  onOpenBroker: () => void;
  onOpenCurrentPortfolio: () => void;
  onOpenCedearRatios: () => void;
  onExportJson: () => void;
  onImportJson: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function AdminModal({
  onClose,
  onOpenAmCharts,
  onOpenBroker,
  onOpenCurrentPortfolio,
  onOpenCedearRatios,
  onExportJson,
  onImportJson
}: Props) {
  const store = useStore();
  const { fondo_emergencia, setFondoEmergencia } = store;

  const [saldoEmergencia, setSaldoEmergencia] = useState(fondo_emergencia.saldo_actual || 0);
  const [metaMeses, setMetaMeses] = useState(fondo_emergencia.meta_meses || 6);
  const [savedMessage, setSavedMessage] = useState(false);

  const handleSaveEmergencia = (e: React.FormEvent) => {
    e.preventDefault();
    setFondoEmergencia(Number(saldoEmergencia), Number(metaMeses));
    setSavedMessage(true);
    setTimeout(() => setSavedMessage(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Settings size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Panel de Administración</h2>
              <p className="text-slate-400 text-xs mt-0.5">Gestión de datos, importaciones y configuración del sistema</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-8">
          
          {/* Seccion 1: Importadores e Integraciones */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Wrench size={18} className="text-indigo-400" />
              <h3 className="text-md font-semibold text-slate-200">Herramientas de Importación e Integraciones</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Mis Inversiones */}
              <button
                onClick={() => { onClose(); onOpenCurrentPortfolio(); }}
                className="flex items-start gap-4 p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 hover:bg-slate-800/80 hover:border-emerald-500/40 transition-all text-left group"
              >
                <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition-transform">
                  <Briefcase size={22} />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-200 group-hover:text-emerald-400 transition-colors">Mis Inversiones</h4>
                  <p className="text-xs text-slate-400 mt-1">Importa y reemplaza las posiciones activas de tu cartera pegando el estado consolidado de tu bróker.</p>
                </div>
              </button>

              {/* Pegar Broker */}
              <button
                onClick={() => { onClose(); onOpenBroker(); }}
                className="flex items-start gap-4 p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 hover:bg-slate-800/80 hover:border-blue-500/40 transition-all text-left group"
              >
                <div className="p-3 rounded-lg bg-blue-500/10 text-blue-400 group-hover:scale-110 transition-transform">
                  <FileText size={22} />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-200 group-hover:text-blue-400 transition-colors">Pegar Movimientos de Bróker</h4>
                  <p className="text-xs text-slate-400 mt-1">Analiza mediante RegEx movimientos de compras/ventas y depósitos pegados desde la tabla de tu bróker.</p>
                </div>
              </button>

              {/* amCharts */}
              <button
                onClick={() => { onClose(); onOpenAmCharts(); }}
                className="flex items-start gap-4 p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 hover:bg-slate-800/80 hover:border-purple-500/40 transition-all text-left group"
              >
                <div className="p-3 rounded-lg bg-purple-500/10 text-purple-400 group-hover:scale-110 transition-transform">
                  <BarChart size={22} />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-200 group-hover:text-purple-400 transition-colors">Histórico amCharts</h4>
                  <p className="text-xs text-slate-400 mt-1">Procesa archivos JSON de amCharts, agrupa por semanas ISO y limpia datos atípicos.</p>
                </div>
              </button>

              {/* Ratios CEDEAR */}
              <button
                onClick={() => { onClose(); onOpenCedearRatios(); }}
                className="flex items-start gap-4 p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 hover:bg-slate-800/80 hover:border-amber-500/40 transition-all text-left group"
              >
                <div className="p-3 rounded-lg bg-amber-500/10 text-amber-400 group-hover:scale-110 transition-transform">
                  <Percent size={22} />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-200 group-hover:text-amber-400 transition-colors">Ratios de CEDEARs</h4>
                  <p className="text-xs text-slate-400 mt-1">Carga o actualiza la tabla de equivalencias y ratios mediante archivos CSV.</p>
                </div>
              </button>
            </div>
          </div>

          {/* Seccion 2: Base de Datos Local */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Database size={18} className="text-indigo-400" />
              <h3 className="text-md font-semibold text-slate-200">Gestión de Base de Datos Local (.JSON)</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Importar JSON */}
              <label className="flex items-start gap-4 p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 hover:bg-slate-800/80 hover:border-indigo-500/40 transition-all text-left cursor-pointer group">
                <div className="p-3 rounded-lg bg-indigo-500/10 text-indigo-400 group-hover:scale-110 transition-transform">
                  <Upload size={22} />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-200 group-hover:text-indigo-400 transition-colors">Importar Base de Datos</h4>
                  <p className="text-xs text-slate-400 mt-1">Carga un archivo `finanzas_personales.json` previamente guardado para restaurar tu estado completo.</p>
                  <input type="file" accept=".json" className="hidden" onChange={(e) => { onImportJson(e); onClose(); }} />
                </div>
              </label>

              {/* Exportar JSON */}
              <button
                onClick={() => { onExportJson(); }}
                className="flex items-start gap-4 p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 hover:bg-slate-800/80 hover:border-indigo-500/40 transition-all text-left group"
              >
                <div className="p-3 rounded-lg bg-indigo-500/10 text-indigo-400 group-hover:scale-110 transition-transform">
                  <Download size={22} />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-200 group-hover:text-indigo-400 transition-colors">Exportar Base de Datos</h4>
                  <p className="text-xs text-slate-400 mt-1">Descarga una copia completa en `.json` con todas tus presupuestos, operaciones e historiales.</p>
                </div>
              </button>
            </div>
          </div>

          {/* Seccion 3: Configuración del Fondo de Emergencia */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Shield size={18} className="text-yellow-400" />
              <h3 className="text-md font-semibold text-slate-200">Configuración del Fondo de Emergencia</h3>
            </div>

            <form onSubmit={handleSaveEmergencia} className="p-5 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-1.5 block">Saldo Actual ($)</label>
                  <input
                    type="number"
                    step="any"
                    value={saldoEmergencia}
                    onChange={(e) => setSaldoEmergencia(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-900/60 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-yellow-500"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-1.5 block">Meta en Meses de Gasto</label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    value={metaMeses}
                    onChange={(e) => setMetaMeses(parseInt(e.target.value, 10) || 1)}
                    className="w-full bg-slate-900/60 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-yellow-500"
                    placeholder="6"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-emerald-400 font-medium">
                  {savedMessage ? "✓ Fondo de emergencia actualizado correctamente" : ""}
                </span>
                <button
                  type="submit"
                  className="px-5 py-2 bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 border border-yellow-500/30 font-medium text-xs rounded-xl transition-all"
                >
                  Guardar Cambios del Fondo
                </button>
              </div>
            </form>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-sm rounded-xl transition-colors"
          >
            Cerrar Panel
          </button>
        </div>

      </div>
    </div>
  );
}
