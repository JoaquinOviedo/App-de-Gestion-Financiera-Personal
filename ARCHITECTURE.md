# Arquitectura y guía de mantenimiento

Este documento describe el diseño real de la aplicación, las reglas que no deben romperse y las mejoras arquitectónicas recomendadas. Debe actualizarse cuando cambien la persistencia, la valuación financiera, el presupuesto, los fondos o el ciclo de vida local. Las instrucciones operativas breves para futuras ediciones están en [AGENTS.md](./AGENTS.md).

## 1. Visión general

La aplicación tiene tres capas de ejecución:

1. Una SPA React/Vite muestra las cuatro áreas funcionales: Presupuesto, Historial, Evolución e Inversiones.
2. Zustand conserva el estado financiero persistente del usuario.
3. `server.js` coordina Vite, un WebSocket local, el espejo JSON y la apertura/cierre del navegador.

Tecnologías principales:

- React 18 y TypeScript.
- Vite como servidor de desarrollo y herramienta de build.
- Zustand con middleware `persist`.
- Tailwind CSS, Framer Motion, Lucide React y Recharts.
- Vitest para lógica financiera pura.
- Node.js y `ws` para el proceso local auxiliar.

## 2. Organización del frontend

```text
src/
├── components/              # Modales, importadores y estados UI compartidos
├── features/
│   ├── budget/              # Presupuesto
│   ├── history/             # Historial patrimonial
│   ├── investments/         # Fondos, simulador de emergencia y portafolio activo
│   └── portfolio/           # Evolución, dividendos y simuladores
├── lib/
│   ├── api.ts               # Precios Yahoo/BYMA y transporte
│   ├── budget.ts            # Totales, colores y porcentaje del ingreso
│   ├── emergencyFund.ts     # Normalización, valuación y cobertura
│   ├── vacationFund.ts      # Saldos, objetivo y valuación del fondo
│   ├── databaseBackup.ts    # Exportación, validación e importación JSON
│   ├── amChartsHistory.ts   # Fusión de hitos amCharts con el historial
│   ├── currentPortfolioParser.ts # Pegado de cartera del bróker
│   ├── dividendApi.ts       # Consulta y normalización de distribuciones
│   ├── dividendAnalytics.ts # TTM, yield implícito y crecimiento
│   ├── historicalDividends.ts # Serie mensual histórica
│   ├── dividendSimulator.ts # Proyección de capital e ingresos
│   ├── lifeDividendSimulator.ts # Proyección por etapas de vida
│   ├── emergencyFundSimulator.ts # Cobertura ante imprevistos
│   ├── portfolioAnalytics.ts # Rendimiento y flujos
│   ├── portfolioValuation.tsx # Provider de valuación compartida
│   ├── portfolioValuationCore.ts # Prioridad de precios y posiciones
│   └── useDolarMEP.ts       # Cotización bolsa/MEP y caché de solicitud
├── store/useStore.ts        # Estado persistente y acciones de dominio
├── types/index.ts           # Contratos de datos
├── App.tsx                  # Navegación, modales, sincronización y snapshots
└── main.tsx                 # Composición de providers y montaje
```

La navegación utiliza un estado local tipado porque sólo existen cuatro pestañas y no se necesitan URLs independientes. La última pestaña se persiste en `localStorage`.

## 3. Estado y persistencia

### Fuente primaria

El store Zustand es la fuente de verdad durante la ejecución. Su middleware persiste en `localStorage` con la clave `finanzas_personales` y lo hidrata al recargar.

El estado persistente incluye:

