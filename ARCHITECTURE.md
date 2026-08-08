# Arquitectura y guía de mantenimiento

Este documento describe el diseño real de la aplicación, las reglas que no deben romperse y las mejoras arquitectónicas recomendadas. Debe actualizarse cuando cambien la persistencia, la valuación financiera o el ciclo de vida local.

## 1. Visión general

La aplicación tiene tres capas de ejecución:

1. Una SPA React/Vite muestra las cuatro áreas funcionales: Presupuesto, Historial, Evolución e Inversiones.
2. Zustand conserva el estado financiero persistente del usuario.
3. `server.js` coordina Vite, un WebSocket local, el espejo JSON, la apertura/cierre del navegador y la sincronización Git.

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
│   ├── investments/         # Fondo, operaciones y portafolio activo
│   └── portfolio/           # Gráfico y métricas de evolución
├── lib/
│   ├── api.ts               # Yahoo Finance y proxies CORS
│   ├── cedears.ts           # Ratios CEDEAR
│   ├── portfolioValuation.tsx      # Provider y estado asíncrono compartido
│   ├── portfolioValuationCore.ts   # Cálculos puros y prioridades de precios
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

- Presupuesto y moneda.
- Fondo de emergencia y moneda.
- Operaciones y precios importados opcionales.
- Historial patrimonial.
- Ratios CEDEAR personalizados.

### Espejo JSON

`App.tsx` envía el estado al WebSocket y `server.js` lo escribe en `finanzas_personales.json`. Este archivo es un espejo local y está ignorado por Git. Actualmente no existe un flujo servidor → frontend al iniciar; por lo tanto, el JSON no reemplaza automáticamente un `localStorage` perdido.

### Otras claves locales

- `fintech_active_tab`: última pestaña seleccionada.
- `fintech_last_known_prices_mep`: último precio USD conocido por ticker bajo la metodología MEP.

El caché MEP está separado del antiguo caché CCL para no mezclar valuaciones calculadas con divisores diferentes.

## 4. Pipeline de valuación

`PortfolioValuationProvider` es la única fuente de precios actuales. Presupuesto, Inversiones, Evolución y snapshots deben consumirlo; no deben implementar consultas o totales paralelos.

Orden obligatorio:

1. Obtener una cotización bolsa/MEP válida.
2. Consolidar posiciones activas.
3. Resolver precios actuales.
4. Calcular inversiones, fondo de emergencia y patrimonio en USD.
5. Crear el snapshot semanal si corresponde.
6. Mostrar los totales actuales.

Prioridad por activo:

1. Precio BYMA en ARS dividido por MEP.
2. Precio del subyacente USD dividido por el ratio CEDEAR.
3. Último precio importado desde el bróker.
4. Último precio cacheado bajo MEP.
5. Último precio registrado en una operación heredada.

Los activos sin fuente pública, como fondos comunes de inversión, dependen especialmente de los precios importados/cacheados.

El provider expone una unión discriminada `loading | ready | error`. Un consumidor no debe leer totales si el estado no es `ready`.

## 5. Historial y snapshots

`checkAndCreateSnapshot` recibe una valuación ya normalizada. No consulta APIs ni recalcula precios.

Reglas:

- No crear snapshots antes de completar MEP y precios.
- No crear snapshots parciales.
- Mantener la frecuencia semanal y la idempotencia frente a renders repetidos.
- Los snapshots nuevos guardan `cotizacion_mep`, fecha de cotización y `valores_normalizados_usd`.
- `cotizacion_ccl` permanece en el tipo únicamente para compatibilidad con registros anteriores.
- No reescribir automáticamente hitos históricos existentes.

## 6. Integraciones financieras

- ArgentinaDatos: serie `dolares/bolsa` para MEP actual e histórico.
- Yahoo Finance: precio BYMA con sufijo `.BA` y precio del subyacente estadounidense.
- Proxies CORS: AllOrigins y corsproxy.io como alternativas desde el navegador.

Las APIs pueden fallar, responder con demora o entregar cierres diferidos. La UI debe informar carga/error y conservar el último precio conocido sin presentarlo como una nueva cotización obtenida de la API.

