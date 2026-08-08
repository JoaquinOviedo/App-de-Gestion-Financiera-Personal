import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchAssetPrice, fetchCedearPriceARS } from './api';
import { consolidatePositions, resolveTickerPrice, selectLastKnownPrice } from './portfolioValuationCore';
import { Operacion } from '../types';

vi.mock('./api', () => ({
  fetchAssetPrice: vi.fn(),
  fetchCedearPriceARS: vi.fn(),
}));

const mockedAssetPrice = vi.mocked(fetchAssetPrice);
const mockedCedearPrice = vi.mocked(fetchCedearPriceARS);

beforeEach(() => {
  vi.clearAllMocks();
  mockedCedearPrice.mockResolvedValue(null);
  mockedAssetPrice.mockResolvedValue(null);
});

describe('resolveTickerPrice', () => {
  it('prioriza el precio BYMA convertido con CCL', async () => {
    mockedCedearPrice.mockResolvedValue(13_000);
    const result = await resolveTickerPrice('SPY', 1_300, 60, 12.5);
    expect(result).toBe(10);
    expect(mockedAssetPrice).not.toHaveBeenCalled();
  });

  it('usa el subyacente dividido por el ratio como segundo origen', async () => {
    mockedAssetPrice.mockResolvedValue({ ticker: 'SPY', price: 600, name: 'SPY', currency: 'USD' });
    await expect(resolveTickerPrice('SPY', 1_300, 60, 12.5)).resolves.toBe(10);
  });

  it('conserva el último precio conocido cuando no existe cotización pública', async () => {
    await expect(resolveTickerPrice('COMIAUS', 1_300, 1, 1.5502)).resolves.toBe(1.5502);
  });

  it('marca el activo como no resuelto si no hay ningún precio', async () => {
    await expect(resolveTickerPrice('SINPRECIO', 1_300, 1, undefined)).resolves.toBeNull();
  });
});

describe('consolidatePositions', () => {
  it('mantiene costo promedio al descontar ventas y usa el precio actual', () => {
    const base = { nombre: 'SPY', icono_url: '', fecha: '2026-01-01', ticker: 'SPY' };
    const operaciones: Operacion[] = [
      { ...base, id: '1', tipo: 'COMPRA', cantidad: 10, precio_operacion: 8 },
      { ...base, id: '2', tipo: 'COMPRA', cantidad: 10, precio_operacion: 12 },
      { ...base, id: '3', tipo: 'VENTA', cantidad: 5, precio_operacion: 15 },
    ];

    expect(consolidatePositions(operaciones, { SPY: 14 })).toEqual([expect.objectContaining({
      cantidad: 15,
      costoTotal: 150,
      precioActualUSD: 14,
      valorActualUSD: 210,
    })]);
  });
});

describe('selectLastKnownPrice', () => {
  const base = { nombre: 'COMIAUS', icono_url: '', fecha: '2026-01-01', ticker: 'COMIAUS' };

  it('usa el precio registrado para una operación heredada sin precio actual', () => {
    const operaciones: Operacion[] = [
      { ...base, id: '1', tipo: 'COMPRA', cantidad: 810.61, precio_operacion: 1.4041 },
    ];
    expect(selectLastKnownPrice(operaciones)).toBe(1.4041);
  });

  it('prioriza el último precio importado sobre cache y precio de operación', () => {
    const operaciones: Operacion[] = [
      { ...base, id: '1', tipo: 'COMPRA', cantidad: 810.61, precio_operacion: 1.4041, precio_actual_usd: 1.5502 },
    ];
    expect(selectLastKnownPrice(operaciones, 1.5)).toBe(1.5502);
  });
});