- Presupuesto, moneda y asignaciones mensuales separadas a inversiones, emergencia y vacaciones. `normalizeBudget` migra una categoría heredada «Emergencia» con un solo ítem genérico al aporte de emergencia; la operación es idempotente y conserva el disponible mensual.
- Fondo de emergencia con saldos independientes ARS/USD, meta en meses y preferencia de incluir USD sólo en la cobertura. Fondo de vacaciones independiente con saldos ARS/USD y `objetivo_usd`. Los datos antiguos se normalizan al hidratar o importar; un respaldo sin objetivo se interpreta como objetivo cero.
- Operaciones y precios importados opcionales.
- Movimientos externos del portafolio en USD: aportes y retiros. Los dividendos no se cargan manualmente.
- Caché de distribuciones brutas por ticker, con fuente, estado y fecha de actualización.
- Historial patrimonial.
- Ratios CEDEAR personalizados.

### Espejo JSON

`App.tsx` envía el estado al WebSocket y `server.js` lo escribe de forma atómica en `E:\App de gestion financiera\datos\finanzas_personales.json`. La carpeta de datos está separada del repositorio y se usa aunque la aplicación se haya abierto mediante la ruta aparente de C. Si sólo existe el antiguo JSON junto al código, se copia a E sin borrar el original. Actualmente no existe un flujo servidor → frontend al iniciar; por lo tanto, el JSON funciona como copia persistente y no reemplaza automáticamente un `localStorage` perdido.

Una sesión de navegador sin datos financieros reales no crea snapshots en cero ni puede reemplazar el JSON existente con un estado vacío. Esta protección no resuelve conflictos generales entre dos sesiones con datos distintos; el perfil habitual sigue siendo la fuente activa hasta que exista sincronización bidireccional.

La exportación manual construye una copia explícita de todos los campos de `AppState`, incluido `fondo_vacaciones.objetivo_usd`; la importación comprueba que el archivo esté completo antes de restaurarlo y normaliza formatos anteriores. La importación amCharts sólo reemplaza hitos de su propio origen, evita semanas duplicadas y conserva los automáticos. Reutiliza la emergencia registrada en la misma semana (sin extrapolar el fondo actual hacia el pasado); para fechas idénticas, el gráfico da prioridad al hito automático.

`App.tsx` y `server.js` evitan que un estado completamente vacío sobrescriba el JSON con datos. No hay resolución de conflictos entre sesiones con información distinta. Para verificar la interfaz, no abrir un perfil nuevo con `localStorage` vacío contra el servidor que usa la base real: emplear datos/puertos aislados o inspeccionar la sesión existente sin cambiar su estado.

### Otras claves locales

- `fintech_active_tab`: última pestaña seleccionada.
- `fintech_last_known_prices_mep`: último precio USD conocido por ticker bajo la metodología MEP.
- `fintech_dividend_life_scenario`: escenario editable del simulador por etapas.

El caché MEP está separado del antiguo caché CCL para no mezclar valuaciones calculadas con divisores diferentes.

## 4. Pipeline de valuación

`PortfolioValuationProvider` es la única fuente de precios actuales. Presupuesto, Inversiones, Evolución y snapshots deben consumirlo; no deben implementar consultas o totales paralelos.

Orden de dependencias obligatorio:

1. Obtener una cotización bolsa/MEP válida.
2. Consolidar posiciones activas.
3. Resolver precios actuales.
4. Calcular inversiones, fondo de emergencia y patrimonio en USD.
5. Con estado `ready`, habilitar la visualización de totales y disparar el efecto que crea el snapshot semanal si corresponde. React no garantiza que la escritura del snapshot termine antes de pintar los totales; la garantía importante es que ambos usan la misma valuación completa.

Cada fondo se valúa como `saldo_usd + saldo_ars / cotizacion_mep`; ambos integran el patrimonio en USD, pero sólo Emergencia interviene en la cobertura y su simulador. El `objetivo_usd` de Vacaciones es una meta, **no un saldo**: sólo sirve para calcular cuánto falta y nunca se suma al patrimonio o a los snapshots. El aporte mensual a Vacaciones se planifica aparte de los gastos fijos y no cambia la meta de Emergencia. Los nuevos snapshots guardan ambos fondos por separado; los hitos anteriores no se reescriben. La valuación compartida debe estar lista antes de mostrar los totales o registrar un snapshot. La moneda anterior se conserva únicamente para interpretar hitos heredados que no estaban normalizados.

