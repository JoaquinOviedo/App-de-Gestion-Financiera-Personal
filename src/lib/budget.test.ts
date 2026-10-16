import { describe, expect, it } from 'vitest';
import { budgetIncomeShare, calculateBudgetTotals, getBudgetExpenseItems, normalizeBudget } from './budget';

describe('aporte mensual de emergencia', () => {
  const legacyBudget = {
    ingreso_mensual: 2_000,
    asignacion_inversiones: 550,
    categorias: [
      { id: 'gastos', nombre: 'Gastos', subgastos: [{ id: 'alquiler', nombre: 'Alquiler', costo_unitario: 500, frecuencia: 1 }] },
      { id: 'emergencia', nombre: 'Emergencia', subgastos: [{ id: 'nuevo', nombre: 'Nuevo Gasto', costo_unitario: 200, frecuencia: 1 }] },
    ],
  };

  it('traslada el aporte genérico desde gastos sin cambiar el disponible', () => {
    const normalized = normalizeBudget(legacyBudget);
    expect(normalized.asignacion_emergencia).toBe(200);
    expect(normalized.categorias.map(category => category.nombre)).toEqual(['Gastos']);
    expect(calculateBudgetTotals(normalized)).toEqual({
      gastos: 500,
      inversiones: 550,
      emergencia: 200,
      vacaciones: 0,
      libre: 750,
    });
    expect(normalizeBudget(normalized)).toEqual(normalized);
  });

  it('conserva una categoría de gastos reales aunque se llame Emergencia', () => {
    const budget = normalizeBudget({
      ...legacyBudget,
      categorias: [
        legacyBudget.categorias[0],
        { id: 'urgencias', nombre: 'Emergencia', subgastos: [{ id: 'salud', nombre: 'Atención médica', costo_unitario: 200, frecuencia: 1 }] },
      ],
    });
    expect(budget.asignacion_emergencia).toBe(0);
    expect(budget.categorias).toHaveLength(2);
  });

  it('respeta una asignación ya cargada y evita migrarla dos veces', () => {
    const budget = normalizeBudget({ ...legacyBudget, asignacion_emergencia: 100 });
    expect(budget.asignacion_emergencia).toBe(100);
    expect(budget.categorias).toHaveLength(2);
  });

  it('separa vacaciones de gastos y descuenta el aporte del disponible', () => {
    const budget = normalizeBudget({ ...legacyBudget, asignacion_emergencia: 200, asignacion_vacaciones: 150 });
    expect(calculateBudgetTotals(budget)).toEqual({
      gastos: 700, inversiones: 550, emergencia: 200, vacaciones: 150, libre: 400,
    });
  });

  it('asigna a cada ítem un color compartido con el gráfico y el resumen', () => {
    const budget = normalizeBudget({
      ...legacyBudget,
      categorias: [{
        ...legacyBudget.categorias[0],
        subgastos: [
          legacyBudget.categorias[0].subgastos[0],
          { id: 'comida', nombre: 'Comida', costo_unitario: 100, frecuencia: 2 },
        ],
      }],
    });
    const items = getBudgetExpenseItems(budget);
    expect(items[0]).toMatchObject({ id: 'alquiler', categoryName: 'Gastos', name: 'Alquiler', value: 500 });
    expect(items[0].color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(getBudgetExpenseItems(budget)[0].color).toBe(items[0].color);
    expect(items[1]).toMatchObject({ name: 'Comida', value: 200 });
    expect(items[1].color).not.toBe(items[0].color);
    for (const { color } of items) {
      const [red, green, blue] = [1, 3, 5].map(offset => parseInt(color.slice(offset, offset + 2), 16));
      expect(red).toBeGreaterThan(green);
      expect(red).toBeGreaterThan(blue);
    }
  });

  it('calcula la proporción del ingreso sin dividir por cero', () => {
    expect(budgetIncomeShare(250, 1_000)).toBe(25);
    expect(budgetIncomeShare(-100, 1_000)).toBe(-10);
    expect(budgetIncomeShare(1_200, 1_000)).toBe(120);
    expect(budgetIncomeShare(250, 0)).toBeNull();
  });
});
