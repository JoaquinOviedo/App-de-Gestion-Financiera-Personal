export interface SubGasto {
  id: string;
  nombre: string;
  costo_unitario: number;
  frecuencia: number;
}

export interface CategoriaGasto {
  id: string;
  nombre: string;
  subgastos: SubGasto[];
}

export type Moneda = 'ARS' | 'USD';

export interface Presupuesto {
  ingreso_mensual: number;
  categorias: CategoriaGasto[];
  asignacion_inversiones: number;
  moneda?: Moneda;
}

export interface FondoEmergencia {
  saldo_actual: number;
  meta_meses: number;
  moneda?: Moneda;
}

export type TipoOperacion = 'COMPRA' | 'VENTA';

export interface Operacion {
  id: string;
  tipo: TipoOperacion;
  ticker: string;
  nombre: string;
  icono_url: string;
  cantidad: number;
  precio_operacion: number; // in USD
  precio_actual_usd?: number;
  fecha: string;
  precio_unitario_ars?: number;
  total_ars?: number;
  origen?: string;
}

export interface Inversiones {
  operaciones: Operacion[];
}

export type OrigenHistorial = 'MANUAL' | 'AUTO_SNAPSHOT' | 'HISTORICO_AMCHARTS' | 'IMPORTADOR_BROKER';

export interface RegistroHistorial {
  id: string;
  fecha: string;
  valor_inversiones: number;
  valor_emergencia: number;
  total: number;
  origen: OrigenHistorial;
  nota?: string;
  balance_usd?: number;
  movimiento?: number;
  cotizacion_ccl?: number;
  cotizacion_mep?: number;
  fecha_cotizacion?: string;
  valores_normalizados_usd?: boolean;
}

export interface SnapshotValuation {
  valor_inversiones_usd: number;
  valor_emergencia_usd: number;
  cotizacion_mep: number;
  fecha_cotizacion: string;
}

export interface AppState {
  version: string;
  presupuesto: Presupuesto;
  fondo_emergencia: FondoEmergencia;
  inversiones: Inversiones;
  historial_patrimonio: RegistroHistorial[];
  cedear_ratios?: Record<string, number>;
}

export interface AppStore extends AppState {
  setIngresoMensual: (ingreso: number) => void;
  setAsignacionInversiones: (monto: number) => void;
  setPresupuestoMoneda: (moneda: Moneda) => void;
  addCategoria: (categoria: CategoriaGasto) => void;
  updateCategoria: (id: string, nombre: string) => void;
  removeCategoria: (id: string) => void;
  addSubgasto: (catId: string, subgasto: SubGasto) => void;
  updateSubgasto: (catId: string, subId: string, data: Partial<SubGasto>) => void;
  removeSubgasto: (catId: string, subId: string) => void;
  setFondoEmergencia: (saldo: number, metaMeses: number, moneda?: Moneda) => void;
  addOperacion: (op: Operacion) => void;
  removeOperacion: (id: string) => void;
  addHistorial: (registro: Omit<RegistroHistorial, 'id'>) => void;
  removeHistorial: (id: string) => void;
  checkAndCreateSnapshot: (valuation: SnapshotValuation) => void;
  importData: (data: AppState) => void;
  importarHistorialAmCharts: (registros: RegistroHistorial[], reemplazarPrevios: boolean) => void;
  importarOperacionesBroker: (operaciones: Operacion[], ingresos: number) => void;
  reemplazarPortafolioActual: (operaciones: Operacion[]) => void;
  updateOperacion: (id: string, data: Partial<Operacion>) => void;
  setCedearRatios: (ratios: Record<string, number>) => void;
}
