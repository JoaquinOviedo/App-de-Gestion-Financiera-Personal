import { useState, useEffect, useCallback } from 'react';

interface DolarMEPState {
  cotizacion: number;
  loading: boolean;
  error: string | null;
  lastUpdate: Date | null;
}

let cachedCotizacion: number | null = null;
let cachedAt: number | null = null;
const CACHE_DURATION_MS = 10 * 60 * 1000; // 10 minutes

export function useDolarMEP() {
  const [state, setState] = useState<DolarMEPState>({
    cotizacion: cachedCotizacion || 0,
    loading: !cachedCotizacion,
    error: null,
    lastUpdate: cachedAt ? new Date(cachedAt) : null,
  });

  const fetchCotizacion = useCallback(async (force = false) => {
    // Use cache if still valid
    if (!force && cachedCotizacion && cachedAt && (Date.now() - cachedAt < CACHE_DURATION_MS)) {
      setState({
        cotizacion: cachedCotizacion,
        loading: false,
        error: null,
        lastUpdate: new Date(cachedAt),
      });
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const res = await fetch('https://api.argentinadatos.com/v1/cotizaciones/dolares/mep');
      const data = await res.json();

      if (Array.isArray(data) && data.length > 0) {
        // Get the latest entry (last element, sorted by date ascending)
        const latest = data[data.length - 1];
        const rate = (latest.compra + latest.venta) / 2;

        cachedCotizacion = rate;
        cachedAt = Date.now();

        setState({
          cotizacion: rate,
          loading: false,
          error: null,
          lastUpdate: new Date(),
        });
      } else {
        throw new Error('Respuesta vacía de la API');
      }
    } catch (err) {
      console.error('Error fetching dólar MEP:', err);
      setState(prev => ({
        ...prev,
        loading: false,
        error: 'No se pudo obtener la cotización MEP',
      }));
    }
  }, []);

  useEffect(() => {
    fetchCotizacion();
  }, [fetchCotizacion]);

  const convertArsToUsd = useCallback((ars: number): number => {
    if (!state.cotizacion || state.cotizacion === 0) return 0;
    return ars / state.cotizacion;
  }, [state.cotizacion]);

  const convertUsdToArs = useCallback((usd: number): number => {
    return usd * state.cotizacion;
  }, [state.cotizacion]);

  return {
    ...state,
    refresh: () => fetchCotizacion(true),
    convertArsToUsd,
    convertUsdToArs,
  };
}
