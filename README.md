# Aplicación de Gestión Financiera Personal

Aplicación local para administrar presupuesto, fondos de emergencia y vacaciones, inversiones y evolución patrimonial. Está construida como una SPA con React, TypeScript, Vite, Zustand y Tailwind CSS.

## Funcionalidades

- Presupuesto mensual con categorías, subgastos y selección ARS/USD.
- Resumen Mensual con porcentajes del ingreso disponibles al pasar el cursor o enfocar los importes; también aparecen en el gráfico y en el desglose de gastos. Los subgastos usan tonos de la familia Gastos y forman un bloque continuo en el gráfico.
- Aporte mensual al fondo de emergencia separado de los gastos y de ahorro/inversiones.
- Aporte mensual a Vacaciones separado de los gastos, con saldo acumulado en ARS/USD y objetivo en USD en Inversiones.
- Fondo de emergencia con saldos independientes en ARS y USD y objetivo expresado en meses de gastos.
- Simulador de cobertura ante pérdida de ingresos y gastos imprevistos.
- Importación por pegado de la composición actual del portafolio.
- Importadores para historial amCharts, movimientos del bróker, cartera actual y ratios CEDEAR.
- Portafolio consolidado con precio promedio, precio actual, P&L y equivalencia ARS.
- Evolución patrimonial con filtros por período y una estimación mensual del ingreso anual TTM por dividendos, basada en el yield vigente y el capital histórico.
- Los dividendos se obtienen automáticamente por API; no hace falta registrarlos como movimientos.
- Historial de distribuciones por API, cacheado por ticker y ajustado por ratio CEDEAR.
- Yield, escudo y crecimiento interanual de dividendos calculados con la composición actual.
- Simulador de capital e ingresos por dividendos con inflación, crecimiento, revalorización, aportes y reinversión.
- Snapshots automáticos semanales.
- Historial de sólo lectura para snapshots automáticos e importaciones históricas.
- Persistencia de la última pestaña seleccionada.
- Exportación e importación manual de datos en JSON.

El respaldo JSON incluye presupuesto, saldos y preferencia del fondo de emergencia, saldos y objetivo del fondo de vacaciones, inversiones, movimientos, dividendos almacenados, historial y ratios. Al restaurar se valida que sea una base completa antes de reemplazar el estado; los respaldos anteriores se normalizan.

## Cómo se valúa el portafolio

La aplicación intenta reproducir la valuación en USD mostrada por Bull Market:

1. Obtiene la cotización del dólar bolsa/MEP desde ArgentinaDatos.
2. Consulta el precio del CEDEAR en BYMA mediante Yahoo Finance (`TICKER.BA`).
3. Convierte el precio ARS a USD usando MEP.
4. Si BYMA no responde, usa el subyacente estadounidense dividido por el ratio CEDEAR.
5. Si el activo no tiene cotización pública, usa el último precio importado o cacheado; para datos antiguos, utiliza el último precio registrado como respaldo.

El total actual, la pantalla de Evolución y los nuevos snapshots consumen una única valuación compartida. Mientras esa valuación se actualiza no se crea un hito con datos parciales.

El fondo de emergencia se valúa siempre en USD: `saldo USD + saldo ARS / MEP`. La meta y la cobertura también se muestran en USD. Para la cobertura y su simulador se puede elegir si contar los dólares; por defecto se reservan como último recurso. Esta elección no cambia el saldo total, el patrimonio ni los hitos, y se guarda junto con el fondo. Los saldos antiguos de una sola moneda se migran conservando la moneda en que fueron ingresados.

En Presupuesto, el aporte de emergencia se descuenta del disponible mensual, pero no se incluye entre los gastos fijos que determinan la meta de cobertura. Es una planificación: el saldo real del fondo se actualiza en Inversiones. Una antigua categoría «Emergencia» con el único ítem genérico «Nuevo Gasto» se traslada una vez a este aporte, conservando el importe y el disponible anterior.

El aporte mensual a Vacaciones también se descuenta del disponible, separado de los gastos fijos. El saldo real se carga en Inversiones en ARS y/o USD y se suma al patrimonio en USD con la cotización MEP. El objetivo de Vacaciones se expresa en USD: sirve para indicar cuánto falta, pero **no** es dinero disponible ni se suma al patrimonio o a los hitos. En escritorio, Emergencia ocupa dos tercios de la fila de fondos y Vacaciones el tercio restante; en pantallas angostas se apilan.

