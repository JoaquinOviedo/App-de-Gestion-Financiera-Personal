import { useState, useEffect, useCallback } from 'react';

interface DolarMEPState {
  cotizacion: number;
  loading: boolean;
  error: string | null;
  lastUpdate: Date | null;
}

let cachedCotizacion: number | null = null;
let cachedAt: number | null = null;
let inFlightRequest: Promise<{ cotizacion: number; updatedAt: Date }> | null = null;
const CACHE_DURATION_MS = 10 * 60 * 1000;

export async function fetchDolarMEP(force = false): Promise<{ cotizacion: number; updatedAt: Date }> {
  if (!force && cachedCotizacion && cachedAt && (Date.now() - cachedAt < CACHE_DURATION_MS)) {
    return { cotizacion: cachedCotizacion, updatedAt: new Date(cachedAt) };
  }

  if (inFlightRequest) return inFlightRequest;

  inFlightRequest = (async () => {
    const res = await fetch('https://api.argentinadatos.com/v1/cotizaciones/dolares/bolsa');
    if (!res.ok) throw new Error(`La API de dólar bolsa respondió ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) throw new Error('Respuesta vacía de la API');

    const latest = data[data.length - 1];
    const rate = (Number(latest.compra) + Number(latest.venta)) / 2;
    if (!Number.isFinite(rate) || rate <= 0) throw new Error('Cotización MEP inválida');

    cachedCotizacion = rate;
    cachedAt = Date.now();
    return { cotizacion: rate, updatedAt: new Date(cachedAt) };
  })();

  try {
    return await inFlightRequest;
  } finally {
    inFlightRequest = null;
  }
}

export function useDolarMEP() {
  const [state, setState] = useState<DolarMEPState>({
    cotizacion: cachedCotizacion || 0,
    loading: !cachedCotizacion,
    error: null,
    lastUpdate: cachedAt ? new Date(cachedAt) : null,
  });

  const fetchCotizacion = useCallback(async (force = false) => {
    setState(previous => ({ ...previous, loading: true, error: null }));
    try {
      const result = await fetchDolarMEP(force);
      setState({ cotizacion: result.cotizacion, loading: false, error: null, lastUpdate: result.updatedAt });
    } catch (error) {
      console.error('Error fetching dólar MEP:', error);
      setState(previous => ({ ...previous, loading: false, error: 'No se pudo obtener la cotización MEP' }));
    }
  }, []);

  useEffect(() => { fetchCotizacion(); }, [fetchCotizacion]);

  const convertArsToUsd = useCallback((ars: number) => state.cotizacion > 0 ? ars / state.cotizacion : 0, [state.cotizacion]);
  const convertUsdToArs = useCallback((usd: number) => usd * state.cotizacion, [state.cotizacion]);

  return { ...state, refresh: () => fetchCotizacion(true), convertArsToUsd, convertUsdToArs };
}
