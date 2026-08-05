export const CEDEAR_RATIOS: Record<string, number> = {
  SPY: 60,
  QQQ: 20,
  GLD: 50,
  IBIT: 10,
  VIG: 39,
  AAPL: 20,
  KO: 5,
  NVDA: 24,
  MELI: 120,
  TSLA: 15,
  AMZN: 144,
  MSFT: 30,
  META: 24,
  GOOGL: 58,
  DIA: 20,
  EEM: 5,
  XLE: 2,
  ARKK: 10,
  WMT: 18,
  DIS: 12,
  BABA: 9,
  PBR: 1,
  VALE: 2,
  BMA: 1,
  GGAL: 1,
  YPF: 1,
  PAM: 1
};

export function parseRatioString(ratioStr: string): number {
  if (!ratioStr) return 1;
  const clean = ratioStr.trim();
  const parts = clean.split(':');
  if (parts.length === 2) {
    const num = parseFloat(parts[0]);
    const den = parseFloat(parts[1]);
    if (num > 0 && den > 0) {
      return num / den;
    }
  }
  const val = parseFloat(clean);
  return val > 0 ? val : 1;
}

export function getCedearRatio(ticker: string, customRatios?: Record<string, number>): number {
  const upper = ticker.toUpperCase().replace('.BA', '');
  if (customRatios && typeof customRatios[upper] === 'number') {
    return customRatios[upper];
  }
  return CEDEAR_RATIOS[upper] || 1;
}
