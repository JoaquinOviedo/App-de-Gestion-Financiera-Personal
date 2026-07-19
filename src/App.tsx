import React, { useEffect, useState } from 'react';
import { useStore } from './store/useStore';
import { LayoutDashboard, History, LineChart, Wallet, Download, Upload, FileText, BarChart } from 'lucide-react';
import BudgetTab from './features/budget/BudgetTab';
import HistoryTab from './features/history/HistoryTab';
import PortfolioTab from './features/portfolio/PortfolioTab';
import InvestmentsTab from './features/investments/InvestmentsTab';
import AmChartsImporter from './components/AmChartsImporter';
import BrokerImporter from './components/BrokerImporter';

function App() {
  const [activeTab, setActiveTab] = useState('budget');
  const [showAmChartsImporter, setShowAmChartsImporter] = useState(false);
  const [showBrokerImporter, setShowBrokerImporter] = useState(false);
  
  const checkAndCreateSnapshot = useStore(state => state.checkAndCreateSnapshot);
  const importData = useStore(state => state.importData);
  const inversiones = useStore(state => state.inversiones);
  const estadoCompleto = useStore(state => state);

  // WebSocket heartbeat and sync logic
  useEffect(() => {
    let ws: WebSocket;
    let pingInterval: ReturnType<typeof setInterval>;

    const connect = () => {
      ws = new WebSocket('ws://localhost:3001');
      
      ws.onopen = () => {
        pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'PING' }));
          }
        }, 1000);
      };
      
      ws.onclose = () => {
        clearInterval(pingInterval);
        setTimeout(connect, 1000);
      };
    };

    connect();

    return () => {
      clearInterval(pingInterval);
      if (ws) ws.close();
    };
  }, []);

  // Auto-save local state to server.js whenever estadoCompleto changes
  useEffect(() => {
    // Evitar guardar estado inicial vacío
    if (!estadoCompleto.presupuesto || estadoCompleto.presupuesto.ingreso_mensual === 0) return;
    
    try {
      const ws = new WebSocket('ws://localhost:3001');
      ws.onopen = () => {
        ws.send(JSON.stringify({
          type: 'SAVE_DATA',
          payload: {
            version: estadoCompleto.version,
            presupuesto: estadoCompleto.presupuesto,
            fondo_emergencia: estadoCompleto.fondo_emergencia,
            inversiones: estadoCompleto.inversiones,
            historial_patrimonio: estadoCompleto.historial_patrimonio
          }
        }));
        // Cerrar conexión después de enviar
        setTimeout(() => ws.close(), 100);
      };
    } catch (e) {
      console.error('Error al sincronizar con el backend local:', e);
    }
  }, [estadoCompleto]);

  useEffect(() => {
    const currentInversionesValue = inversiones.operaciones.reduce((acc, op) => {
      return acc + (op.cantidad * op.precio_operacion);
    }, 0);
    checkAndCreateSnapshot(currentInversionesValue);
  }, [checkAndCreateSnapshot, inversiones.operaciones]);

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
      } catch (err) {
        alert('Error al leer el archivo JSON.');
      }
    };
    reader.readAsText(file);
  };

  const tabs = [
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
              FintechLocal
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
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 text-sm font-medium border border-emerald-500/20">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Mercado Online
            </div>

            <div className="h-6 w-px bg-slate-800 mx-1"></div>

            <button
              onClick={() => setShowBrokerImporter(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md text-slate-300 hover:text-white hover:bg-slate-800 transition-colors text-sm font-medium"
            >
              <FileText size={16} />
              <span className="hidden sm:inline">Pegar Bróker</span>
            </button>
            <button
              onClick={() => setShowAmChartsImporter(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md text-slate-300 hover:text-white hover:bg-slate-800 transition-colors text-sm font-medium"
            >
              <BarChart size={16} />
              <span className="hidden sm:inline">amCharts</span>
            </button>

            <div className="h-6 w-px bg-slate-800 mx-1"></div>

            <label className="cursor-pointer flex items-center gap-2 px-3 py-1.5 rounded-md text-slate-300 hover:text-white hover:bg-slate-800 transition-colors text-sm font-medium">
              <Upload size={16} />
              <span className="hidden sm:inline">Importar JSON</span>
              <input type="file" accept=".json" className="hidden" onChange={handleImport} />
            </label>
            <button 
              onClick={handleExport}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white transition-colors text-sm font-medium shadow-lg shadow-indigo-500/20"
            >
              <Download size={16} />
              <span className="hidden sm:inline">Exportar JSON</span>
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <ActiveComponent />
      </main>

      {showAmChartsImporter && <AmChartsImporter onClose={() => setShowAmChartsImporter(false)} />}
      {showBrokerImporter && <BrokerImporter onClose={() => setShowBrokerImporter(false)} />}
    </div>
  );
}

export default App;
