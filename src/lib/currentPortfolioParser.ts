import { getCedearRatio } from './cedears';

export interface ParsedHolding {
  ticker: string;
  nombre: string;
  cantidad: number;
  precioPromedioUSD: number;
  precioActualUSD: number;
  totalUSD: number;
  ratio: number;
}

const LOCALIZED_NUMBER = '[-+]?(?:\\d{1,3}(?:\\.\\d{3})*|\\d+)(?:,\\d+)?';
const NUMERIC_ROW = new RegExp(
  `^\\s*(${LOCALIZED_NUMBER})\\s+USD\\s*(${LOCALIZED_NUMBER})\\s+(?:-|${LOCALIZED_NUMBER}%)\\s+USD\\s*${LOCALIZED_NUMBER}\\s+USD\\s*(${LOCALIZED_NUMBER})\\s+(?:-|${LOCALIZED_NUMBER}%)\\s+USD\\s*${LOCALIZED_NUMBER}\\s+USD\\s*(${LOCALIZED_NUMBER})\\s*$`,
  'i'
);

export const parseUSDNumber = (value: string) => {
  if (!value) return 0;
  const normalized = value
    .replace(/USD/gi, '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(/,/g, '.')
    .replace(/%/g, '');
  return Number.parseFloat(normalized) || 0;
};

function cleanText(value: string) {
  return value
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/&nbsp;|&#x20;/gi, ' ')
    .replace(/\*\*/g, '')
    .trim();
}

function isTicker(value: string) {
  return /^[A-Z0-9.]{2,10}$/i.test(value.trim());
}

function isIgnoredLine(value: string) {
  const line = cleanText(value).replace(/\s+/g, ' ');
  return (
    !line ||
    /^mis inversiones/i.test(line) ||
    /^producto/i.test(line) ||
    /^total var/i.test(line) ||
    /^(cedears|fondos|bonos|acciones)\s+usd/i.test(line)
  );
}

function holdingFromColumns(
  descriptor: string,
  columns: string[],
  customRatios: Record<string, number>,
  fallbackTicker = ''
): ParsedHolding | null {
  if (columns.length < 8) return null;
  const descriptorLines = cleanText(descriptor).split(/\r?\n/).map(item => item.trim()).filter(Boolean);
  const descriptorTicker = descriptorLines[0] && isTicker(descriptorLines[0]) ? descriptorLines[0].toUpperCase() : '';
  const ticker = fallbackTicker || descriptorTicker;
  if (!ticker) return null;

  const nombre = descriptorTicker
    ? descriptorLines.slice(1).join(' ') || ticker
    : descriptorLines.join(' ') || ticker;
  const cantidad = parseUSDNumber(columns[0]);
  const precioActualUSD = parseUSDNumber(columns[1]);
  const precioPromedioUSD = parseUSDNumber(columns[4]);
  const totalUSD = parseUSDNumber(columns[7]);
  if (cantidad <= 0 || precioActualUSD <= 0 || precioPromedioUSD <= 0) return null;

  return {
    ticker,
    nombre,
    cantidad,
    precioPromedioUSD,
    precioActualUSD,
    totalUSD: totalUSD || cantidad * precioActualUSD,
    ratio: getCedearRatio(ticker, customRatios)
  };
}

function parseMarkdownRow(line: string, customRatios: Record<string, number>) {
  if (!line.includes('|') || /^\s*\|?\s*[-:]+/.test(line)) return null;
  const cells = line.split('|').map(cell => cell.trim()).filter(Boolean);
  if (cells.length < 9 || /producto.*cantidad.*ultimo precio/i.test(cleanText(cells[0]))) return null;
  return holdingFromColumns(cells[0], cells.slice(1, 9), customRatios);
}

export function parseCurrentPortfolio(
  text: string,
  customRatios: Record<string, number> = {}
): ParsedHolding[] {
  const parsed: ParsedHolding[] = [];
  const markdownRows = text.split(/\r?\n/);
  markdownRows.forEach(line => {
    const holding = parseMarkdownRow(line, customRatios);
    if (holding) parsed.push(holding);
  });
  if (parsed.length > 0) return parsed;

  const lines = cleanText(text).split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  let pendingTicker = '';
  let pendingName = '';

  for (const line of lines) {
    if (isIgnoredLine(line)) continue;

    if (isTicker(line)) {
      pendingTicker = line.toUpperCase();
      pendingName = '';
      continue;
    }

    const numericMatch = line.match(NUMERIC_ROW);
    if (numericMatch && pendingTicker) {
      const cantidad = parseUSDNumber(numericMatch[1]);
      const precioActualUSD = parseUSDNumber(numericMatch[2]);
      const precioPromedioUSD = parseUSDNumber(numericMatch[3]);
      const totalUSD = parseUSDNumber(numericMatch[4]);
      if (cantidad > 0 && precioActualUSD > 0 && precioPromedioUSD > 0) {
        parsed.push({
          ticker: pendingTicker,
          nombre: pendingName || pendingTicker,
          cantidad,
          precioPromedioUSD,
          precioActualUSD,
          totalUSD: totalUSD || cantidad * precioActualUSD,
          ratio: getCedearRatio(pendingTicker, customRatios)
        });
      }
      pendingTicker = '';
      pendingName = '';
      continue;
    }

    const columns = line.split(/\t+|\s{2,}/).map(part => part.trim()).filter(Boolean);
    if (columns.length >= 9) {
      const holding = holdingFromColumns(columns[0], columns.slice(1, 9), customRatios, pendingTicker);
      if (holding) parsed.push(holding);
      pendingTicker = '';
      pendingName = '';
      continue;
    }

    if (pendingTicker && !/^(cedears|fondos|bonos|acciones)\b/i.test(line)) {
      pendingName = pendingName ? `${pendingName} ${line}` : line;
    }
  }

  return parsed;
}
