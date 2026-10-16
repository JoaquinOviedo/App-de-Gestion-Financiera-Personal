import { describe, expect, it } from 'vitest';
import type { AppState } from '../types';
import { createDatabaseBackup, parseDatabaseBackup } from './databaseBackup';

const state: AppState = {
  version: '1.0',
  presupuesto: { ingreso_mensual: 1000, categorias: [], asignacion_inversiones: 100, asignacion_emergencia: 50, asignacion_vacaciones: 25, moneda: 'ARS' },
  fondo_emergencia: { saldo_ars: 1200, saldo_usd: 300, meta_meses: 6, incluir_usd_en_cobertura: false },
  fondo_vacaciones: { saldo_ars: 500, saldo_usd: 100, objetivo_usd: 2_000 },
  inversiones: { operaciones: [] },
  movimientos_portafolio: [],
  dividendos_api: {},
  historial_patrimonio: [],
  cedear_ratios: { SPY: 60 },
};

describe('respaldo de base de datos', () => {
  it('exporta y restaura todos los campos financieros y la preferencia de cobertura', () => {
    const backup = createDatabaseBackup(state);
    expect(parseDatabaseBackup(JSON.parse(JSON.stringify(backup)))).toEqual(backup);
  });

  it('migra un respaldo anterior sin los campos opcionales nuevos', () => {
    const legacy = {
      ...state,
      presupuesto: { ingreso_mensual: 1000, categorias: [], asignacion_inversiones: 100 },
      fondo_emergencia: { saldo_actual: 1200, moneda: 'USD', meta_meses: 6 },
      fondo_vacaciones: undefined,
      movimientos_portafolio: undefined,
      dividendos_api: undefined,
    };
    const restored = parseDatabaseBackup(legacy);
    expect(restored.fondo_emergencia).toMatchObject({ saldo_ars: 0, saldo_usd: 1200, incluir_usd_en_cobertura: false });
    expect(restored.fondo_vacaciones).toEqual({ saldo_ars: 0, saldo_usd: 0, objetivo_usd: 0 });
    expect(restored.presupuesto.asignacion_vacaciones).toBe(0);
    expect(restored.movimientos_portafolio).toEqual([]);
  });

  it('rechaza un archivo parcial sin sobrescribir el estado', () => {
    expect(() => parseDatabaseBackup({ version: '1.0', historial_patrimonio: [] })).toThrow('base de datos completa');
  });

  it('restaura un fondo anterior sin objetivo en dólares', () => {
    const restored = parseDatabaseBackup({ ...state, fondo_vacaciones: { saldo_ars: 500, saldo_usd: 100 } });
    expect(restored.fondo_vacaciones).toEqual({ saldo_ars: 500, saldo_usd: 100, objetivo_usd: 0 });
  });
});
