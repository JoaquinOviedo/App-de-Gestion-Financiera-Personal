# Aplicación de Gestión Financiera Personal

Aplicación local para administrar presupuesto, fondo de emergencia, operaciones de inversión y evolución patrimonial. Está construida como una SPA con React, TypeScript, Vite, Zustand y Tailwind CSS.

## Funcionalidades

- Presupuesto mensual con categorías, subgastos y selección ARS/USD.
- Fondo de emergencia con objetivo expresado en meses de gastos.
- Registro, edición e importación de operaciones.
- Importadores para historial amCharts, movimientos del bróker, cartera actual y ratios CEDEAR.
- Portafolio consolidado con precio promedio, precio actual, P&L y equivalencia ARS.
- Evolución patrimonial y snapshots automáticos semanales.
- Persistencia de la última pestaña seleccionada.
- Exportación e importación manual de datos en JSON.

## Cómo se valúa el portafolio

La aplicación intenta reproducir la valuación en USD mostrada por Bull Market:

1. Obtiene la cotización del dólar bolsa/MEP desde ArgentinaDatos.
2. Consulta el precio del CEDEAR en BYMA mediante Yahoo Finance (`TICKER.BA`).
3. Convierte el precio ARS a USD usando MEP.
4. Si BYMA no responde, usa el subyacente estadounidense dividido por el ratio CEDEAR.
5. Si el activo no tiene cotización pública, usa el último precio importado o cacheado; para datos antiguos, utiliza el último precio registrado como respaldo.

El total actual, la pantalla de Evolución y los nuevos snapshots consumen una única valuación compartida. Mientras esa valuación se actualiza no se crea un hito con datos parciales.

## Persistencia y privacidad

- Zustand persiste el estado principal en `localStorage` bajo la clave `finanzas_personales`.
- Cuando `server.js` está activo, el frontend también mantiene un espejo en `finanzas_personales.json` mediante WebSocket.
- `finanzas_personales.json` está excluido de Git por `.gitignore`.
- La pestaña activa y el caché de precios MEP se guardan en claves separadas de `localStorage`.
- Los datos financieros completos permanecen en la máquina, pero los tickers consultados se envían a las APIs financieras y proxies configurados.

Actualmente el JSON es un respaldo local, no la fuente que hidrata automáticamente la interfaz al arrancar. Para restaurarlo se utiliza la importación manual desde Administración.

## Requisitos

- Node.js 18 o superior.
- npm.
- Git configurado si se utilizará la sincronización automática incluida en `server.js`.

## Instalación y ejecución

```bash
npm install
```

En Windows, iniciar en segundo plano con:

```text
run.bat
```

El lanzador inicia Vite en `http://localhost:5173`, espera hasta que responda y recién entonces abre el navegador. El WebSocket local utiliza `ws://localhost:3001`.

También se puede ejecutar manualmente:

```bash
node server.js
```

Para desarrollo sin el servidor auxiliar:

```bash
npm run dev
```

## Verificación

```bash
npm test
npm run lint
npm run build
```

- `npm test`: pruebas unitarias de consolidación y prioridades de precios.
- `npm run lint`: validación estática.
- `npm run build`: comprobación TypeScript y build de producción.

## Comportamiento del servidor local

`server.js` realiza actualmente estas tareas:

- Verifica actualizaciones del repositorio remoto antes de iniciar.
- Arranca Vite con puerto estricto.
- Espera una respuesta HTTP válida antes de abrir el navegador.
- Recibe copias del estado por WebSocket.
- Se apaga cuando deja de detectar una pestaña conectada.
- Intenta crear un commit y subir cambios al cerrar.

La sincronización Git automática forma parte del comportamiento actual. Antes de trabajar con cambios locales importantes conviene revisar [ARCHITECTURE.md](./ARCHITECTURE.md), donde se documentan sus riesgos y mejoras recomendadas.

## Documentación técnica

La arquitectura, invariantes financieras y guía para futuras modificaciones están en [ARCHITECTURE.md](./ARCHITECTURE.md).
