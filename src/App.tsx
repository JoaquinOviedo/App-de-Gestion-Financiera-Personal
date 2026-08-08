import React, { useEffect, useState } from 'react';
import { useStore } from './store/useStore';
import { LayoutDashboard, History, LineChart, Wallet, Settings } from 'lucide-react';
import BudgetTab from './features/budget/BudgetTab';
import HistoryTab from './features/history/HistoryTab';
import PortfolioTab from './features/portfolio/PortfolioTab';
import InvestmentsTab from './features/investments/InvestmentsTab';
import AmChartsImporter from './components/AmChartsImporter';
import BrokerImporter from './components/BrokerImporter';
import CurrentPortfolioImporter from './components/CurrentPortfolioImporter';
import CedearRatioImporter from './components/CedearRatioImporter';
import AdminModal from './components/AdminModal';
import { usePortfolioValuation } from './lib/portfolioValuation';

const TAB_IDS = ['budget', 'history', 'portfolio', 'investments'] as const;
type AppTab = typeof TAB_IDS[number];
const ACTIVE_TAB_STORAGE_KEY = 'fintech_active_tab';

function getInitialTab(): AppTab {
  const savedTab = localStorage.getItem(ACTIVE_TAB_STORAGE_KEY);
  return TAB_IDS.includes(savedTab as AppTab) ? savedTab as AppTab : 'budget';
}

function App() {
  const [activeTab, setActiveTab] = useState<AppTab>(getInitialTab);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showAmChartsImporter, setShowAmChartsImporter] = useState(false);
  const [showBrokerImporter, setShowBrokerImporter] = useState(false);
  const [showCurrentPortfolioImporter, setShowCurrentPortfolioImporter] = useState(false);
  const [showCedearRatioImporter, setShowCedearRatioImporter] = useState(false);
  
  const checkAndCreateSnapshot = useStore(state => state.checkAndCreateSnapshot);
  const importData = useStore(state => state.importData);
  const estadoCompleto = useStore(state => state);
  const valuation = usePortfolioValuation();

  // WebSocket heartbeat and sync logic
  useEffect(() => {
    let ws: WebSocket | null = null;
    let pingInterval: ReturnType<typeof setInterval>;
    let reconnectTimeout: ReturnType<typeof setTimeout>;
    let isDisposed = false;

    const connect = () => {
      if (isDisposed) return;
      try {
        ws = new WebSocket('ws://localhost:3001');
        
        ws.onopen = () => {
          pingInterval = setInterval(() => {
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'PING' }));
            }
          }, 10000);
        };

        ws.onerror = () => {
          // Ignorar silenciosamente errores de conexión cuando el backend opcional no esté corriendo
        };
        
        ws.onclose = () => {
          clearInterval(pingInterval);
          if (!isDisposed) {
            reconnectTimeout = setTimeout(connect, 5000);
          }
        };
      } catch {
        if (!isDisposed) {
          reconnectTimeout = setTimeout(connect, 5000);
        }
      }
    };

    connect();

    return () => {
      isDisposed = true;
      clearInterval(pingInterval);
      clearTimeout(reconnectTimeout);
      if (ws) {
        ws.onclose = null; // evitar re-trigger al desmontar
        ws.close();
      }
    };
  }, []);

  // Auto-save local state to server.js whenever estadoCompleto changes
  useEffect(() => {
    // Evitar guardar estado inicial vacío
    if (!estadoCompleto.presupuesto || estadoCompleto.presupuesto.ingreso_mensual === 0) return;
    
    try {
      const ws = new WebSocket('ws://localhost:3001');
      ws.onerror = () => {
        // Ignorar si el servidor backend opcional no responde
      };
      ws.onopen = () => {
        ws.send(JSON.stringify({
          type: 'SAVE_DATA',
          payload: {
            version: estadoCompleto.version,
            presupuesto: estadoCompleto.presupuesto,
            fondo_emergencia: estadoCompleto.fondo_emergencia,
            inversiones: estadoCompleto.inversiones,
            historial_patrimonio: estadoCompleto.historial_patrimonio,
            cedear_ratios: estadoCompleto.cedear_ratios
          }
        }));
        setTimeout(() => ws.close(), 100);
      };
    } catch {
      // Ignorar fallo de conexión
    }
  }, [estadoCompleto]);

  useEffect(() => {
    localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (valuation.status !== 'ready') return;
    checkAndCreateSnapshot({
      valor_inversiones_usd: valuation.totalInversionesUSD,
      valor_emergencia_usd: valuation.valorEmergenciaUSD,
      cotizacion_mep: valuation.cotizacionMEP,
      fecha_cotizacion: valuation.lastUpdate.toISOString(),
    });
  }, [checkAndCreateSnapshot, valuation]);

  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(estadoCompleto, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href",     dataStr);
    downloadAnchorNode.setAttribute("download", "finanzas_personales.json");
    document.body.appendChild(downloadAnchorNode); 
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        if (json.version) {
          importData(json);
          alert('Datos importados correctamente.');
        } else {
          alert('Formato de archivo inválido.');
        }
      } catch {
        alert('Error al leer el archivo JSON.');
      }
    };
    reader.readAsText(file);
  };

  const tabs: Array<{ id: AppTab; label: string; icon: typeof LayoutDashboard; component: React.ComponentType }> = [
    { id: 'budget', label: 'Presupuesto', icon: LayoutDashboard, component: BudgetTab },
    { id: 'history', label: 'Historial', icon: History, component: HistoryTab },
    { id: 'portfolio', label: 'Evolución', icon: LineChart, component: PortfolioTab },
    { id: 'investments', label: 'Inversiones', icon: Wallet, component: InvestmentsTab },
  ];

  const ActiveComponent = tabs.find(t => t.id === activeTab)?.component || BudgetTab;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans selection:bg-indigo-500/30">
      <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center font-bold text-lg">
              F
            </div>
            <span className="font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
              App de gestion financiera
            </span>
          </div>
          
          <nav className="hidden md:flex items-center gap-1">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all duration-200 ${
                    isActive 
                      ? 'bg-indigo-500/10 text-indigo-400 font-medium' 
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <Icon size={18} className={isActive ? "text-indigo-400" : ""} />
                  {tab.label}
                </button>
              )
            })}
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAdminModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all text-sm font-medium shadow-lg shadow-indigo-500/20"
              title="Panel de Administración"
            >
              <Settings size={18} />
              <span>Administración</span>
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <ActiveComponent />
      </main>

      {showAdminModal && (
        <AdminModal
          onClose={() => setShowAdminModal(false)}
          onOpenAmCharts={() => setShowAmChartsImporter(true)}
          onOpenBroker={() => setShowBrokerImporter(true)}
          onOpenCurrentPortfolio={() => setShowCurrentPortfolioImporter(true)}
          onOpenCedearRatios={() => setShowCedearRatioImporter(true)}
          onExportJson={handleExport}
          onImportJson={handleImport}
        />
      )}

      {showAmChartsImporter && <AmChartsImporter onClose={() => setShowAmChartsImporter(false)} />}
      {showBrokerImporter && <BrokerImporter onClose={() => setShowBrokerImporter(false)} />}
      {showCurrentPortfolioImporter && <CurrentPortfolioImporter onClose={() => setShowCurrentPortfolioImporter(false)} />}
      {showCedearRatioImporter && <CedearRatioImporter onClose={() => setShowCedearRatioImporter(false)} />}
    </div>
  );
}

export default App;
