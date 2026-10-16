import type { AppState } from '../types';
import { normalizeBudget } from './budget';
import { normalizeEmergencyFund } from './emergencyFund';
import { normalizeVacationFund } from './vacationFund';

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const validCategory = (category: unknown) => isObject(category)
  && typeof category.id === 'string'
  && typeof category.nombre === 'string'
  && Array.isArray(category.subgastos)
  && category.subgastos.every((expense: unknown) => isObject(expense)
    && typeof expense.id === 'string'
    && typeof expense.nombre === 'string'
    && Number.isFinite(expense.costo_unitario)
    && Number.isFinite(expense.frecuencia));

const validOperation = (operation: unknown) => isObject(operation)
  && typeof operation.id === 'string'
  && typeof operation.ticker === 'string'
  && (operation.tipo === 'COMPRA' || operation.tipo === 'VENTA')
  && Number.isFinite(operation.cantidad)
  && Number.isFinite(operation.precio_operacion);

const validHistory = (record: unknown) => isObject(record)
  && typeof record.id === 'string'
  && typeof record.fecha === 'string'
  && typeof record.origen === 'string'
  && Number.isFinite(record.valor_inversiones)
  && Number.isFinite(record.valor_emergencia)
  && Number.isFinite(record.total);

export function createDatabaseBackup(state: AppState): AppState {
  return {
    version: state.version,
    presupuesto: state.presupuesto,
    fondo_emergencia: normalizeEmergencyFund(state.fondo_emergencia),
    fondo_vacaciones: normalizeVacationFund(state.fondo_vacaciones),
    inversiones: state.inversiones,
    movimientos_portafolio: state.movimientos_portafolio || [],
    dividendos_api: state.dividendos_api || {},
    historial_patrimonio: state.historial_patrimonio,
    cedear_ratios: state.cedear_ratios || {},
  };
}

export function parseDatabaseBackup(value: unknown): AppState {
  if (!isObject(value) || typeof value.version !== 'string'
    || !isObject(value.presupuesto) || !Array.isArray(value.presupuesto.categorias)
    || !value.presupuesto.categorias.every(validCategory)
    || !isObject(value.fondo_emergencia)
    || (value.fondo_vacaciones !== undefined && (!isObject(value.fondo_vacaciones)
      || !Number.isFinite(value.fondo_vacaciones.saldo_ars)
      || !Number.isFinite(value.fondo_vacaciones.saldo_usd)
      || (value.fondo_vacaciones.objetivo_usd !== undefined && !Number.isFinite(value.fondo_vacaciones.objetivo_usd))))
    || !isObject(value.inversiones) || !Array.isArray(value.inversiones.operaciones)
    || !value.inversiones.operaciones.every(validOperation)
    || !Array.isArray(value.historial_patrimonio)
    || !value.historial_patrimonio.every(validHistory)) {
    throw new Error('El archivo no contiene una base de datos completa y válida.');
  }

  return {
    version: value.version,
    presupuesto: normalizeBudget(value.presupuesto),
    fondo_emergencia: normalizeEmergencyFund(value.fondo_emergencia),
    fondo_vacaciones: normalizeVacationFund(isObject(value.fondo_vacaciones) ? value.fondo_vacaciones : undefined),
    inversiones: value.inversiones as unknown as AppState['inversiones'],
    movimientos_portafolio: Array.isArray(value.movimientos_portafolio)
      ? value.movimientos_portafolio as AppState['movimientos_portafolio'] : [],
    dividendos_api: isObject(value.dividendos_api)
      ? value.dividendos_api as AppState['dividendos_api'] : {},
    historial_patrimonio: value.historial_patrimonio as AppState['historial_patrimonio'],
    cedear_ratios: isObject(value.cedear_ratios)
      ? value.cedear_ratios as AppState['cedear_ratios'] : {},
  };
}
