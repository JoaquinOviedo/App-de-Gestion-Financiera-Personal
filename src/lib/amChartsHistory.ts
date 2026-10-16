import type { RegistroHistorial } from '../types';

function isoWeek(dateString: string): string | null {
  const date = new Date(`${dateString.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const year = date.getUTCFullYear();
  const firstDay = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil((((date.getTime() - firstDay.getTime()) / 86400000) + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

const knownFundValues = (record: RegistroHistorial) =>
  record.valores_normalizados_usd === true
  && Number.isFinite(record.valor_emergencia)
  && record.valor_emergencia >= 0
  && (record.origen === 'AUTO_SNAPSHOT' || record.valor_emergencia > 0 || (record.valor_vacaciones ?? 0) > 0);

// The chart keeps the last record for each date, so automatic snapshots go last.
export function sortHistoryForChart(history: RegistroHistorial[]): RegistroHistorial[] {
  return [...history].sort((a, b) => a.fecha.localeCompare(b.fecha)
    || Number(a.origen === 'AUTO_SNAPSHOT') - Number(b.origen === 'AUTO_SNAPSHOT'));
}

export function mergeAmChartsHistory(
  existing: RegistroHistorial[],
  incoming: RegistroHistorial[],
  replacePrevious: boolean
): RegistroHistorial[] {
  const retained = replacePrevious
    ? existing.filter(record => record.origen !== 'HISTORICO_AMCHARTS')
    : [...existing];
  const references = existing.filter(knownFundValues);
  const imported = incoming.map(record => {
    const week = isoWeek(record.fecha);
    const sameWeek = references.filter(reference => week !== null && isoWeek(reference.fecha) === week);
    const reference = sameWeek.sort((a, b) => {
      const aPriority = a.origen === 'AUTO_SNAPSHOT' ? 1 : 0;
      const bPriority = b.origen === 'AUTO_SNAPSHOT' ? 1 : 0;
      if (aPriority !== bPriority) return bPriority - aPriority;
      const aDistance = Math.abs(Date.parse(a.fecha) - Date.parse(record.fecha));
      const bDistance = Math.abs(Date.parse(b.fecha) - Date.parse(record.fecha));
      return aDistance - bDistance;
    })[0];
    const emergencyUSD = reference?.valor_emergencia ?? 0;
    const vacationUSD = reference?.valor_vacaciones ?? 0;
    return {
      ...record,
      valor_emergencia: emergencyUSD,
      valor_vacaciones: vacationUSD,
      total: record.valor_inversiones + emergencyUSD + vacationUSD,
      valores_normalizados_usd: true,
    };
  });

  // Reimporting the same weeks must not duplicate them, even in add mode.
  const importedWeeks = new Set(imported.map(record => isoWeek(record.fecha)));
  const withoutRepeatedWeeks = retained.filter(record =>
    record.origen !== 'HISTORICO_AMCHARTS' || !importedWeeks.has(isoWeek(record.fecha))
  );
  return [...withoutRepeatedWeeks, ...imported]
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}
