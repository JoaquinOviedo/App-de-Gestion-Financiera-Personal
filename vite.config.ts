import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { realpathSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const appRoot = realpathSync(dirname(fileURLToPath(import.meta.url)))

// https://vite.dev/config/
export default defineConfig({
  // Evita mezclar C:\Users con E:\C_Redirected\Users en equipos donde el
  // perfil está redirigido. Vite y Rollup deben compartir una raíz canónica.
  root: appRoot,
  plugins: [react()],
  esbuild: {
    jsx: 'automatic',
  },
})
