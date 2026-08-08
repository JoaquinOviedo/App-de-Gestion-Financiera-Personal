import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import { getCedearRatio } from './cedears';
import { fetchDolarMEP } from './useDolarMEP';
import { consolidatePositions, PortfolioPosition, resolveTickerPrice, selectLastKnownPrice } from './portfolioValuationCore';

interface ValuationLoading { status: 'loading'; retry: () => void }
interface ValuationError {
  status: 'error';
  message: string;
  unresolvedTickers: string[];
  retry: () => void;
}
export interface ValuationReady {
  status: 'ready';
  cotizacionMEP: number;
  lastUpdate: Date;
  prices: Record<string, number>;
  positions: PortfolioPosition[];
  totalInversionesUSD: number;
  valorEmergenciaUSD: number;
  totalPatrimonioUSD: number;
  retry: () => void;
}
export type PortfolioValuation = ValuationLoading | ValuationError | ValuationReady;

type MarketState =
  | { status: 'loading' }
  | { status: 'error'; message: string; unresolvedTickers: string[] }
  | { status: 'ready'; cotizacionMEP: number; lastUpdate: Date; prices: Record<string, number> };

const PortfolioValuationContext = createContext<PortfolioValuation | null>(null);
const PRICE_CACHE_STORAGE_KEY = 'fintech_last_known_prices_mep';

interface CachedPrice {
  price: number;
  updatedAt: string;
}

function loadPriceCache(): Record<string, CachedPrice> {
  try {
    const stored = localStorage.getItem(PRICE_CACHE_STORAGE_KEY);
    if (!stored) return {};
    const parsed = JSON.parse(stored) as Record<string, CachedPrice>;
    return Object.fromEntries(Object.entries(parsed).filter(([, item]) =>
      Number.isFinite(item?.price) && item.price > 0 && typeof item.updatedAt === 'string'
    ));
  } catch {
    return {};
  }
}

export function PortfolioValuationProvider({ children }: { children: ReactNode }) {
  const operaciones = useStore(state => state.inversiones.operaciones);
  const ratios = useStore(state => state.cedear_ratios);
  const fondo = useStore(state => state.fondo_emergencia);
  const [market, setMarket] = useState<MarketState>({ status: 'loading' });
  const [refreshKey, setRefreshKey] = useState(0);
  const requestId = useRef(0);
  const priceCache = useRef<Record<string, CachedPrice>>(loadPriceCache());
  const retry = useCallback(() => setRefreshKey(value => value + 1), []);

  useEffect(() => {
    const currentRequest = ++requestId.current;
    setMarket({ status: 'loading' });

    const update = async () => {
      try {
        const { cotizacion, updatedAt } = await fetchDolarMEP(true);
        const quantities = operaciones.reduce<Record<string, number>>((result, op) => {
          result[op.ticker] = (result[op.ticker] ?? 0) + (op.tipo === 'COMPRA' ? op.cantidad : -op.cantidad);
          return result;
        }, {});
        const activeTickers = Object.entries(quantities)
          .filter(([, quantity]) => quantity > 0)
          .map(([ticker]) => ticker);
        const entries = await Promise.all(activeTickers.map(async ticker => {
          const tickerOperations = operaciones.filter(op => op.ticker === ticker);
          const lastKnownPrice = selectLastKnownPrice(tickerOperations, priceCache.current[ticker]?.price);
          const price = await resolveTickerPrice(ticker, cotizacion, getCedearRatio(ticker, ratios), lastKnownPrice);
          return [ticker, price] as const;
        }));

        if (currentRequest !== requestId.current) return;
        const unresolvedTickers = entries.filter(([, price]) => !price).map(([ticker]) => ticker);
        if (unresolvedTickers.length > 0) {
          setMarket({
            status: 'error',
            message: `No se pudo obtener un precio actual para: ${unresolvedTickers.join(', ')}`,
            unresolvedTickers,
          });
          return;
        }

        const cacheUpdate = { ...priceCache.current };
        for (const [ticker, price] of entries) {
          if (price && price > 0) cacheUpdate[ticker] = { price, updatedAt: updatedAt.toISOString() };
        }
        priceCache.current = cacheUpdate;
        try {
          localStorage.setItem(PRICE_CACHE_STORAGE_KEY, JSON.stringify(cacheUpdate));
        } catch {
          // La valuación sigue disponible aunque el navegador no permita persistir el cache.
        }

        setMarket({
          status: 'ready',
          cotizacionMEP: cotizacion,
          lastUpdate: updatedAt,
          prices: Object.fromEntries(entries) as Record<string, number>,
        });
      } catch (error) {
        if (currentRequest !== requestId.current) return;
        console.error('Error actualizando la valuación del portafolio:', error);
        setMarket({
          status: 'error',
          message: 'No se pudo obtener la cotización del dólar bolsa/MEP. Revisa tu conexión y vuelve a intentar.',
          unresolvedTickers: [],
        });
      }
    };

    update();
    return () => { requestId.current += 1; };
  }, [operaciones, ratios, refreshKey]);

  const value = useMemo<PortfolioValuation>(() => {
    if (market.status === 'loading') return { status: 'loading', retry };
    if (market.status === 'error') return { ...market, retry };

    const positions = consolidatePositions(operaciones, market.prices);
    const totalInversionesUSD = positions.reduce((total, position) => total + position.valorActualUSD, 0);
    const valorEmergenciaUSD = fondo.moneda === 'USD'
      ? fondo.saldo_actual
      : fondo.saldo_actual / market.cotizacionMEP;

    return {
      status: 'ready',
      cotizacionMEP: market.cotizacionMEP,
      lastUpdate: market.lastUpdate,
      prices: market.prices,
      positions,
      totalInversionesUSD,
      valorEmergenciaUSD,
      totalPatrimonioUSD: totalInversionesUSD + valorEmergenciaUSD,
      retry,
    };
  }, [fondo, market, operaciones, retry]);

  return <PortfolioValuationContext.Provider value={value}>{children}</PortfolioValuationContext.Provider>;
}

// Provider y hook comparten este contexto por diseño.
// eslint-disable-next-line react-refresh/only-export-components
export function usePortfolioValuation(): PortfolioValuation {
  const value = useContext(PortfolioValuationContext);
  if (!value) throw new Error('usePortfolioValuation debe usarse dentro de PortfolioValuationProvider');
  return value;
}
