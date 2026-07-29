import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AppStore, AppState } from '../types';

const initialState: AppState = {
  version: "1.0",
  presupuesto: {
    ingreso_mensual: 0,
    categorias: [],
    asignacion_inversiones: 0,
    moneda: 'ARS'
  },
  fondo_emergencia: {
    saldo_actual: 0,
    meta_meses: 6,
    moneda: 'ARS'
  },
  inversiones: {
    operaciones: []
  },
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

      setFondoEmergencia: (saldo, metaMeses, moneda) =>
        set((state) => ({ fondo_emergencia: { saldo_actual: saldo, meta_meses: metaMeses, moneda: moneda || state.fondo_emergencia.moneda || 'ARS' } })),

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

      checkAndCreateSnapshot: (currentInversionesValue) => {
        const state = get();
        const historial = state.historial_patrimonio;
        
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
          const valorEmergencia = state.fondo_emergencia.saldo_actual;
          get().addHistorial({
            fecha: now.toISOString().split('T')[0],
            valor_inversiones: currentInversionesValue,
            valor_emergencia: valorEmergencia,
            total: currentInversionesValue + valorEmergencia,
            origen: 'AUTO_SNAPSHOT',
            nota: 'Snapshot Automático Semanal'
          });
        }
      },

      importData: (data) => set(() => data),

      importarHistorialAmCharts: (registros, reemplazarPrevios) => set((state) => {
        let nuevoHistorial = [...state.historial_patrimonio];
        
        if (reemplazarPrevios) {
          nuevoHistorial = nuevoHistorial.filter(r => r.origen !== 'HISTORICO_AMCHARTS');
        }
        
        nuevoHistorial.push(...registros);
        nuevoHistorial.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
        
        return { historial_patrimonio: nuevoHistorial };
      }),

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
    }
  )
);