Prioridad por activo:

1. Precio BYMA en ARS dividido por MEP.
2. Precio del subyacente USD dividido por el ratio CEDEAR.
3. Último precio importado desde el bróker.
4. Último precio cacheado bajo MEP.
5. Último precio registrado en una operación heredada.

Los activos sin fuente pública, como fondos comunes de inversión, dependen especialmente de los precios importados/cacheados.

El provider expone una unión discriminada `loading | ready | error`. Un consumidor no debe leer totales si el estado no es `ready`.

### Presupuesto y presentación de los fondos

`budget.ts` calcula `gastos = Σ(costo_unitario × frecuencia)` y `libre = ingreso - gastos - inversiones - emergencia - vacaciones`. Los aportes a fondos son asignaciones del presupuesto, no gastos fijos ni incrementos automáticos de los saldos reales: éstos se editan en Inversiones. `budgetIncomeShare` usa `importe / ingreso_mensual × 100` y devuelve ausencia de porcentaje si el ingreso no es positivo; puede mostrar valores negativos o superiores a 100% para reflejar el presupuesto real.

`getBudgetExpenseItems` asigna a cada subgasto un tono rojo/rosa, reutilizado en Estructura de Gastos, el gráfico y el desglose del Resumen Mensual. Las porciones de gastos son contiguas (`paddingAngle=0`); las asignaciones mayores conservan separación visual. El porcentaje del ingreso no ocupa espacio permanente: aparece al pasar el cursor o enfocar importes en el resumen, y en el tooltip del gráfico. En la edición de gastos también se informa al pasar el cursor sobre el total de categoría o el costo del ítem; para este último se usa el costo mensual `costo_unitario × frecuencia`.

Las tarjetas de Inversiones comparten fila en escritorio: Emergencia ocupa dos tercios y Vacaciones uno; en pantallas angostas se apilan. Sólo Emergencia muestra una barra de cobertura y un simulador. Vacaciones muestra el saldo convertido a USD y, si se configuró `objetivo_usd`, cuánto falta para alcanzarlo, sin gráfico propio.

## 5. Historial y snapshots

`checkAndCreateSnapshot` recibe una valuación ya normalizada. No consulta APIs ni recalcula precios.

Reglas:

- No crear snapshots antes de completar MEP y precios.
- No crear snapshots parciales.
- Mantener la frecuencia semanal y la idempotencia frente a renders repetidos.
- Los snapshots nuevos guardan `cotizacion_mep`, fecha de cotización y `valores_normalizados_usd`.
- `cotizacion_ccl` permanece en el tipo únicamente para compatibilidad con registros anteriores.
- No reescribir automáticamente hitos históricos existentes.
- La interfaz no crea hitos manuales: el historial visible proviene de snapshots completos o importaciones. `MANUAL` se conserva sólo para datos heredados.

## 6. Analítica de rendimiento

`portfolioAnalytics.ts` contiene cálculos puros y testeables. La pestaña Evolución prepara los datos y presenta los resultados.

Definiciones:

