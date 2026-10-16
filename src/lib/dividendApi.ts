import { DividendApiEvent, DividendApiHistory } from '../types';
import { fetchWithProxy } from './api';

interface YahooDividendEvent {
  amount?: unknown;
  date?: unknown;
}

const MANAGED_FUND_TICKERS = new Set(['COMIAUS']);
const MANAGED_FUND_NAME_PATTERN = /\b(fondo|fondos|fci|money\s*market|multimercado|cuotaparte|renta\s+(fija|variable)|clase\s+[a-z])\b/i;

export function isManagedFund(ticker: string, name = '') {
  const normalizedTicker = ticker.trim().toUpperCase().replace(/\.BA$/, '');
  return MANAGED_FUND_TICKERS.has(normalizedTicker) || MANAGED_FUND_NAME_PATTERN.test(name);
}

function dateFromUnixSeconds(value: number) {
  return new Date(value * 1000).toISOString().slice(0, 10);
}

export function parseYahooDividendEvents(payload: unknown): DividendApiEvent[] {
  if (!payload || typeof payload !== 'object') return [];
  const chart = (payload as { chart?: unknown }).chart;
  if (!chart || typeof chart !== 'object') return [];
  const result = (chart as { result?: unknown }).result;
  if (!Array.isArray(result) || !result[0] || typeof result[0] !== 'object') return [];
  const events = (result[0] as { events?: unknown }).events;
  if (!events || typeof events !== 'object') return [];
  const dividends = (events as { dividends?: unknown }).dividends;
  if (!dividends || typeof dividends !== 'object') return [];

  return Object.values(dividends as Record<string, YahooDividendEvent>)
    .flatMap(event => {
      const amount = Number(event?.amount);
      const date = Number(event?.date);
      if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(date) || date <= 0) return [];
      return [{ fecha: dateFromUnixSeconds(date), monto_por_accion_usd: amount }];
    })
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export async function fetchDividendHistory(ticker: string): Promise<DividendApiHistory> {
  const normalizedTicker = ticker.trim().toUpperCase().replace(/\.BA$/, '');
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(normalizedTicker)}?range=5y&interval=1mo&events=div`;
  const response = await fetchWithProxy(url);
  if (!response) throw new Error(`No se pudo consultar dividendos para ${normalizedTicker}`);

  const payload = await response.json();
  const chart = payload?.chart;
  const hasInstrument = Array.isArray(chart?.result) && chart.result.length > 0;

  return {
    ticker: normalizedTicker,
    fuente: 'YAHOO_FINANCE',
    estado: hasInstrument ? 'DISPONIBLE' : 'NO_DISPONIBLE',
    actualizado_en: new Date().toISOString(),
    eventos: hasInstrument ? parseYahooDividendEvents(payload) : []
  };
}
