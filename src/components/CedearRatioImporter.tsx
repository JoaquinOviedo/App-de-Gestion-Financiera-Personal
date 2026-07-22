import React, { useState, useRef } from 'react';
import { Upload, X, Check, FileSpreadsheet, RefreshCw, CheckCircle } from 'lucide-react';
import { useStore } from '../store/useStore';
import { parseRatioString } from '../lib/cedears';

interface ParsedRatioRow {
  ticker: string;
  empresa: string;
  ratioStr: string;
  ratioVal: number;
}

interface Props {
  onClose: () => void;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim().replace(/^"|"$/g, ''));
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim().replace(/^"|"$/g, ''));
  return result;
}

export default function CedearRatioImporter({ onClose }: Props) {
  const [rawText, setRawText] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedRatioRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { setCedearRatios } = useStore();

  const processCSVText = (text: string) => {
    setIsProcessing(true);
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const rows: ParsedRatioRow[] = [];

    lines.forEach(line => {
      if (/^ticker,/i.test(line)) return; // Header

      const cols = parseCSVLine(line);
      if (cols.length >= 3) {
        const ticker = cols[0].toUpperCase();
        const empresa = cols[1];
        const ratioStr = cols[2];

        if (ticker && ratioStr) {
          const ratioVal = parseRatioString(ratioStr);
          rows.push({
            ticker,
            empresa,
            ratioStr,
            ratioVal
          });
        }
      }
    });

    setParsedRows(rows);
    setIsProcessing(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setRawText(text);
      processCSVText(text);
    };
    reader.readAsText(file);
  };

  const handleConfirm = () => {
    const ratiosMap: Record<string, number> = {};
    parsedRows.forEach(row => {
      ratiosMap[row.ticker] = row.ratioVal;
    });

    setCedearRatios(ratiosMap);
    setSavedSuccess(true);
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-800">
          <div>
            <h2 className="text-xl font-semibold text-white">Importador de Ratios de CEDEARs (CSV)</h2>
            <p className="text-gray-400 text-sm mt-1">Carga o pega tu CSV de equivalencias y ratios para personalizar el cálculo de conversión.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6">
          
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                <FileSpreadsheet size={16} /> Contenido CSV de Ratios
              </label>

              <input 
                type="file" 
                accept=".csv,.txt" 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleFileUpload}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-xs bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
              >
                <Upload size={14} /> Subir CSV
              </button>
            </div>

            <textarea
              className="w-full h-32 bg-gray-800/50 border border-gray-700 rounded-lg p-3 text-sm text-gray-200 font-mono resize-none focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder={`Ticker,Empresa,Ratio,...\nAAPL,"APPLE INC.",20:1\nSPY,"SPDR S&P 500",20:1\nABEV,"AMBEV S.A.",1:3...`}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
            />

            <div className="flex justify-end">
              <button
                onClick={() => processCSVText(rawText)}
                disabled={isProcessing || rawText.trim().length === 0}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshCw size={16} className={isProcessing ? 'animate-spin' : ''} /> 
                Analizar Ratios CSV
              </button>
            </div>
          </div>

          {parsedRows.length > 0 && (
            <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Total de Ratios Parseados: <strong className="text-white">{parsedRows.length}</strong></span>
              </div>

              <div className="border border-gray-800 rounded-lg overflow-hidden bg-gray-900/50">
                <div className="overflow-x-auto max-h-60">
                  <table className="w-full text-left text-sm">
                    <thead className="text-gray-400 bg-gray-800/50 sticky top-0">
                      <tr>
                        <th className="p-3 font-medium">Ticker</th>
                        <th className="p-3 font-medium">Empresa</th>
                        <th className="p-3 font-medium text-center">Ratio CSV</th>
                        <th className="p-3 font-medium text-right">Factor de Conversión</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {parsedRows.map((r, idx) => (
                        <tr key={idx} className="hover:bg-gray-800/30">
                          <td className="p-3 font-bold text-white">{r.ticker}</td>
                          <td className="p-3 text-gray-300 truncate max-w-xs">{r.empresa}</td>
                          <td className="p-3 text-center">
                            <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded text-xs border border-blue-500/20 font-mono">
                              {r.ratioStr}
                            </span>
                          </td>
                          <td className="p-3 text-right font-mono text-emerald-400">
                            {r.ratioVal.toFixed(4)}
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
        {parsedRows.length > 0 && (
          <div className="p-6 border-t border-gray-800 flex justify-between items-center bg-gray-900/80">
            {savedSuccess ? (
              <span className="text-emerald-400 font-medium flex items-center gap-2">
                <CheckCircle size={18} /> ¡Ratios guardados exitosamente!
              </span>
            ) : <div></div>}

            <div className="flex gap-3">
              <button 
                onClick={() => { setParsedRows([]); setRawText(''); }}
                className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium rounded-lg transition-colors"
              >
                Limpiar
              </button>
              <button 
                onClick={handleConfirm}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                <Check size={18} /> Guardar y Aplicar Ratios
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
