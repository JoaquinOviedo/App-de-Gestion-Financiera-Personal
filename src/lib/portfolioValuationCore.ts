import { Operacion } from '../types';
import { fetchAssetPrice, fetchCedearPriceARS } from './api';

export interface PortfolioPosition {
  ticker: string;
  name: string;
  cantidad: number;
  costoTotal: number;
  precioActualUSD: number;
  valorActualUSD: number;
}

export function selectLastKnownPrice(operaciones: Operacion[], cachedPrice?: number): number | undefined {
  const importedPrice = [...operaciones].reverse()
    .find(operation => operation.precio_actual_usd && operation.precio_actual_usd > 0)?.precio_actual_usd;
  const recordedPrice = [...operaciones].reverse()
    .find(operation => operation.precio_operacion > 0)?.precio_operacion;
  return importedPrice ?? cachedPrice ?? recordedPrice;
}

export function consolidatePositions(operaciones: Operacion[], prices: Record<string, number>): PortfolioPosition[] {
  const consolidated: Record<string, { ticker: string; name: string; cantidad: number; costoTotal: number }> = {};
  for (const op of operaciones) {
    consolidated[op.ticker] ??= { ticker: op.ticker, name: op.nombre, cantidad: 0, costoTotal: 0 };
    const position = consolidated[op.ticker];
    if (op.tipo === 'COMPRA') {
      position.cantidad += op.cantidad;
      position.costoTotal += op.cantidad * op.precio_operacion;
    } else {
      const averageCost = position.cantidad > 0 ? position.costoTotal / position.cantidad : 0;
      position.cantidad -= op.cantidad;
      position.costoTotal -= op.cantidad * averageCost;
    }
  }

  return Object.values(consolidated)
    .filter(position => position.cantidad > 0)
    .map(position => ({
      ...position,
      precioActualUSD: prices[position.ticker],
      valorActualUSD: position.cantidad * prices[position.ticker],
    }));
}

export async function resolveTickerPrice(
  ticker: string,
  mep: number,
  ratio: number,
  lastKnownPrice: number | undefined,
): Promise<number | null> {
  const arsPrice = await fetchCedearPriceARS(ticker);
  if (arsPrice && arsPrice > 0) return arsPrice / mep;

  const underlying = await fetchAssetPrice(ticker);
  if (underlying?.price && underlying.price > 0) return underlying.price / ratio;

  return lastKnownPrice && lastKnownPrice > 0 ? lastKnownPrice : null;
}
