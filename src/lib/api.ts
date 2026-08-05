export interface AssetPrice {
  ticker: string;
  price: number;
  name: string;
  currency: string;
}

// List of CORS proxy options to try in order
const CORS_PROXIES = [
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
];

async function fetchWithProxy(url: string): Promise<Response | null> {
  for (const proxyFn of CORS_PROXIES) {
    try {
      const proxyUrl = proxyFn(url);
      const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(8000) });
      if (res.ok) return res;
    } catch {
      // Try next proxy
    }
  }
  return null;
}

/**
 * Fetches the current market price for a given ticker.
 * First tries the Yahoo Finance v8 chart API.
 * Falls back to Yahoo Finance v6 quote API.
 */
export async function fetchAssetPrice(ticker: string): Promise<AssetPrice | null> {
  try {
    // Try Yahoo Finance v8 chart endpoint
    const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`;
    const res = await fetchWithProxy(chartUrl);
    
    if (res) {
      const data = await res.json();
      if (data.chart?.result?.[0]) {
        const meta = data.chart.result[0].meta;
        return {
          ticker: meta.symbol,
          price: meta.regularMarketPrice,
          name: meta.longName || meta.shortName || meta.symbol,
          currency: meta.currency
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching price for', ticker, error);
    return null;
  }
}

/**
 * Fetches the CEDEAR price in ARS from Buenos Aires (BYMA) via Yahoo Finance.
 * Appends ".BA" to the ticker to get the Argentine market listing.
 * Returns price in ARS.
 */
export async function fetchCedearPriceARS(ticker: string): Promise<number | null> {
  try {
    const baTicker = ticker.toUpperCase().endsWith('.BA') ? ticker : `${ticker}.BA`;
    const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(baTicker)}?interval=1d&range=1d`;
    const res = await fetchWithProxy(chartUrl);
    
    if (res) {
      const data = await res.json();
      if (data.chart?.result?.[0]) {
        const meta = data.chart.result[0].meta;
        if (meta.currency === 'ARS') {
          return meta.regularMarketPrice;
        }
      }
    }
    return null;
  } catch (error) {
    console.error('Error fetching CEDEAR .BA price for', ticker, error);
    return null;
  }
}
