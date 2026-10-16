# Guía rápida para futuras modificaciones

Este archivo complementa [README.md](./README.md) (uso y funcionalidades) y [ARCHITECTURE.md](./ARCHITECTURE.md) (modelo, flujo y decisiones). Antes de editar, consultar esas guías y comprobar el código y `git status`: el árbol puede contener trabajo sin confirmar.

## Datos reales y pruebas seguras

- El estado activo está en `localStorage` (`finanzas_personales`). `server.js` mantiene un espejo en `E:\App de gestion financiera\datos\finanzas_personales.json`; el JSON no hidrata automáticamente la interfaz. No editarlo, borrarlo ni usarlo como fixture de pruebas.
- `App.tsx` y `server.js` rechazan algunos estados vacíos, pero no resuelven conflictos entre dos sesiones con datos distintos. No abrir un perfil/pestaña de prueba con `localStorage` nuevo contra el servidor que usa la base real. Para QA visual, aislar base y puertos o inspeccionar la sesión habitual sin modificar su estado.
- `run.bat` inicia `server.js`, que intenta actualizar el repositorio desde GitHub antes de lanzar Vite. No ejecutarlo como comprobación rutinaria sobre un árbol con cambios. Cerrar la app no crea commits salvo que `FINTECH_AUTO_GIT_SYNC=1`.
- Preservar cambios y archivos existentes del usuario; no limpiar el árbol ni reescribir historiales financieros para facilitar una prueba.

## Invariantes financieras

- `PortfolioValuationProvider` es la única fuente de precios y totales. Orden de dependencias: MEP válido → precios BYMA/MEP, subyacente/ratio o último precio conocido → fondos en USD → estado `ready`. Sólo entonces se muestran totales y se dispara el snapshot semanal; ambos consumen la misma valuación completa. Un estado `loading` o `error` no autoriza totales ni hitos parciales.
- `precio_operacion` es costo/PPC; `precio_actual_usd` es último precio importado. Los fondos comunes de inversión pueden no tener ticker público y no deben tratarse como pagadores de dividendos.
- Emergencia y Vacaciones se valúan como `saldo_usd + saldo_ars / MEP`. El objetivo de Vacaciones (`objetivo_usd`) es sólo una meta: no entra en patrimonio, snapshot ni presupuesto. La preferencia de contar USD afecta sólo a la cobertura de Emergencia.
- En Presupuesto, `gastos = Σ(costo_unitario × frecuencia)`; Emergencia, Vacaciones e Inversiones son asignaciones mensuales separadas. No aumentan por sí solas los saldos de los fondos. Los porcentajes del ingreso se calculan sólo si éste es positivo.
- En Evolución, la API calcula el yield neto vigente a partir de las distribuciones de los últimos 12 meses y la cartera actual, descontando 30% estimado. La línea histórica aplica ese yield al capital de inversiones de cada mes: cada punto es una estimación anual TTM, no un pago real ni un reflejo del calendario de distribuciones. No mostrar puntos anteriores al primer hito disponible.

## Dónde cambiar y cómo verificar

- Datos persistentes: actualizar juntos `src/types/index.ts`, normalizadores de `src/lib/`, `src/store/useStore.ts`, `src/App.tsx`, `server.js`, `src/lib/databaseBackup.ts` y sus pruebas. Mantener compatibilidad de importación con respaldos anteriores.
- Presupuesto y colores/porcentajes: `src/lib/budget.ts` y `src/features/budget/BudgetTab.tsx`. El gráfico y el desglose deben reutilizar los mismos colores de subgastos; sus sectores permanecen contiguos.
- Fondos y tarjetas: `src/features/investments/InvestmentsTab.tsx`, `src/lib/emergencyFund.ts`, `src/lib/vacationFund.ts`. En escritorio Emergencia ocupa dos tercios y Vacaciones uno; en móvil se apilan. Vacaciones no tiene gráfico de objetivo.
- Valuación: `src/lib/portfolioValuation.tsx`, `src/lib/portfolioValuationCore.ts` y `src/lib/useDolarMEP.ts`. Historial: `src/store/useStore.ts` y `src/lib/amChartsHistory.ts`.
- Después de cambios en cálculos o persistencia: `npm test`, `npm run lint`, `npm run build`. Para cambios de UI, además comprobar el comportamiento responsive en un entorno de prueba aislado. Actualizar README y ARCHITECTURE si cambia el comportamiento descrito.
