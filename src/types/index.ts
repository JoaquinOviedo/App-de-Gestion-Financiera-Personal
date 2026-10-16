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
  asignacion_emergencia: number;
  asignacion_vacaciones: number;
  moneda?: Moneda;
}

export interface FondoEmergencia {
  saldo_ars: number;
  saldo_usd: number;
  meta_meses: number;
  incluir_usd_en_cobertura: boolean;
  // Campos anteriores, aceptados al importar o hidratar datos existentes.
  saldo_actual?: number;
  moneda?: Moneda;
  moneda_legacy?: Moneda;
}

export interface FondoVacaciones {
  saldo_ars: number;
  saldo_usd: number;
  objetivo_usd: number;
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

export type TipoMovimientoPortafolio = 'APORTE' | 'RETIRO' | 'DIVIDENDO';

export interface MovimientoPortafolio {
  id: string;
  fecha: string;
  tipo: TipoMovimientoPortafolio;
  monto_usd: number;
  ticker?: string;
  nota?: string;
}

export interface DividendApiEvent {
  fecha: string;
  monto_por_accion_usd: number;
}

export interface DividendApiHistory {
  ticker: string;
  fuente: 'YAHOO_FINANCE';
  estado: 'DISPONIBLE' | 'NO_DISPONIBLE';
  actualizado_en: string;
  eventos: DividendApiEvent[];
}

export type OrigenHistorial = 'MANUAL' | 'AUTO_SNAPSHOT' | 'HISTORICO_AMCHARTS' | 'IMPORTADOR_BROKER';

export interface RegistroHistorial {
  id: string;
  fecha: string;
  valor_inversiones: number;
  valor_emergencia: number;
  valor_vacaciones?: number;
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
  valor_vacaciones_usd: number;
  cotizacion_mep: number;
  fecha_cotizacion: string;
}

export interface AppState {
  version: string;
  presupuesto: Presupuesto;
  fondo_emergencia: FondoEmergencia;
  fondo_vacaciones: FondoVacaciones;
  inversiones: Inversiones;
  movimientos_portafolio: MovimientoPortafolio[];
  dividendos_api: Record<string, DividendApiHistory>;
  historial_patrimonio: RegistroHistorial[];
  cedear_ratios?: Record<string, number>;
}

export interface AppStore extends AppState {
  setIngresoMensual: (ingreso: number) => void;
  setAsignacionInversiones: (monto: number) => void;
  setAsignacionEmergencia: (monto: number) => void;
  setAsignacionVacaciones: (monto: number) => void;
  setPresupuestoMoneda: (moneda: Moneda) => void;
  addCategoria: (categoria: CategoriaGasto) => void;
  updateCategoria: (id: string, nombre: string) => void;
  removeCategoria: (id: string) => void;
  addSubgasto: (catId: string, subgasto: SubGasto) => void;
  updateSubgasto: (catId: string, subId: string, data: Partial<SubGasto>) => void;
  removeSubgasto: (catId: string, subId: string) => void;
  setFondoEmergencia: (saldos: { ARS: number; USD: number }, metaMeses: number) => void;
  setIncluirUsdEnCobertura: (incluir: boolean) => void;
  setFondoVacaciones: (saldos: { ARS: number; USD: number }) => void;
  setObjetivoVacaciones: (objetivoUSD: number) => void;
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
  addMovimientoPortafolio: (movimiento: Omit<MovimientoPortafolio, 'id'>) => void;
  removeMovimientoPortafolio: (id: string) => void;
  setDividendApiHistory: (history: DividendApiHistory) => void;
  setCedearRatios: (ratios: Record<string, number>) => void;
}
