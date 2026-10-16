import type { Presupuesto } from '../types';

const EXPENSE_COLORS = [
  '#ef4444', '#fb7185', '#dc2626', '#f43f5e', '#f87171', '#e11d48',
  '#b91c1c', '#fda4af', '#be123c', '#fca5a5', '#9f1239', '#991b1b',
];

export function getBudgetExpenseItems(budget: Presupuesto) {
  return budget.categorias.flatMap(category => category.subgastos.map(expense => ({
    id: expense.id,
    categoryId: category.id,
    categoryName: category.nombre,
    name: expense.nombre,
    value: expense.costo_unitario * expense.frecuencia,
  }))).map((item, index) => ({ ...item, color: EXPENSE_COLORS[index % EXPENSE_COLORS.length] }));
}

const nonNegative = (value: number | undefined) =>
  Number.isFinite(value) ? Math.max(0, value ?? 0) : 0;

export function normalizeBudget(saved: Partial<Presupuesto> | undefined): Presupuesto {
  const categories = Array.isArray(saved?.categorias) ? saved.categorias : [];
  const hasEmergencyAllocation = Number.isFinite(saved?.asignacion_emergencia);
  // La categoría genérica creada por el editor anterior representaba un aporte,
  // no un gasto. Migramos sólo esa forma inequívoca y sólo una vez.
  const legacyCategory = !hasEmergencyAllocation
    ? categories.find(category =>
        category.nombre.trim().toLocaleLowerCase('es-AR') === 'emergencia'
        && category.subgastos.length === 1
        && category.subgastos[0].nombre.trim().toLocaleLowerCase('es-AR') === 'nuevo gasto'
        && category.subgastos[0].frecuencia === 1
        && category.subgastos[0].costo_unitario > 0
      )
    : undefined;

  return {
    ...saved,
    ingreso_mensual: nonNegative(saved?.ingreso_mensual),
    categorias: legacyCategory ? categories.filter(category => category.id !== legacyCategory.id) : categories,
    asignacion_inversiones: nonNegative(saved?.asignacion_inversiones),
    asignacion_emergencia: legacyCategory
      ? legacyCategory.subgastos[0].costo_unitario
      : nonNegative(saved?.asignacion_emergencia),
    asignacion_vacaciones: nonNegative(saved?.asignacion_vacaciones),
    moneda: saved?.moneda === 'USD' ? 'USD' : 'ARS',
  };
}

export function calculateBudgetTotals(budget: Presupuesto) {
  const gastos = budget.categorias.reduce((total, category) =>
    total + category.subgastos.reduce((subtotal, item) =>
      subtotal + item.costo_unitario * item.frecuencia, 0), 0);
  const inversiones = budget.asignacion_inversiones;
  const emergencia = budget.asignacion_emergencia;
  const vacaciones = budget.asignacion_vacaciones;

  return {
    gastos,
    inversiones,
    emergencia,
    vacaciones,
    libre: budget.ingreso_mensual - gastos - inversiones - emergencia - vacaciones,
  };
}

export function budgetIncomeShare(amount: number, monthlyIncome: number): number | null {
  if (!Number.isFinite(amount) || !Number.isFinite(monthlyIncome) || monthlyIncome <= 0) return null;
  return amount / monthlyIncome * 100;
}
