import { spawn, execSync } from 'child_process';
import http from 'http';
import { WebSocketServer } from 'ws';
import open from 'open';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Rutas del archivo JSON de base de datos
const DB_FILE_NAME = 'finanzas_personales.json';
const DB_PATH = path.join(__dirname, DB_FILE_NAME);
const AUTO_GIT_SYNC_ENABLED = process.env.FINTECH_AUTO_GIT_SYNC === '1';

// 1. Crear el JSON inicial si no existe
if (!fs.existsSync(DB_PATH)) {
  const defaultSchema = {
    version: "1.0",
    presupuesto: {
      ingreso_mensual: 3000,
      categorias: [
        {
          id: "cat-1",
          nombre: "Salud y Bienestar",
          subgastos: [
            { id: "sub-1", nombre: "Terapia", costo_unitario: 30, frecuencia: 4 },
            { id: "sub-2", nombre: "Gimnasio", costo_unitario: 40, frecuencia: 1 }
          ]
        }
      ],
      asignacion_inversiones: 500
    },
    fondo_emergencia: {
      saldo_actual: 5000,
      meta_meses: 6
    },
    inversiones: {
      operaciones: [
        {
          id: "op-1",
          tipo: "COMPRA",
          ticker: "AAPL",
          nombre: "Apple Inc.",
          icono_url: "",
          cantidad: 10,
          precio_operacion: 180.50,
          fecha: "2026-05-10"
        }
      ]
    },
    historial_patrimonio: [
      { id: "hist-1", fecha: "2025-01-01", valor_inversiones: 2000, valor_emergencia: 3000, total: 5000, origen: "MANUAL" }
    ]
  };
  fs.writeFileSync(DB_PATH, JSON.stringify(defaultSchema, null, 2), 'utf8');
  console.log(`Creada base de datos local inicial en ${DB_PATH}`);
}

// 2. Verificar actualización desde GitHub antes de arrancar
console.log('Verificando actualizaciones en GitHub...');
try {
  // Asegurar que es un repositorio git
  if (!fs.existsSync(path.join(__dirname, '.git'))) {
    console.log('Inicializando repositorio de Git y vinculando remote...');
    execSync('git init', { stdio: 'inherit' });
    execSync('git remote add origin https://github.com/JoaquinOviedo/App-de-Gestion-Financiera-Personal.git', { stdio: 'inherit' });
  }
  
  // Hacer fetch y pull
  execSync('git fetch origin main', { stdio: 'ignore' });
  const localHead = execSync('git rev-parse HEAD').toString().trim();
  const remoteHead = execSync('git rev-parse origin/main').toString().trim();
  
  if (localHead !== remoteHead) {
    console.log('Nueva versión detectada en GitHub. Actualizando local...');
    execSync('git pull origin main', { stdio: 'inherit' });
    console.log('Proyecto actualizado correctamente.');
  } else {
    console.log('El proyecto local ya está actualizado.');
  }
} catch (error) {
  console.log('No se pudo verificar o descargar la actualización (puede que el repositorio esté vacío o requiera credenciales). Continuando...');
}

// 3. Iniciar el servidor de desarrollo de Vite
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const vite = spawn(npmCmd, ['run', 'dev', '--', '--host', 'localhost', '--port', '5173', '--strictPort'], {
  stdio: 'inherit' 
});
let viteExited = false;
vite.on('exit', () => { viteExited = true; });

const server = http.createServer();
const wss = new WebSocketServer({ server });

let activeConnections = 0;
let timeout = null;
let initialTimeout = null;

// Sincronización opcional. Está desactivada por defecto para no crear commits al cerrar.
const saveAndPushToGitHub = () => {
  console.log('Guardando cambios y subiendo a GitHub...');
  try {
    execSync('git add .', { stdio: 'inherit' });
    // Solo hace commit si hay cambios en los archivos versionados
    const status = execSync('git status --porcelain').toString().trim();
    if (status) {
      execSync('git commit -m "Auto-backup: actualización automática al cerrar aplicación"', { stdio: 'inherit' });
      execSync('git push origin main', { stdio: 'inherit' });
      console.log('Cambios subidos a GitHub correctamente.');
    } else {
      console.log('No hay cambios locales para subir.');
    }
  } catch (error) {
    console.error('Error al intentar subir los cambios a GitHub:', error.message);
  }
};

wss.on('connection', (ws) => {
  activeConnections++;
  if (initialTimeout) {
    clearTimeout(initialTimeout);
    initialTimeout = null;
  }
  if (timeout) {
    clearTimeout(timeout);
    timeout = null;
  }
  
  // Recibir base de datos al guardar en el frontend
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'SAVE_DATA') {
        fs.writeFileSync(DB_PATH, JSON.stringify(data.payload, null, 2), 'utf8');
        console.log('Base de datos local actualizada.');
      }
    } catch (e) {
      // Ignorar pings u otros mensajes
    }
  });

  ws.on('close', () => {
    activeConnections--;
    if (activeConnections === 0) {
      timeout = setTimeout(() => {
        console.log('Navegador cerrado. Apagando aplicación...');
        vite.kill();
        if (AUTO_GIT_SYNC_ENABLED) saveAndPushToGitHub();
        process.exit();
      }, 3000);
    }
  });
});

const waitForHttp = (url, timeoutMs = 60000) => new Promise((resolve, reject) => {
  const startedAt = Date.now();
  const check = () => {
    if (viteExited) {
      reject(new Error('Vite terminó antes de quedar disponible.'));
      return;
    }
    const request = http.get(url, response => {
      response.resume();
      if (response.statusCode && response.statusCode < 500) {
        resolve();
        return;
      }
      retry();
    });
    request.setTimeout(1000, () => request.destroy());
    request.on('error', retry);
  };
  const retry = () => {
    if (Date.now() - startedAt >= timeoutMs) {
      reject(new Error(`Vite no respondió después de ${timeoutMs / 1000} segundos.`));
      return;
    }
    setTimeout(check, 250);
  };
  check();
});

server.listen(3001, async () => {
  try {
    await waitForHttp('http://localhost:5173');
    await open('http://localhost:5173');
    initialTimeout = setTimeout(() => {
      if (activeConnections === 0) {
        console.log('No se detectaron conexiones al navegador. Cerrando...');
        vite.kill();
        if (AUTO_GIT_SYNC_ENABLED) saveAndPushToGitHub();
        process.exit();
      }
    }, 15000);
  } catch (error) {
    console.error('No se pudo iniciar la aplicación:', error.message);
    if (!viteExited) vite.kill();
    server.close(() => process.exit(1));
  }
});