- La interfaz no exige registrar aportes, retiros ni dividendos; la evolución patrimonial se visualiza sólo con los hitos disponibles.
- Los dividendos se registran como ingresos independientes y se agrupan por mes; no se tratan como aportes externos.
- Los dividendos visibles provienen exclusivamente de la API. El tipo heredado `DIVIDENDO` permanece legible para compatibilidad, pero la interfaz no permite crear nuevos movimientos de ese tipo.
- Si existe una operación anterior a la distribución, `dividendo_conocido_evento = monto_por_accion_usd * cantidad_en_la_fecha / ratio_cedear`.
- Si no existe una tenencia reconstruible, `dividendo_estimado_evento = monto_por_accion_usd * cantidad_actual / ratio_cedear`, ajustado por `capital_ultimo_hito_anterior / capital_actual`. Para los once meses anteriores al primer hito se usa el capital de ese primer hito como referencia retrospectiva, únicamente para completar la primera ventana TTM visible.
- `dividendos_netos = dividendos_brutos * (1 - retencion_estimada)`; la retención predeterminada es 30% y es editable en el simulador.
- `dividendos_TTM_actual = suma de distribuciones netas de API de los últimos 12 meses, ajustada a la composición actual`; se usa para derivar el yield vigente (`dividendos_TTM_actual / capital_actual`).
- La línea histórica calcula cada punto mensual como `capital_invertido_del_último_hito_en_el_mes × yield_neto_vigente`. Es una estimación anual equivalente (TTM) basada en el capital histórico; no suma pagos por mes, no sigue el calendario de distribuciones y no son cobros reales pasados. Empieza en el primer hito disponible y los filtros sólo limitan los meses visibles.
- `escudo_dividendos = dividendos_netos_TTM / gastos_fijos_anuales_actuales`.
- `crecimiento_dividendos = dividendos_estimados_TTM / dividendos_estimados_12_meses_previos - 1`.

`dividendApi.ts` consulta cinco años de eventos y el store guarda el resultado bruto durante 24 horas. Los fondos comunes identificados por ticker o nombre quedan fuera de esa consulta: su variación se refleja en la cuotaparte, no en dividendos del subyacente. `dividendAnalytics.ts` calcula las métricas derivadas con la composición y ratios actuales; el yield vigente usa las distribuciones API de los últimos 12 meses y la retención estimada. `historicalDividends.ts` aplica ese yield neto a cada capital invertido histórico y genera un valor anual equivalente por mes. Así, la frecuencia de pago de cada activo no crea picos en la curva histórica. No se inventan meses anteriores al primer hito. El yield y el crecimiento usados por el simulador se calculan con la composición actual y un período anual completo. Yield, escudo y crecimiento no se persisten porque quedarían obsoletos al cambiar posiciones, precios o gastos.

Los hitos históricos se conservan para visualizar la evolución patrimonial. `movimientos_portafolio` se conserva para compatibilidad y para mejorar futuros cálculos, pero la UI no obliga a completarlo.

### Simulación de dividendos

`dividendSimulator.ts` es una función pura independiente de React. Recibe capital inicial, ingreso objetivo, yield, crecimiento de dividendos, revalorización, inflación, aportes, horizonte y reinversión.

Reglas del modelo:

- `capital_requerido = ingreso_mensual_objetivo * 12 / dividend_yield`.
- El objetivo futuro aumenta con la inflación compuesta.
- El yield futuro cambia según `(1 + crecimiento_dividendos) / (1 + revalorizacion_activos)`.
- El capital aumenta por revalorización, aportes y, si se habilita, dividendos reinvertidos.
- Los aportes se incorporan mes a mes.
- Las retenciones/comisiones reducen el yield efectivo, el ingreso disponible y el dividendo reinvertido.
- Un yield igual a cero produce un resultado no calculable; nunca se debe reemplazar silenciosamente por un supuesto inventado.

`lifeDividendSimulator.ts` agrega una simulación mensual por edades. Cada etapa define crecimiento salarial, modo de evolución del aporte, tope, gastos y orientación del portafolio. Reglas:

- El aporte puede ser un porcentaje del salario o crecer a una tasa anual propia.
- `aporte_real = min(salario, aporte_deseado, tope_si_existe) - gastos_planificados`, con piso cero.
- Los gastos de la etapa reducen aportes; no generan retiros automáticos del portafolio.
- La cartera se mezcla entre dos perfiles editables y se rebalancea mensualmente sin modelar impuestos ni costos de transacción.
- El ingreso objetivo aumenta con inflación y se compara con dividendos netos.
- El escenario es persistente, pero los resultados se recalculan; no se guardan métricas derivadas.

