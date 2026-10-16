import { describe, expect, it } from 'vitest';
import type { RegistroHistorial } from '../types';
import { mergeAmChartsHistory, sortHistoryForChart } from './amChartsHistory';

const automatic: RegistroHistorial = {
  id: 'auto', fecha: '2026-08-08', origen: 'AUTO_SNAPSHOT',
  valor_inversiones: 15_000, valor_emergencia: 300, total: 15_350,
  valor_vacaciones: 50,
  valores_normalizados_usd: true,
};

const incoming: RegistroHistorial = {
  id: 'imported', fecha: '2026-08-06', origen: 'HISTORICO_AMCHARTS',
  valor_inversiones: 14_000, valor_emergencia: 0, total: 14_000,
  balance_usd: 14_000,
};

describe('importación amCharts', () => {
  it('conserva el hito automático y utiliza su fondo en la misma semana', () => {
    const result = mergeAmChartsHistory([automatic], [incoming], true);
    expect(result).toHaveLength(2);
    expect(result.find(item => item.id === 'auto')).toEqual(automatic);
    expect(result.find(item => item.id === 'imported')).toMatchObject({
      valor_emergencia: 300, valor_vacaciones: 50, total: 14_350, valores_normalizados_usd: true,
    });
  });

  it('reemplaza sólo amCharts y también evita duplicados al añadir', () => {
    const previous = { ...incoming, id: 'previous', valor_emergencia: 300, total: 14_300, valores_normalizados_usd: true };
    for (const replace of [false, true]) {
      const result = mergeAmChartsHistory([automatic, previous], [incoming], replace);
      expect(result.map(item => item.id)).toEqual(['imported', 'auto']);
      expect(result[0].valor_emergencia).toBe(300);
    }
  });

  it('no atribuye el fondo actual a períodos sin ningún registro cercano', () => {
    const older = { ...incoming, fecha: '2024-05-04' };
    const result = mergeAmChartsHistory([automatic], [older], false);
    expect(result[0]).toMatchObject({ valor_emergencia: 0, total: 14_000 });
  });

  it('prioriza el hito automático si el gráfico recibe dos registros de la misma fecha', () => {
    const sameDate = { ...incoming, fecha: automatic.fecha };
    expect(sortHistoryForChart([automatic, sameDate]).map(record => record.id))
      .toEqual(['imported', 'auto']);
  });
});
