import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import { getCedearRatio } from './cedears';
import { fetchDividendHistory, isManagedFund } from './dividendApi';
import { calculateDividendAnalytics, DividendAnalytics } from './dividendAnalytics';
import { PortfolioPosition } from './portfolioValuationCore';

const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

type DividendState =
  | { status: 'loading' }
  | { status: 'ready'; unavailableTickers: string[]; staleTickers: string[]; lastUpdate: Date | null }
  | { status: 'error'; message: string };

export type PortfolioDividends = DividendState & {
  analytics: DividendAnalytics;
  retry: () => void;
};

function isFresh(updatedAt: string) {
  const timestamp = new Date(updatedAt).getTime();
  return Number.isFinite(timestamp) && Date.now() - timestamp < CACHE_MAX_AGE_MS;
}

export function usePortfolioDividends(positions: PortfolioPosition[]): PortfolioDividends {
  const histories = useStore(state => state.dividendos_api || {});
  const operaciones = useStore(state => state.inversiones.operaciones);
  const customRatios = useStore(state => state.cedear_ratios || {});
  const setHistory = useStore(state => state.setDividendApiHistory);
  const [state, setState] = useState<DividendState>({ status: 'loading' });
  const [refreshKey, setRefreshKey] = useState(0);
  const requestId = useRef(0);
  const handledRefreshKey = useRef(0);
  const tickerKey = useMemo(() => (
    [...new Set(positions
      .filter(position => !isManagedFund(position.ticker, position.name))
      .map(position => position.ticker.trim().toUpperCase().replace(/\.BA$/, '')))].sort().join('|')
  ), [positions]);
  const tickers = useMemo(() => tickerKey ? tickerKey.split('|') : [], [tickerKey]);
  const retry = useCallback(() => setRefreshKey(value => value + 1), []);

  useEffect(() => {
    const currentRequest = ++requestId.current;
    if (tickers.length === 0) {
      setState({ status: 'ready', unavailableTickers: [], staleTickers: [], lastUpdate: null });
      return;
    }

    const forceRefresh = refreshKey !== handledRefreshKey.current;
    handledRefreshKey.current = refreshKey;
    const missingOrStale = tickers.filter(ticker => forceRefresh || !histories[ticker] || !isFresh(histories[ticker].actualizado_en));
    if (missingOrStale.length === 0) {
      const cached = tickers.map(ticker => histories[ticker]);
      setState({
        status: 'ready',
        unavailableTickers: cached.filter(item => item.estado === 'NO_DISPONIBLE').map(item => item.ticker),
        staleTickers: [],
        lastUpdate: new Date(Math.min(...cached.map(item => new Date(item.actualizado_en).getTime())))
      });
      return;
    }

    setState({ status: 'loading' });
    Promise.allSettled(missingOrStale.map(fetchDividendHistory)).then(results => {
      if (currentRequest !== requestId.current) return;
      const nextHistories = { ...histories };
      const failedWithoutCache: string[] = [];
      const staleTickers: string[] = [];

      results.forEach((result, index) => {
        const ticker = missingOrStale[index];
        if (result.status === 'fulfilled') {
          nextHistories[ticker] = result.value;
          setHistory(result.value);
        } else if (histories[ticker]) {
          staleTickers.push(ticker);
        } else {
          failedWithoutCache.push(ticker);
        }
      });

      if (failedWithoutCache.length > 0) {
        setState({
          status: 'error',
          message: `No se pudo obtener el historial de dividendos para: ${failedWithoutCache.join(', ')}`
        });
        return;
      }

      const availableHistories = tickers.map(ticker => nextHistories[ticker]).filter(Boolean);
      setState({
        status: 'ready',
        unavailableTickers: availableHistories.filter(item => item.estado === 'NO_DISPONIBLE').map(item => item.ticker),
        staleTickers,
        lastUpdate: availableHistories.length > 0
          ? new Date(Math.min(...availableHistories.map(item => new Date(item.actualizado_en).getTime())))
          : null
      });
    });

    return () => { requestId.current += 1; };
  }, [histories, refreshKey, setHistory, tickers]);

  const ratios = useMemo(() => Object.fromEntries(
    tickers.map(ticker => [ticker, getCedearRatio(ticker, customRatios)])
  ), [customRatios, tickers]);
  const analytics = useMemo(
    () => calculateDividendAnalytics(histories, positions, ratios, new Date(), undefined, operaciones),
    [histories, operaciones, positions, ratios]
  );

  return { ...state, analytics, retry };
}
