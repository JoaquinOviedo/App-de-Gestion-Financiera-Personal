# Aplicación de Gestión Financiera Personal (Desktop Local)

Esta es una aplicación de finanzas personales altamente visual, interactiva y de ejecución 100% local, construida con React, TypeScript y Tailwind CSS.

## 🚀 Características
- **Privacidad Absoluta:** Toda la información financiera se almacena en tu máquina dentro de un archivo local `finanzas_personales.json` (el cual está protegido y excluido en `.gitignore` para no subirse a GitHub accidentalmente).
- **Ejecución Invisible:** Al hacer doble clic en `run.bat`, la aplicación se iniciará discretamente en segundo plano.
- **Auto-Apagado Inteligente:** Si cierras la pestaña del navegador, el proceso del servidor local se apagará automáticamente tras 3 segundos.
- **Sincronización con GitHub:**
  - Al iniciar, la aplicación busca automáticamente si hay actualizaciones o nuevas versiones en el repositorio remoto (`git pull`).
  - Al cerrarse la pestaña, realiza automáticamente un commit y push (`git push`) para respaldar la estructura de la aplicación (excluyendo tus datos sensibles).
- **Seguimiento en Tiempo Real:** Integración con APIs de mercados financieros para evaluar la valorización de tus activos (acciones, ETFs y criptomonedas).

## 🛠️ Requisitos
- **Node.js** v18 o superior.
- **Git** configurado en el sistema con credenciales para acceder a GitHub.

## 📁 Iniciar Aplicación
Simplemente ejecuta haciendo doble clic en:
`run.bat`

O a través de la terminal:
```bash
node server.js
```