## 7. Ciclo de vida local

1. `run.bat` ejecuta `run.vbs` sin mostrar consola.
2. `run.vbs` inicia `node server.js`.
3. `server.js` verifica Git y lanza Vite en el puerto estricto 5173.
4. El servidor espera una respuesta HTTP válida antes de abrir el navegador.
5. El frontend mantiene un heartbeat en `ws://localhost:3001`.
6. Sin conexiones, el servidor cierra Vite y ejecuta la sincronización final.

El temporizador inicial debe comenzar después de abrir el navegador; volver a una espera fija antes de comprobar Vite reintroduciría el error de página inaccesible al arrancar.

## 8. Buenas prácticas ya presentes

- Separación por funcionalidades y contratos TypeScript centralizados.
- Estado persistente separado de la valuación asíncrona transitoria.
- Núcleo de valuación puro y cubierto por pruebas unitarias.
- Una única fuente compartida para precios y totales.
- Estados asíncronos explícitos mediante unión discriminada.
- Fallbacks de precio ordenados y caché identificado por metodología cambiaria.
- Snapshots idempotentes y normalizados en USD.
- Compatibilidad de lectura con datos históricos anteriores.
- Validación de readiness HTTP antes de abrir el navegador.

## 9. Mejoras recomendadas

### Prioridad alta

1. **Unificar la persistencia:** definir `localStorage` o JSON como fuente canónica. Si el JSON debe ser recuperable automáticamente, agregar un handshake inicial servidor → frontend, versionado y resolución explícita de conflictos.
2. **Desacoplar Git del cierre:** el `git add/commit/push` automático puede incluir cambios de código no relacionados, fallar con conflictos o modificar el repositorio sin revisión. Convertirlo en una acción optativa y separada del guardado financiero.
3. **Reutilizar un único WebSocket:** actualmente existe un heartbeat persistente y se abre otra conexión para cada guardado. Centralizar la conexión, aplicar debounce y confirmar escrituras reduce carreras y conexiones innecesarias.
4. **Agregar migraciones del store:** configurar versión y `migrate` en Zustand antes de seguir ampliando el esquema. Esto evita depender de campos opcionales indefinidamente.

### Prioridad media

5. **Mover las consultas financieras al servidor local:** elimina la dependencia de proxies CORS públicos, permite timeouts/reintentos consistentes y facilita cachear respuestas con fecha y origen.
6. **Servir un build estable:** para uso cotidiano, compilar y servir `dist` es más predecible que ejecutar el servidor de desarrollo de Vite.
7. **Dividir responsabilidades de `App.tsx`:** extraer hooks para WebSocket, persistencia JSON, snapshots y navegación. `App` debería concentrarse en composición visual.
8. **Registrar procedencia del precio:** guardar por ticker `source`, `asOf` y si el valor es fresco o fallback. La interfaz podría diferenciar cotización actual de último valor conocido.

### Prioridad de calidad

9. Agregar pruebas de integración para hidratación, snapshot semanal, error/reintento y persistencia de pestaña.
10. Agregar pruebas del readiness y cierre de `server.js` sin ejecutar Git real.
11. Incorporar validación de esquemas para respuestas externas e importaciones JSON.
12. Añadir un Error Boundary y telemetría exclusivamente local para errores recuperables.

## 10. Reglas para futuras modificaciones

- No calcular precios actuales directamente dentro de una pestaña.
- No crear un hito con costo histórico presentado como valor actual.
- No mezclar dólar MEP y CCL en el mismo caché o snapshot.
- Mantener el orden BYMA/MEP → subyacente/ratio → último precio conocido.
- Preservar el significado de `precio_operacion` como costo/PPC y `precio_actual_usd` como último valor importado.
- Mantener compatibilidad con registros históricos; cualquier migración destructiva debe ser explícita y respaldada.
- No volver a abrir el navegador mediante un retraso fijo: comprobar siempre que Vite responda.
- Ejecutar `npm test`, `npm run lint` y `npm run build` después de modificar cálculos, tipos o persistencia.
