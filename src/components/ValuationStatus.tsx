import { AlertTriangle, RefreshCw } from 'lucide-react';
import { PortfolioValuation } from '../lib/portfolioValuation';

export default function ValuationStatus({ valuation }: { valuation: PortfolioValuation }) {
  if (valuation.status === 'ready') return null;

  if (valuation.status === 'loading') {
    return (
      <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-6 text-center text-blue-200">
        <RefreshCw className="mx-auto mb-3 animate-spin" size={24} />
        Actualizando dólar bolsa/MEP y precios del portafolio…
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 text-center text-amber-100">
      <AlertTriangle className="mx-auto mb-3" size={24} />
      <p>{valuation.message}</p>
      <p className="mt-1 text-xs text-amber-200/70">No se mostraron totales ni se creó un hito con datos incompletos.</p>
      <button
        type="button"
        onClick={valuation.retry}
        className="mt-4 rounded-xl bg-amber-500 px-4 py-2 font-semibold text-slate-950 hover:bg-amber-400"
      >
        Reintentar
      </button>
    </div>
  );
}