El Resumen Mensual permite desplegar Gastos por categoría e ítem. Los porcentajes indican `importe / ingreso mensual × 100`: aparecen al pasar el cursor o enfocar los importes del resumen y en el tooltip del gráfico al pasar por un sector; si el ingreso es cero no se calcula el porcentaje. Cada subgasto conserva el mismo tono rojo/rosa en el gráfico y el desglose, sin huecos entre subgastos. Emergencia mantiene su barra de cobertura; Vacaciones muestra el total y lo que falta para el objetivo, sin gráfico propio.

Al importar amCharts, los hitos automáticos no se eliminan. La importación reemplaza sólo semanas amCharts repetidas; cuando existe una emergencia registrada en esa misma semana, la incorpora al total importado. Si no existe una referencia de ese período, queda en cero: no se proyecta el saldo actual hacia años anteriores. En una misma fecha, el gráfico prioriza el hito automático.

## Rendimiento y dividendos

La pantalla Evolución separa el cambio de valuación del capital ingresado:

- **Dividendos TTM estimados:** las distribuciones de Yahoo Finance, ajustadas por ratio CEDEAR y la composición actual, permiten estimar el ingreso neto de los últimos 12 meses y derivar el yield vigente. El gráfico muestra un punto mensual calculado como `capital invertido del último hito disponible en ese mes × yield neto vigente`. Es una estimación anual equivalente para comparar cómo habría evolucionado el ingreso con el capital histórico; no sigue el calendario de pagos ni representa cobros reales del pasado. Se descuenta una retención estimada del 30% al calcular el yield y la serie comienza en el primer hito patrimonial disponible.
- **Escudo de dividendos:** estimación neta (después del 30% de retención) de los últimos 12 meses dividida por los gastos fijos anuales actuales.
- **Crecimiento de dividendos:** TTM estimado actual frente a los 12 meses inmediatamente anteriores, manteniendo constante la composición actual para evitar comparar carteras distintas.

Los aportes, retiros y dividendos no requieren carga manual desde Evolución. El historial se utiliza para visualizar la evolución patrimonial, mientras que los dividendos se analizan por separado en ventana TTM.

La aplicación conserva en su estado local solamente los eventos brutos de la API, su fuente y fecha de actualización. El yield, el escudo y el crecimiento no se almacenan: se recalculan para que respondan a cambios de precios, posiciones, ratios y gastos. El caché se renueva una vez por día; los fondos comunes, como COMIAUS, se excluyen de la consulta porque su rendimiento se refleja en la cuotaparte y no como dividendos del subyacente.

### Simulador de dividendos

El simulador parte del capital y yield observados, pero permite reemplazarlos para analizar otros escenarios. Proyecta hasta 60 años y admite:

- Ingreso mensual objetivo y capital inicial.
- Yield actual de dividendos.
- Crecimiento anual promedio de los dividendos.
- Revalorización anual promedio de los activos.
- Inflación anual promedio.
- Aportes mensuales y reinversión opcional de dividendos.
- Retenciones y comisiones para convertir el yield bruto en ingreso neto.

El modo **Etapas de vida** amplía la proyección con:

- Edad actual y edad final del escenario.
- Salario mensual y crecimiento salarial diferente por etapa.
- Aporte vinculado a un porcentaje del salario o a un incremento anual propio.
- Tope mensual de aporte, entendido como techo y no como objetivo obligatorio.
- Gastos adicionales mensuales y extraordinarios anuales, que reducen el aporte sin retirar automáticamente capital.
- Dos perfiles editables de cartera —crecimiento y dividendos— y un porcentaje de mezcla distinto para cada etapa.
- Gráficos de capital, ingreso neto, salario/aportes y orientación a dividendos.

Las etapas comienzan a una edad indicada y continúan hasta la siguiente. El escenario se conserva localmente al ocultar el simulador o recargar la página. Los cálculos se realizan mes a mes; el rebalanceo entre perfiles se modela sin impuestos ni costos y se presenta como un supuesto, no como pronóstico.

