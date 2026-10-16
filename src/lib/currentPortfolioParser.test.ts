import { describe, expect, it } from 'vitest';
import { parseCurrentPortfolio } from './currentPortfolioParser';

const plainBrokerText = `Producto Cantidad Ultimo Precio Var % Diaria Var $ Diaria PPC Gan-Per % Gan.-Per $ Total
Fondos USD 1.395,36

COMIAUS
CONSULTATIO MULTIMERCADO III - CLASE A
898,61  USD 1,5528  -  USD 0,00  USD 1,4186  9,46%  USD 120,57  USD 1.395,36

Cedears USD 15.402,61

GLD
Cedear Spdr Gold Shares
150,00  USD 8,53  -0,92%  USD -11,88  USD 7,82  9,15%  USD 107,31  USD 1.280,12

IBIT
Cedear Ishares Bitcoin Trust ETF
535,00  USD 4,75  -1,91%  USD -49,44  USD 4,97  -4,51%  USD -120,07  USD 2.540,65`;

const markdownBrokerText = `| Producto | | Cantidad | Ultimo Precio | Var % Diaria | Var $ Diaria | PPC | Gan-Per % | Gan.-Per $ | Total |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fondos | USD 1.395,36 | | | | | | | | |
| | COMIAUS<br>CONSULTATIO MULTIMERCADO III - CLASE A | 898,61 | USD 1,5528 | - | USD 0,00 | USD 1,4186 | 9,46% | USD 120,57 | USD 1.395,36 |
| Cedears | USD 15.402,61 | | | | | | | | |
| | GLD<br>Cedear Spdr Gold Shares | 150,00 | USD 8,53 | -0,92% | USD -11,88 | USD 7,82 | 9,15% | USD 107,31 | USD 1.280,12 |`;

describe('parseCurrentPortfolio', () => {
  it('respeta las columnas del texto copiado desde el broker', () => {
    const result = parseCurrentPortfolio(plainBrokerText);

    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({
      ticker: 'COMIAUS',
      nombre: 'CONSULTATIO MULTIMERCADO III - CLASE A',
      cantidad: 898.61,
      precioActualUSD: 1.5528,
      precioPromedioUSD: 1.4186,
      totalUSD: 1395.36
    });
    expect(result[1]).toMatchObject({
      ticker: 'GLD',
      cantidad: 150,
      precioActualUSD: 8.53,
      precioPromedioUSD: 7.82,
      totalUSD: 1280.12,
      ratio: 50
    });
    expect(result[2]).toMatchObject({
      ticker: 'IBIT',
      cantidad: 535,
      precioActualUSD: 4.75,
      precioPromedioUSD: 4.97,
      totalUSD: 2540.65,
      ratio: 10
    });
  });

  it('acepta la misma cartera convertida en tabla Markdown', () => {
    const result = parseCurrentPortfolio(markdownBrokerText);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      ticker: 'COMIAUS',
      nombre: 'CONSULTATIO MULTIMERCADO III - CLASE A',
      cantidad: 898.61,
      precioActualUSD: 1.5528,
      precioPromedioUSD: 1.4186
    });
    expect(result[1]).toMatchObject({
      ticker: 'GLD',
      nombre: 'Cedear Spdr Gold Shares',
      cantidad: 150,
      precioActualUSD: 8.53,
      precioPromedioUSD: 7.82
    });
  });
});