### Simulación del fondo de emergencia

`emergencyFundSimulator.ts` calcula escenarios mensuales a partir del fondo actual y los gastos fijos normalizados a USD.

- `cobertura_actual_meses = fondo_actual / gastos_fijos_mensuales`.
- `uso_mensual = gastos_fijos_mensuales * porcentaje_perdida_ingresos + gasto_adicional_mensual`.
- El gasto extraordinario se descuenta en el mes cero.
- La proyección conserva saldos negativos para mostrar el déficit real y registra el primer mes con saldo menor o igual a cero.
- El progreso de cobertura se compara únicamente con la meta de meses configurada por el usuario; no se inventan categorías cualitativas de riesgo.

## 7. Integraciones financieras

- ArgentinaDatos: serie `dolares/bolsa` para MEP actual e histórico.
- Yahoo Finance: precio BYMA con sufijo `.BA` y precio del subyacente estadounidense.
- Yahoo Finance Chart: eventos de dividendos del subyacente para las estimaciones brutas.
- Proxy local en `server.js` para Yahoo Finance; AllOrigins y corsproxy.io quedan como respaldos cuando se ejecuta Vite sin el servidor auxiliar.

Las APIs pueden fallar, responder con demora o entregar cierres diferidos. La UI debe informar carga/error y conservar el último precio conocido sin presentarlo como una nueva cotización obtenida de la API.

## 8. Ciclo de vida local

1. `run.bat` ejecuta `run.vbs` sin mostrar consola.
2. `run.vbs` inicia `node server.js`.
3. `server.js` resuelve la ruta física del proyecto, verifica Git y lanza Vite en el puerto estricto 5173 desde esa ruta canónica.
   En Windows lo ejecuta mediante `cmd.exe` para evitar incompatibilidades al lanzar directamente el shim `npm.cmd`. Esto impide mezclar `C:\Users` con `E:\C_Redirected\Users`, situación que puede hacer que Vite entregue TSX sin transformar.
4. El servidor espera la página y verifica que el módulo principal haya sido transformado antes de abrir el navegador.
5. El frontend mantiene un heartbeat en `ws://localhost:3002`; el puerto `3001` queda reservado para otras aplicaciones locales.
6. Sin conexiones, el servidor cierra todo el árbol de procesos de Vite sin modificar Git, evitando dejar el puerto ocupado.

El temporizador inicial debe comenzar después de abrir el navegador; volver a una espera fija antes de comprobar Vite reintroduciría el error de página inaccesible al arrancar.

La sincronización Git al cierre está desactivada por defecto. Sólo se ejecuta cuando `FINTECH_AUTO_GIT_SYNC=1`; esta opción existe por compatibilidad y no debe activarse en un entorno con cambios de código sin revisar.

## 9. Buenas prácticas ya presentes

- Separación por funcionalidades y contratos TypeScript centralizados.
- Estado persistente separado de la valuación asíncrona transitoria.
- Núcleo de valuación puro y cubierto por pruebas unitarias.
- Analítica de rendimiento separada de la UI y cubierta por pruebas unitarias.
- Eventos de dividendos persistidos por separado de sus métricas derivadas.
- Una única fuente compartida para precios y totales.
- Estados asíncronos explícitos mediante unión discriminada.
- Fallbacks de precio ordenados y caché identificado por metodología cambiaria.
- Snapshots idempotentes y normalizados en USD.
- Compatibilidad de lectura con datos históricos anteriores.
- Validación de readiness HTTP antes de abrir el navegador.
- Cierre sin commits automáticos; la sincronización Git requiere opt-in explícito.

## 10. Mejoras recomendadas

### Prioridad alta

