import { useState } from 'react';
import { X, Check, FileText, RefreshCw, AlertTriangle } from 'lucide-react';
import { useStore } from '../store/useStore';
import { Operacion } from '../types';
import { getCedearRatio } from '../lib/cedears';
import { v4 as uuidv4 } from 'uuid';

interface ParsedHolding {
  ticker: string;
  nombre: string;
  cantidad: number;
  precioPromedioUSD: number;
  precioActualUSD: number;
  totalUSD: number;
  ratio: number;
}

interface Props {
  onClose: () => void;
}

const parseUSDNumber = (str: string) => {
  if (!str) return 0;
  const clean = str.replace(/USD/gi, '').replace(/\s/g, '').replace(/\./g, '').replace(/,/g, '.').replace(/%/g, '');
  return parseFloat(clean) || 0;
};

export default function CurrentPortfolioImporter({ onClose }: Props) {
  const [rawText, setRawText] = useState('');
  const [holdings, setHoldings] = useState<ParsedHolding[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const { reemplazarPortafolioActual, cedear_ratios } = useStore();

  const handleParse = () => {
    setIsProcessing(true);
    const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    const parsed: ParsedHolding[] = [];
    let pendingTicker = '';

    lines.forEach(line => {
      // Ignore header lines or section totals
      if (
        /^mis inversiones/i.test(line) ||
        /^producto/i.test(line) ||
        /^total var/i.test(line) ||
        /^(cedears|fondos|bonos|acciones)\s+usd/i.test(line)
      ) {
        return;
      }

      // Check if line is just a ticker (e.g. GLD, IBIT, QQQ, SPY, VIG, COMIAUS)
      if (/^[A-Z0-9.]{2,10}$/i.test(line)) {
        pendingTicker = line.toUpperCase();
        return;
      }

      // If line contains columns (tabs or 2+ spaces)
      const parts = line.split(/\t+|\s{2,}/).map(p => p.trim()).filter(p => p.length > 0);

      if (parts.length >= 3) {
        const nombre = parts[0];
        const cantidad = parseUSDNumber(parts[1]);
        const precioActualUSD = parseUSDNumber(parts[2]);
        
        // PPC is usually column index 5 if 8+ parts, or we check for PPC
        let precioPromedioUSD = precioActualUSD;
        if (parts.length >= 6) {
          precioPromedioUSD = parseUSDNumber(parts[5]) || precioActualUSD;
        }

        // Total is usually last column
        let totalUSD = cantidad * precioActualUSD;
        if (parts.length >= 8) {
          totalUSD = parseUSDNumber(parts[parts.length - 1]) || totalUSD;
        }

        let ticker = pendingTicker;
        if (!ticker) {
          // Extract first word of nombre if ticker was not on preceding line
          const match = nombre.match(/^[A-Z0-9]{2,6}/i);
          ticker = match ? match[0].toUpperCase() : 'ASSET';
        }

        if (cantidad > 0) {
          parsed.push({
            ticker,
            nombre,
            cantidad,
            precioPromedioUSD,
            precioActualUSD,
            totalUSD,
            ratio: getCedearRatio(ticker, cedear_ratios)
          });
        }

        pendingTicker = ''; // Reset for next item
      }
    });

    setHoldings(parsed);
    setIsProcessing(false);
  };

  const handleConfirm = () => {
    const today = new Date().toISOString().split('T')[0];

    const nuevasOperaciones: Operacion[] = holdings.map(h => ({
      id: uuidv4(),
      fecha: today,
      tipo: 'COMPRA',
      ticker: h.ticker,
      nombre: h.nombre,
      icono_url: '',
      cantidad: h.cantidad,
      precio_operacion: h.precioPromedioUSD, // Purchase cost in USD
      precio_actual_usd: h.precioActualUSD,
      origen: 'IMPORTADOR_CARTERA_ACTUAL'
    }));

    reemplazarPortafolioActual(nuevasOperaciones);
    onClose();
  };

  const handleHoldingChange = <K extends keyof ParsedHolding,>(index: number, field: K, val: ParsedHolding[K]) => {
    setHoldings(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  const handleDeleteHolding = (index: number) => {
    setHoldings(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-800">
          <div>
            <h2 className="text-xl font-semibold text-white">Importar Cartera Actual ("Mis Inversiones")</h2>
            <p className="text-gray-400 text-sm mt-1">Pega la vista tabular de tu cartera actual para reemplazar e importar todas tus posiciones existentes.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6">
          
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <FileText size={16} /> Texto de "Mis Inversiones"
            </label>
            <textarea
              className="w-full h-32 bg-gray-800/50 border border-gray-700 rounded-lg p-3 text-sm text-gray-200 font-mono resize-none focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder={`Pega el contenido aquí... Ej:\nGLD\nCedear Spdr Gold Shares\t137,00\tUSD 7,88\t1,10%\tUSD 11,78\tUSD 7,76\t1,60%\tUSD 16,96\tUSD 1.079,56`}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
            />
            <div className="flex justify-end">
              <button
                onClick={handleParse}
                disabled={isProcessing || rawText.trim().length === 0}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshCw size={16} className={isProcessing ? 'animate-spin' : ''} /> 
                Analizar Cartera
              </button>
            </div>
          </div>

          {holdings.length > 0 && (
            <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
              
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center gap-2 text-amber-400 text-sm">
                <AlertTriangle size={18} />
                <span>
                  <strong>Nota:</strong> Al confirmar, estas posiciones **reemplazarán** las operaciones activas anteriores de tu portafolio.
                </span>
              </div>

              <div className="border border-gray-800 rounded-lg overflow-hidden bg-gray-900/50">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-gray-400 bg-gray-800/50">
                      <tr>
                        <th className="p-3 font-medium">Ticker</th>
                        <th className="p-3 font-medium">Descripción</th>
                        <th className="p-3 font-medium text-right">Cantidad (CEDEARs)</th>
                        <th className="p-3 font-medium text-right">PPC / Costo (USD)</th>
                        <th className="p-3 font-medium text-right">Precio Actual (USD)</th>
                        <th className="p-3 font-medium text-right">Total (USD)</th>
                        <th className="p-3 font-medium text-center">Ratio CEDEAR</th>
                        <th className="p-3 font-medium text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {holdings.map((h, i) => (
                        <tr key={i} className="hover:bg-gray-800/30">
                          <td className="p-3 font-bold text-white">
                            <input
                              type="text"
                              className="bg-transparent border-b border-gray-700 w-16 text-white font-bold uppercase focus:outline-none focus:border-blue-500"
                              value={h.ticker}
                              onChange={(e) => handleHoldingChange(i, 'ticker', e.target.value.toUpperCase())}
                            />
                          </td>
                          <td className="p-3 text-gray-300 max-w-xs truncate">{h.nombre}</td>
                          <td className="p-3 text-right">
                            <input
                              type="number"
                              className="bg-transparent border-b border-gray-700 w-20 text-right text-white focus:outline-none focus:border-blue-500"
                              value={h.cantidad}
                              onChange={(e) => handleHoldingChange(i, 'cantidad', parseFloat(e.target.value) || 0)}
                            />
                          </td>
                          <td className="p-3 text-right">
                            <input
                              type="number"
                              step="0.01"
                              className="bg-transparent border-b border-gray-700 w-20 text-right text-emerald-400 focus:outline-none focus:border-blue-500 font-medium"
                              value={h.precioPromedioUSD}
                              onChange={(e) => handleHoldingChange(i, 'precioPromedioUSD', parseFloat(e.target.value) || 0)}
                            />
                          </td>
                          <td className="p-3 text-right text-gray-300">
                            ${h.precioActualUSD.toFixed(2)}
                          </td>
                          <td className="p-3 text-right font-medium text-white">
                            ${(h.cantidad * h.precioActualUSD).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="p-3 text-center">
                            <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded text-xs border border-blue-500/20 font-mono">
                              {h.ratio}:1
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => handleDeleteHolding(i)}
                              className="text-red-400 hover:text-red-300 p-1 hover:bg-red-500/10 rounded transition-colors"
                              title="Eliminar"
                            >
                              <X size={16} />
                            </button>
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
        {holdings.length > 0 && (
          <div className="p-6 border-t border-gray-800 flex justify-end gap-3 bg-gray-900/80">
            <button 
              onClick={() => { setHoldings([]); setRawText(''); }}
              className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium rounded-lg transition-colors"
            >
              Limpiar
            </button>
            <button 
              onClick={handleConfirm}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              <Check size={18} /> Reemplazar e Importar Cartera Actual
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
