import { useState } from 'react';
import { X, Check, FileText, RefreshCw, DollarSign } from 'lucide-react';
import { useStore } from '../store/useStore';
import { Operacion, TipoOperacion } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface FlujoInfo {
  fecha: string;
  concepto: string;
  monto: number;
  tipo: 'INGRESO' | 'RETIRO';
}

interface OperacionInfo {
  fecha: string;
  tipo: TipoOperacion;
  ticker: string;
  cantidad: number;
  precioUnitarioArs: number;
  totalArs: number;
  precioUSD?: number; // Calculated later
}

interface Props {
  onClose: () => void;
}

const parseNumber = (str: string) => {
  if (!str) return 0;
  // Removes dollar sign, spaces, dots (thousands) and replaces comma with dot for decimals
  const cleanStr = str.replace(/\$/g, '').replace(/\s/g, '').replace(/\./g, '').replace(/,/g, '.');
  return parseFloat(cleanStr) || 0;
};

export default function BrokerImporter({ onClose }: Props) {
  const [rawText, setRawText] = useState('');
  const [flujos, setFlujos] = useState<FlujoInfo[]>([]);
  const [operaciones, setOperaciones] = useState<OperacionInfo[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isFetchingUSD, setIsFetchingUSD] = useState(false);
  
  const { importarOperacionesBroker } = useStore();

  const handleParse = () => {
    setIsProcessing(true);
    const lineas = rawText.split('\n').filter(l => l.trim() !== '');
    
    const flujosParsed: FlujoInfo[] = [];
    const opsParsed: OperacionInfo[] = [];

    lineas.forEach(line => {
      const lineTrimmed = line.trim();
      if (!lineTrimmed || /^liquida/i.test(lineTrimmed) || /^operado/i.test(lineTrimmed)) {
        return; // Ignore table header line
      }

      // Extract dates (e.g., 06/07/2026 03/07/2026 or 06/07/202603/07/2026)
      const dateMatches = lineTrimmed.match(/\d{2}\/\d{2}\/\d{4}/g);
      let fecha = new Date().toISOString().split('T')[0];
      if (dateMatches && dateMatches.length > 0) {
        const dateStr = dateMatches[dateMatches.length - 1]; // Use operation date
        const [day, month, year] = dateStr.split('/');
        fecha = `${year}-${month}-${day}`;
      }

      // Check for Cash Flow vs Asset Operation
      const isCashFlow = /(RECIBO DE COBRO|DEPOSITO|INGRESO|TRANSFERENCIA|CREDITO)/i.test(lineTrimmed);
      const isAssetOp = /(COMPRA|VENTA)/i.test(lineTrimmed);

      if (isCashFlow) {
        // Extract amounts with dollar sign or formatted numbers
        const amounts = lineTrimmed.match(/\$?\s*([\d.]+,\d{2})/g) || lineTrimmed.match(/\$([\d.,]+)/g);
        let amount = 0;
        if (amounts && amounts.length > 0) {
          amount = Math.abs(parseNumber(amounts[0]));
        }
        if (amount > 0) {
          flujosParsed.push({
            fecha,
            concepto: 'RECIBO DE COBRO / DEPOSITO',
            monto: amount,
            tipo: 'INGRESO'
          });
        }
      } else if (isAssetOp) {
        const tipoOp: TipoOperacion = /VENTA/i.test(lineTrimmed) ? 'VENTA' : 'COMPRA';
        
        let ticker = '';
        let cantidad = 0;
        let precioUnitarioArs = 0;
        let totalArs = 0;

        // Try tab/multi-space split first for tabular data
        const parts = lineTrimmed.split(/\t+|\s{2,}/).map(p => p.trim()).filter(p => p.length > 0);
        
        if (parts.length >= 5) {
          // Find ticker index: uppercase word 2-6 chars, not pure digits
          const tickerIdx = parts.findIndex((p, idx) => idx >= 2 && /^[A-Z0-9]{2,6}$/i.test(p) && !/^\d+$/.test(p));
          if (tickerIdx !== -1) {
            ticker = parts[tickerIdx].toUpperCase();

            // Quantity is typically the column right before ticker
            if (tickerIdx > 0 && /^\d+$/.test(parts[tickerIdx - 1])) {
              cantidad = parseInt(parts[tickerIdx - 1], 10);
            }

            // Unit Price is after ticker
            if (parts.length > tickerIdx + 1) {
              precioUnitarioArs = Math.abs(parseNumber(parts[tickerIdx + 1]));
            }

            // Total Import is after unit price
            if (parts.length > tickerIdx + 2) {
              totalArs = Math.abs(parseNumber(parts[tickerIdx + 2]));
            }
          }
        }

        // Fallback to RegEx if tabular parsing did not resolve ticker or price
        if (!ticker || precioUnitarioArs === 0) {
          const regex = /([A-Z0-9]{2,6})\s*\$?\s*([\d.]+,\d{2})\s*\$?\s*(-?[\d.]+,\d{2})/i;
          const match = lineTrimmed.match(regex);
          if (match) {
            ticker = match[1].toUpperCase();
            precioUnitarioArs = Math.abs(parseNumber(match[2]));
            totalArs = Math.abs(parseNumber(match[3]));
          }
        }

        // Calculate quantity if missing
        if (cantidad <= 0 && precioUnitarioArs > 0 && totalArs > 0) {
          cantidad = Math.round(totalArs / precioUnitarioArs);
        }

        if (ticker && (precioUnitarioArs > 0 || totalArs > 0)) {
          opsParsed.push({
            fecha,
            tipo: tipoOp,
            ticker,
            cantidad: cantidad || 1,
            precioUnitarioArs,
            totalArs: totalArs || (cantidad * precioUnitarioArs)
          });
        }
      }
    });

    setFlujos(flujosParsed);
    setOperaciones(opsParsed);
    setIsProcessing(false);
  };

  const fetchDolarMEP = async () => {
    setIsFetchingUSD(true);
    try {
      // Using argentinadatos API which contains historical series for MEP
      const res = await fetch('https://api.argentinadatos.com/v1/cotizaciones/dolares/mep');
      const data = await res.json();
      
      const updatedOps = operaciones.map(op => {
        // Find closest date <= op.fecha
        const dateTarget = new Date(op.fecha).getTime();
        let bestRate = data[data.length - 1]; // fallback to last known
        let minDiff = Infinity;
        
        for (const record of data) {
          const recordDate = new Date(record.fecha).getTime();
          if (recordDate <= dateTarget) {
            const diff = dateTarget - recordDate;
            if (diff < minDiff) {
              minDiff = diff;
              bestRate = record;
            }
          }
        }
        
        const rate = (bestRate.compra + bestRate.venta) / 2;
        return {
          ...op,
          precioUSD: op.precioUnitarioArs / rate
        };
      });
      
      setOperaciones(updatedOps);
    } catch (error) {
      alert("Error obteniendo cotización MEP. Revisa tu conexión.");
      console.error(error);
    } finally {
      setIsFetchingUSD(false);
    }
  };

  const handleConfirm = () => {
    const totalIngresos = flujos.reduce((acc, curr) => curr.tipo === 'INGRESO' ? acc + curr.monto : acc, 0);
    
    const nuevasOps: Operacion[] = operaciones.map(op => ({
      id: uuidv4(),
      fecha: op.fecha,
      tipo: op.tipo,
      ticker: op.ticker,
      nombre: op.ticker,
      icono_url: '',
      cantidad: op.cantidad,
      precio_operacion: op.precioUSD || 0, // Fallback to 0 if USD wasn't fetched
      precio_unitario_ars: op.precioUnitarioArs,
      total_ars: op.totalArs,
      origen: 'IMPORTADOR_BROKER'
    }));

    importarOperacionesBroker(nuevasOps, totalIngresos);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-800">
          <div>
            <h2 className="text-xl font-semibold text-white">Importador de Bróker (Paste-to-Parse)</h2>
            <p className="text-gray-400 text-sm mt-1">Pega el texto directamente desde la tabla de movimientos de tu bróker.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6">
          
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <FileText size={16} /> Texto Crudo del Bróker
            </label>
            <textarea
              className="w-full h-32 bg-gray-800/50 border border-gray-700 rounded-lg p-3 text-sm text-gray-200 font-mono resize-none focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder={`Pega el contenido aquí... Ej:\n06/07/202603/07/2026COMPRA NORMAL60719474QQQ$57.278,67$-229.114,68$2.840,45\n02/07/202602/07/2026RECIBO DE COBRO608600$1.250.000,00$1.250.814,54...`}
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
                Analizar Movimientos
              </button>
            </div>
          </div>

          {(flujos.length > 0 || operaciones.length > 0) && (
            <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
              
              {/* Flujos */}
              {flujos.length > 0 && (
                <div className="border border-gray-800 rounded-lg overflow-hidden bg-gray-900/50">
                  <div className="bg-gray-800/50 px-4 py-3 border-b border-gray-800">
                    <h3 className="text-sm font-medium text-white">Flujo de Caja (Ingresos/Retiros)</h3>
                  </div>
                  <table className="w-full text-left text-sm">
                    <thead className="text-gray-400 bg-gray-800/20">
                      <tr>
                        <th className="p-3 font-medium">Fecha</th>
                        <th className="p-3 font-medium">Concepto</th>
                        <th className="p-3 font-medium text-right">Monto (ARS)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {flujos.map((f, i) => (
                        <tr key={i}>
                          <td className="p-3 text-gray-300">{f.fecha}</td>
                          <td className="p-3 text-white">{f.concepto}</td>
                          <td className="p-3 text-right font-medium text-emerald-400">
                            + ${f.monto.toLocaleString('es-AR')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Operaciones */}
              {operaciones.length > 0 && (
                <div className="border border-gray-800 rounded-lg overflow-hidden bg-gray-900/50">
                  <div className="bg-gray-800/50 px-4 py-3 border-b border-gray-800 flex justify-between items-center">
                    <h3 className="text-sm font-medium text-white">Operaciones con Activos</h3>
                    <button
                      onClick={fetchDolarMEP}
                      disabled={isFetchingUSD}
                      className="text-xs bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 px-3 py-1.5 rounded-full flex items-center gap-1 transition-colors"
                    >
                      <DollarSign size={14} />
                      {isFetchingUSD ? 'Obteniendo MEP...' : 'Convertir a USD (Cotización MEP histórica)'}
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="text-gray-400 bg-gray-800/20">
                        <tr>
                          <th className="p-3 font-medium">Fecha</th>
                          <th className="p-3 font-medium">Tipo</th>
                          <th className="p-3 font-medium">Activo</th>
                          <th className="p-3 font-medium text-right">Cantidad</th>
                          <th className="p-3 font-medium text-right">Precio Un. (ARS)</th>
                          <th className="p-3 font-medium text-right">Total (ARS)</th>
                          <th className="p-3 font-medium text-right text-emerald-400">Precio Un. (USD)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800">
                        {operaciones.map((op, i) => (
                          <tr key={i}>
                            <td className="p-3 text-gray-300">{op.fecha}</td>
                            <td className="p-3">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${op.tipo === 'COMPRA' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                {op.tipo}
                              </span>
                            </td>
                            <td className="p-3 text-white font-medium">{op.ticker}</td>
                            <td className="p-3 text-right">{op.cantidad}</td>
                            <td className="p-3 text-right text-gray-300">${op.precioUnitarioArs.toLocaleString('es-AR')}</td>
                            <td className="p-3 text-right text-gray-300">${op.totalArs.toLocaleString('es-AR')}</td>
                            <td className="p-3 text-right text-emerald-400 font-medium">
                              {op.precioUSD ? `$${op.precioUSD.toFixed(2)}` : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>
          )}

        </div>

        {/* Footer */}
        {(flujos.length > 0 || operaciones.length > 0) && (
          <div className="p-6 border-t border-gray-800 flex justify-end gap-3 bg-gray-900/80">
            <button 
              onClick={() => { setFlujos([]); setOperaciones([]); setRawText(''); }}
              className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium rounded-lg transition-colors"
            >
              Limpiar
            </button>
            <button 
              onClick={handleConfirm}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              <Check size={18} /> Cargar a mi Cartera
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