1. **Unificar la persistencia:** definir `localStorage` o JSON como fuente canónica. Si el JSON debe ser recuperable automáticamente, agregar un handshake inicial servidor → frontend, versionado y resolución explícita de conflictos.
2. **Desacoplar también la actualización Git del arranque:** el cierre ya no crea commits por defecto, pero `git fetch/pull` continúa acoplado al inicio. Conviene convertir la actualización de código en una acción manual y visible.
3. **Reutilizar un único WebSocket:** actualmente existe un heartbeat persistente y se abre otra conexión para cada guardado. Centralizar la conexión, aplicar debounce y confirmar escrituras reduce carreras y conexiones innecesarias.
4. **Agregar migraciones del store:** configurar versión y `migrate` en Zustand antes de seguir ampliando el esquema. Esto evita depender de campos opcionales indefinidamente.

### Prioridad media

5. **Mover las consultas financieras al servidor local:** elimina la dependencia de proxies CORS públicos, permite timeouts/reintentos consistentes y facilita cachear respuestas con fecha y origen.
6. **Servir un build estable:** para uso cotidiano, compilar y servir `dist` es más predecible que ejecutar el servidor de desarrollo de Vite.
7. **Dividir responsabilidades de `App.tsx`:** extraer hooks para WebSocket, persistencia JSON, snapshots y navegación. `App` debería concentrarse en composición visual.
8. **Registrar procedencia del precio:** guardar por ticker `source`, `asOf` y si el valor es fresco o fallback. La interfaz podría diferenciar cotización actual de último valor conocido.

### Prioridad de calidad

9. Agregar pruebas de integración para hidratación, snapshot semanal, error/reintento, persistencia de pestaña y tooltips/responsividad del presupuesto y los fondos, siempre con una base aislada de la real.
10. Agregar pruebas del readiness y cierre de `server.js` sin ejecutar Git real.
11. Incorporar validación de esquemas para respuestas externas e importaciones JSON.
12. Añadir un Error Boundary y telemetría exclusivamente local para errores recuperables.

## 11. Reglas para futuras modificaciones

- No calcular precios actuales directamente dentro de una pestaña.
- No crear un hito con costo histórico presentado como valor actual.
- No mezclar dólar MEP y CCL en el mismo caché o snapshot.
- Mantener el orden BYMA/MEP → subyacente/ratio → último precio conocido.
- Preservar el significado de `precio_operacion` como costo/PPC y `precio_actual_usd` como último valor importado.
- No presentar crecimiento patrimonial como rendimiento si faltan aportes o retiros; advertir que el cálculo está incompleto.
- Mantener los dividendos separados de los aportes externos y documentar cualquier cambio en la fórmula del escudo.
- No presentar una distribución estimada por API como un cobro real del bróker.
- No sumar el objetivo de Vacaciones a saldos, patrimonio o hitos. El presupuesto sólo planifica aportes: no incrementa automáticamente ninguno de los fondos.
- Si se agrega o cambia un campo persistente, revisar en conjunto los tipos, `normalize*`, estado inicial y acciones de Zustand, guardado de `App.tsx`, filtro de `server.js`, exportación/importación JSON y pruebas de compatibilidad. Los datos reales residen en E: y no son datos de prueba.
- Mantener los porcentajes del presupuesto basados en el ingreso mensual actual; no mostrar un porcentaje con ingreso cero. Los colores de cada subgasto deben coincidir entre editor, gráfico y resumen.
- Mantener compatibilidad con registros históricos; cualquier migración destructiva debe ser explícita y respaldada.
- No volver a abrir el navegador mediante un retraso fijo: comprobar siempre que Vite responda.
- No habilitar `FINTECH_AUTO_GIT_SYNC` por defecto ni confundir el guardado financiero con el versionado del código.
- Ejecutar `npm test`, `npm run lint` y `npm run build` después de modificar cálculos, tipos o persistencia. Para cambios visuales, comprobar también el diseño sin conectar una sesión de prueba vacía al servidor con datos reales.
