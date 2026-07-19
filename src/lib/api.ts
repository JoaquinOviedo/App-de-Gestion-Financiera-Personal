export interface AssetPrice {
  ticker: string;
  price: number;
  name: string;
  currency: string;
}

export async function fetchAssetPrice(ticker: string): Promise<AssetPrice | null> {
  try {
    const proxyUrl = `https://corsproxy.io/?https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}`;
    const res = await fetch(proxyUrl);
    const data = await res.json();
    
    if (data.chart && data.chart.result && data.chart.result.length > 0) {
      const result = data.chart.result[0];
      const meta = result.meta;
      return {
        ticker: meta.symbol,
        price: meta.regularMarketPrice,
        name: meta.longName || meta.shortName || meta.symbol,
        currency: meta.currency
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching price for', ticker, error);
    return null;
  }
}