El capital requerido se calcula con el yield neto estimado de la composición actual y las retenciones configuradas (30% por defecto), no con un cobro histórico parcial ni con el escudo. El escudo es una medida de cobertura de gastos; el simulador muestra el objetivo ajustado por inflación y permite alternar entre las curvas de ingresos y capital.

### Cobertura ante imprevistos

Desde el Fondo de Emergencia se puede evaluar un escenario indicando:

- Duración del imprevisto.
- Porcentaje de pérdida de ingresos.
- Gasto extraordinario inicial.
- Gastos adicionales mensuales.

La aplicación muestra los meses de cobertura actuales, el porcentaje alcanzado de la meta, el costo del escenario, el saldo o déficit final y el mes en que se agotaría el fondo. El gráfico representa la reducción mensual del capital en USD.

## Persistencia y privacidad

- Zustand persiste el estado principal en `localStorage` bajo la clave `finanzas_personales`.
- Cuando `server.js` está activo, el frontend mantiene una copia persistente en `E:\App de gestion financiera\datos\finanzas_personales.json` mediante WebSocket. Las escrituras usan un archivo temporal para evitar dejar un JSON incompleto.
- El servidor rechaza una sesión vacía si el JSON de E ya contiene datos financieros. Esto no resuelve conflictos entre dos sesiones diferentes con datos reales: conviene usar un solo perfil de navegador para la cartera habitual y probar cambios con datos aislados.
- Si todavía existe el antiguo `finanzas_personales.json` junto al código, se copia automáticamente a la carpeta de datos de E la primera vez. El archivo anterior no se elimina.
- La pestaña activa, el caché de precios MEP y el escenario del simulador de vida se guardan en claves separadas de `localStorage`; el historial de dividendos por API forma parte del estado principal y del espejo JSON.
- Los datos financieros completos permanecen en la máquina, pero los tickers consultados se envían a Yahoo Finance. Con `server.js`, la consulta pasa por un proxy local; los proxies públicos quedan como respaldo para el modo de desarrollo independiente.

Actualmente el JSON es un respaldo local, no la fuente que hidrata automáticamente la interfaz al arrancar. Para restaurarlo se utiliza la importación manual desde Administración.

## Requisitos

- Node.js 18 o superior.
- npm.
- Git configurado para la verificación de actualizaciones al iniciar.

## Instalación y ejecución

```bash
npm install
```

En Windows, iniciar en segundo plano con:

```text
run.bat
```

El lanzador inicia Vite en `http://localhost:5173`, espera hasta que responda y recién entonces abre el navegador. El WebSocket local de Finanzas utiliza `ws://localhost:3002`; el puerto `3001` queda libre para otras aplicaciones locales.

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

- `npm test`: pruebas unitarias de valuación, importaciones y respaldos, presupuesto y fondos, dividendos por API y rendimiento ajustado por flujos.
- `npm run lint`: validación estática.
- `npm run build`: comprobación TypeScript y build de producción.

## Comportamiento del servidor local

`server.js` realiza actualmente estas tareas:

- Verifica actualizaciones del repositorio remoto antes de iniciar.
- Arranca Vite con puerto estricto y una ruta física canónica para no mezclar `C:\Users` con `E:\C_Redirected\Users`.
- Espera la página y comprueba que `main.tsx` haya sido transformado correctamente antes de abrir el navegador.
- Recibe copias del estado por WebSocket y las guarda siempre en la carpeta de datos del disco E.
- Intermedia las consultas a Yahoo Finance para evitar depender de CORS o de un proxy público.
- Se apaga cuando deja de detectar una pestaña conectada.
- Cierra Vite sin crear commits ni ejecutar `git push`.

La sincronización de cierre sólo se habilita de forma explícita definiendo `FINTECH_AUTO_GIT_SYNC=1` antes de ejecutar `server.js`. Se mantiene desactivada por defecto para que cerrar la aplicación nunca modifique el historial Git.

## Documentación técnica

La arquitectura y las invariantes financieras están en [ARCHITECTURE.md](./ARCHITECTURE.md). Quien modifique el código debe leer también [AGENTS.md](./AGENTS.md), que resume las precauciones operativas y los archivos que deben mantenerse sincronizados.
