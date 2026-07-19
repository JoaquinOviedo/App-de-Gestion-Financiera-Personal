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

export interface Presupuesto {
  ingreso_mensual: number;
  categorias: CategoriaGasto[];
  asignacion_inversiones: number;
}

export interface FondoEmergencia {
  saldo_actual: number;
  meta_meses: number;
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
}

export interface AppState {
  version: string;
  presupuesto: Presupuesto;
  fondo_emergencia: FondoEmergencia;
  inversiones: Inversiones;
  historial_patrimonio: RegistroHistorial[];
}

export interface AppStore extends AppState {
  setIngresoMensual: (ingreso: number) => void;
  setAsignacionInversiones: (monto: number) => void;
  addCategoria: (categoria: CategoriaGasto) => void;
  updateCategoria: (id: string, nombre: string) => void;
  removeCategoria: (id: string) => void;
  addSubgasto: (catId: string, subgasto: SubGasto) => void;
  updateSubgasto: (catId: string, subId: string, data: Partial<SubGasto>) => void;
  removeSubgasto: (catId: string, subId: string) => void;
  setFondoEmergencia: (saldo: number, metaMeses: number) => void;
  addOperacion: (op: Operacion) => void;
  removeOperacion: (id: string) => void;
  addHistorial: (registro: Omit<RegistroHistorial, 'id'>) => void;
  removeHistorial: (id: string) => void;
  checkAndCreateSnapshot: (currentInversionesValue: number) => void;
  importData: (data: AppState) => void;
  importarHistorialAmCharts: (registros: RegistroHistorial[], reemplazarPrevios: boolean) => void;
  importarOperacionesBroker: (operaciones: Operacion[], ingresos: number) => void;
}
