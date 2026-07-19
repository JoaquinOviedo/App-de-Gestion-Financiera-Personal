# Arquitectura de la Aplicación Fintech

Este documento describe la arquitectura y decisiones de diseño de la aplicación local de finanzas personales. Sirve como referencia para futuros cambios y mejoras.

## 1. Visión General
La aplicación es una SPA (Single Page Application) construida con React, Vite y TypeScript. Está diseñada para ejecutarse localmente, garantizando la privacidad absoluta de los datos del usuario.

## 2. Tecnologías Principales
- **Frontend:** React 18
- **Build Tool:** Vite
- **Lenguaje:** TypeScript
- **Estilos:** Tailwind CSS
- **Animaciones:** Framer Motion
- **Íconos:** Lucide React
- **Gráficos:** Recharts
- **Estado Global:** Zustand
- **Rutas:** (Dependiendo de la complejidad, se usará un simple estado para las pestañas o React Router). Para este diseño de 4 pestañas, un estado local de `activeTab` es suficiente y más rápido.

## 3. Estructura de Directorios

```text
src/
├── assets/          # Imágenes estáticas y logos
├── components/      # Componentes UI reutilizables (Botones, Tarjetas, Inputs)
│   ├── ui/          # Componentes genéricos (shadcn-like)
│   └── layout/      # Header, Sidebar, Contenedores principales
├── features/        # Módulos por dominio de negocio (Las 4 Pestañas)
│   ├── budget/      # Pestaña 1: Presupuesto y Flujo de Caja
│   ├── history/     # Pestaña 2: Carga de Historial Retrospectivo
│   ├── portfolio/   # Pestaña 3: Evolución del Portafolio (Gráficos)
│   └── investments/ # Pestaña 4: Gestión de Inversiones
├── lib/             # Funciones de utilidad y helpers
│   ├── api.ts       # Integración con Yahoo Finance (vía corsproxy)
│   ├── format.ts    # Formateo de monedas y fechas
│   └── utils.ts     # Clases utilitarias (ej. cn para Tailwind)
├── store/           # Estado Global (Zustand)
│   └── useStore.ts  # Definición del store principal y lógica de persistencia
├── types/           # Definiciones de tipos TypeScript (.d.ts o index.ts)
├── App.tsx          # Punto de entrada principal y enrutamiento de pestañas
└── main.tsx         # Renderizado de React
```

## 4. Gestión del Estado (JSON Local)
Todo el estado de la aplicación reside en un objeto JSON manejado por Zustand.
El store de Zustand incluye lógica de persistencia (`persist` middleware) para guardar automáticamente en `localStorage` ante cada cambio.

**Snapshot Semanal:**
Al inicializar el store o cargar la app (`App.tsx`), se ejecuta una función que verifica la diferencia en días entre hoy y el último registro de `historial_patrimonio`. Si `diff >= 7`, se calcula la valorización actual de los activos + fondo de emergencia y se inserta un nuevo registro de tipo `AUTO_SNAPSHOT`.

## 5. Ciclo de Vida y Ejecución Local
Para asegurar que la aplicación funcione como un "ejecutable" de escritorio, el proyecto incluye un mecanismo de auto-arranque y auto-cierre:
1. `run.bat` / `run.vbs`: Inicia el servidor de desarrollo en modo invisible.
2. `server.js`: Un pequeño servidor Node que inicia Vite, abre el navegador y levanta un WebSocket en el puerto 3001.
3. El frontend (Vite) se conecta a `ws://localhost:3001` al montar la aplicación.
4. Si la conexión WebSocket se pierde (el usuario cierra la pestaña), el `server.js` espera 3 segundos y, si no hay reconexión, cierra el proceso de Vite y el suyo propio.

## 6. Integración API Financiera
Las consultas a Yahoo Finance se realizan a través de un proxy para evitar problemas de CORS:
- `https://corsproxy.io/?https://query1.finance.yahoo.com/v8/finance/chart/{TICKER}`
Esto obtiene precios de cierre en tiempo real y metadatos básicos del activo sin exponer claves privadas.
