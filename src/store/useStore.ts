import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AppStore, AppState } from '../types';
import { normalizeEmergencyFund } from '../lib/emergencyFund';
import { normalizeBudget } from '../lib/budget';
import { mergeAmChartsHistory } from '../lib/amChartsHistory';
import { normalizeVacationFund } from '../lib/vacationFund';

const initialState: AppState = {
  version: "1.0",
  presupuesto: {
    ingreso_mensual: 0,
    categorias: [],
    asignacion_inversiones: 0,
    asignacion_emergencia: 0,
    asignacion_vacaciones: 0,
    moneda: 'ARS'
  },
  fondo_emergencia: {
    saldo_ars: 0,
    saldo_usd: 0,
    meta_meses: 6,
    incluir_usd_en_cobertura: false
  },
  fondo_vacaciones: {
    saldo_ars: 0,
    saldo_usd: 0,
    objetivo_usd: 0,
  },
  inversiones: {
    operaciones: []
  },
  movimientos_portafolio: [],
  dividendos_api: {},
  historial_patrimonio: []
};

export const useStore = create<AppStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      setIngresoMensual: (ingreso) => 
        set((state) => ({ presupuesto: { ...state.presupuesto, ingreso_mensual: ingreso } })),
        
      setAsignacionInversiones: (monto) =>
        set((state) => ({ presupuesto: { ...state.presupuesto, asignacion_inversiones: monto } })),

      setAsignacionEmergencia: (monto) =>
        set((state) => ({ presupuesto: { ...state.presupuesto, asignacion_emergencia: Number.isFinite(monto) ? Math.max(0, monto) : 0 } })),

      setAsignacionVacaciones: (monto) =>
        set((state) => ({ presupuesto: { ...state.presupuesto, asignacion_vacaciones: Number.isFinite(monto) ? Math.max(0, monto) : 0 } })),

      setPresupuestoMoneda: (moneda) =>
        set((state) => ({ presupuesto: { ...state.presupuesto, moneda } })),

      addCategoria: (categoria) =>
        set((state) => ({ presupuesto: { ...state.presupuesto, categorias: [...state.presupuesto.categorias, categoria] } })),
        
      updateCategoria: (id, nombre) =>
        set((state) => ({
          presupuesto: {
            ...state.presupuesto,
            categorias: state.presupuesto.categorias.map(c => c.id === id ? { ...c, nombre } : c)
          }
        })),

      removeCategoria: (id) =>
        set((state) => ({
          presupuesto: {
            ...state.presupuesto,
            categorias: state.presupuesto.categorias.filter(c => c.id !== id)
          }
        })),

      addSubgasto: (catId, subgasto) =>
        set((state) => ({
          presupuesto: {
            ...state.presupuesto,
            categorias: state.presupuesto.categorias.map(c => 
              c.id === catId ? { ...c, subgastos: [...c.subgastos, subgasto] } : c
            )
          }
        })),

      updateSubgasto: (catId, subId, data) =>
        set((state) => ({
          presupuesto: {
            ...state.presupuesto,
            categorias: state.presupuesto.categorias.map(c => 
              c.id === catId ? { 
                ...c, 
                subgastos: c.subgastos.map(s => s.id === subId ? { ...s, ...data } : s) 
              } : c
            )
          }
        })),

      removeSubgasto: (catId, subId) =>
        set((state) => ({
          presupuesto: {
            ...state.presupuesto,
            categorias: state.presupuesto.categorias.map(c => 
              c.id === catId ? { 
                ...c, 
                subgastos: c.subgastos.filter(s => s.id !== subId) 
              } : c
            )
          }
        })),

      setFondoEmergencia: (saldos, metaMeses) =>
        set((state) => ({ fondo_emergencia: normalizeEmergencyFund({
          moneda_legacy: state.fondo_emergencia.moneda_legacy,
          saldo_ars: saldos.ARS,
          saldo_usd: saldos.USD,
          meta_meses: metaMeses,
          incluir_usd_en_cobertura: state.fondo_emergencia.incluir_usd_en_cobertura,
        }) })),

      setIncluirUsdEnCobertura: (incluir) =>
        set((state) => ({ fondo_emergencia: normalizeEmergencyFund({
          ...state.fondo_emergencia,
          incluir_usd_en_cobertura: incluir,
        }) })),

      setFondoVacaciones: (saldos) =>
        set((state) => ({ fondo_vacaciones: normalizeVacationFund({
          ...state.fondo_vacaciones,
          saldo_ars: saldos.ARS,
          saldo_usd: saldos.USD,
        }) })),

      setObjetivoVacaciones: (objetivoUSD) =>
        set((state) => ({ fondo_vacaciones: normalizeVacationFund({
          ...state.fondo_vacaciones,
          objetivo_usd: objetivoUSD,
        }) })),

      addOperacion: (op) =>
        set((state) => ({
          inversiones: { ...state.inversiones, operaciones: [...state.inversiones.operaciones, op] }
        })),

      removeOperacion: (id) =>
        set((state) => ({
          inversiones: { ...state.inversiones, operaciones: state.inversiones.operaciones.filter(o => o.id !== id) }
        })),

      addHistorial: (registro) =>
        set((state) => ({
          historial_patrimonio: [...state.historial_patrimonio, { ...registro, id: crypto.randomUUID() }]
        })),

      removeHistorial: (id) =>
        set((state) => ({
          historial_patrimonio: state.historial_patrimonio.filter(h => h.id !== id)
        })),

      checkAndCreateSnapshot: (valuation) => {
        const state = get();
        const historial = state.historial_patrimonio;
        const hasAssets = state.inversiones.operaciones.length > 0
          || state.fondo_emergencia.saldo_ars > 0
          || state.fondo_emergencia.saldo_usd > 0
          || state.fondo_vacaciones.saldo_ars > 0
          || state.fondo_vacaciones.saldo_usd > 0
          || historial.some(record => record.total !== 0);
        if (!hasAssets) return;
        
        // Find last snapshot
        const snapshots = historial.filter(h => h.origen === 'AUTO_SNAPSHOT');
        snapshots.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
        
        const lastSnapshot = snapshots.length > 0 ? snapshots[0] : null;
        const now = new Date();
        
        let shouldCreate = false;
        
        if (!lastSnapshot) {
          shouldCreate = true;
        } else {
          const lastDate = new Date(lastSnapshot.fecha);
          const diffTime = Math.abs(now.getTime() - lastDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          if (diffDays >= 7) {
            shouldCreate = true;
          }
        }

        if (shouldCreate) {
          get().addHistorial({
            fecha: now.toISOString().split('T')[0],
            valor_inversiones: valuation.valor_inversiones_usd,
            valor_emergencia: valuation.valor_emergencia_usd,
            valor_vacaciones: valuation.valor_vacaciones_usd,
            total: valuation.valor_inversiones_usd + valuation.valor_emergencia_usd + valuation.valor_vacaciones_usd,
            origen: 'AUTO_SNAPSHOT',
            nota: 'Snapshot Automático Semanal',
            cotizacion_mep: valuation.cotizacion_mep,
            fecha_cotizacion: valuation.fecha_cotizacion,
            valores_normalizados_usd: true
          });
        }
      },

      importData: (data) => set(() => ({
        ...data,
        presupuesto: normalizeBudget(data.presupuesto),
        fondo_emergencia: normalizeEmergencyFund(data.fondo_emergencia),
        fondo_vacaciones: normalizeVacationFund(data.fondo_vacaciones),
        movimientos_portafolio: data.movimientos_portafolio || [],
        dividendos_api: data.dividendos_api || {}
      })),

      importarHistorialAmCharts: (registros, reemplazarPrevios) => set((state) => ({
        historial_patrimonio: mergeAmChartsHistory(state.historial_patrimonio, registros, reemplazarPrevios),
      })),

      importarOperacionesBroker: (operacionesNuevas, ingresosNuevos) => set((state) => {
        const nuevasOperaciones = [...state.inversiones.operaciones, ...operacionesNuevas];
        
        return {
          inversiones: {
            ...state.inversiones,
            operaciones: nuevasOperaciones
          },
          presupuesto: {
            ...state.presupuesto,
            asignacion_inversiones: state.presupuesto.asignacion_inversiones + ingresosNuevos
          }
        };
      }),

      reemplazarPortafolioActual: (operaciones) => set((state) => ({
        inversiones: {
          ...state.inversiones,
          operaciones
        }
      })),

      updateOperacion: (id, data) => set((state) => ({
        inversiones: {
          ...state.inversiones,
          operaciones: state.inversiones.operaciones.map(op => op.id === id ? { ...op, ...data } : op)
        }
      })),

      addMovimientoPortafolio: (movimiento) => set((state) => ({
        movimientos_portafolio: [
          ...(state.movimientos_portafolio || []),
          { ...movimiento, id: crypto.randomUUID() }
        ]
      })),

      removeMovimientoPortafolio: (id) => set((state) => ({
        movimientos_portafolio: (state.movimientos_portafolio || []).filter(movimiento => movimiento.id !== id)
      })),

      setDividendApiHistory: (history) => set((state) => ({
        dividendos_api: {
          ...(state.dividendos_api || {}),
          [history.ticker]: history
        }
      })),

      cedear_ratios: {},

      setCedearRatios: (ratios) => set((state) => ({
        cedear_ratios: {
          ...(state.cedear_ratios || {}),
          ...ratios
        }
      })),

    }),
    {
      name: 'finanzas_personales', // localStorage key
      merge: (persisted, current) => {
        const saved = persisted as Partial<AppState> | undefined;
        return {
          ...current,
          ...saved,
          presupuesto: normalizeBudget(saved?.presupuesto),
          fondo_emergencia: normalizeEmergencyFund(saved?.fondo_emergencia),
          fondo_vacaciones: normalizeVacationFund(saved?.fondo_vacaciones),
        } as AppStore;
      },
    }
  )
);
