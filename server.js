import { spawn, execFileSync, execSync } from 'child_process';
import http from 'http';
import { WebSocketServer } from 'ws';
import open from 'open';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// En equipos con carpetas redirigidas, una misma ubicación puede verse como C:\Users
// y E:\C_Redirected\Users. Vite debe iniciar y resolver módulos desde la misma ruta
// física; de lo contrario puede servir TSX sin transformarlo y dejar la página blanca.
const APP_DIR = fs.realpathSync(__dirname);

// Rutas del archivo JSON de base de datos
const DB_FILE_NAME = 'finanzas_personales.json';
const LEGACY_DB_PATH = path.join(APP_DIR, DB_FILE_NAME);
const DATA_DIR = process.platform === 'win32'
  ? 'E:\\App de gestion financiera\\datos'
  : path.join(APP_DIR, 'datos');
fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = path.join(DATA_DIR, DB_FILE_NAME);
const AUTO_GIT_SYNC_ENABLED = process.env.FINTECH_AUTO_GIT_SYNC === '1';
const WEBSOCKET_PORT = 3002;

if (!fs.existsSync(DB_PATH) && fs.existsSync(LEGACY_DB_PATH)) {
  fs.copyFileSync(LEGACY_DB_PATH, DB_PATH);
  console.log(`Datos existentes migrados a ${DB_PATH}`);
}

const writeDatabase = data => {
  const temporaryPath = `${DB_PATH}.tmp`;
  fs.writeFileSync(temporaryPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(temporaryPath, DB_PATH);
};

const hasSubstantiveData = data => Boolean(
  Number(data?.presupuesto?.ingreso_mensual) > 0
  || data?.presupuesto?.categorias?.length > 0
  || Number(data?.presupuesto?.asignacion_inversiones) > 0
  || Number(data?.presupuesto?.asignacion_emergencia) > 0
  || Number(data?.presupuesto?.asignacion_vacaciones) > 0
  || Number(data?.fondo_emergencia?.saldo_ars) > 0
  || Number(data?.fondo_emergencia?.saldo_usd) > 0
  || Number(data?.fondo_vacaciones?.saldo_ars) > 0
  || Number(data?.fondo_vacaciones?.saldo_usd) > 0
  || Number(data?.fondo_vacaciones?.objetivo_usd) > 0
  || data?.inversiones?.operaciones?.length > 0
  || data?.historial_patrimonio?.some(record => Number(record.total) !== 0)
);

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
      asignacion_inversiones: 500,
      asignacion_emergencia: 0,
      asignacion_vacaciones: 0
    },
    fondo_emergencia: {
      saldo_ars: 5000,
      saldo_usd: 0,
      meta_meses: 6,
      incluir_usd_en_cobertura: false
    },
    fondo_vacaciones: {
      saldo_ars: 0,
      saldo_usd: 0,
      objetivo_usd: 0
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
    movimientos_portafolio: [],
    dividendos_api: {},
    historial_patrimonio: [
      { id: "hist-1", fecha: "2025-01-01", valor_inversiones: 2000, valor_emergencia: 3000, total: 5000, origen: "MANUAL" }
    ]
  };
  writeDatabase(defaultSchema);
  console.log(`Creada base de datos local inicial en ${DB_PATH}`);
}

// 2. Verificar actualización desde GitHub antes de arrancar
console.log('Verificando actualizaciones en GitHub...');
try {
  // Asegurar que es un repositorio git
  if (!fs.existsSync(path.join(APP_DIR, '.git'))) {
    console.log('Inicializando repositorio de Git y vinculando remote...');
    execSync('git init', { cwd: APP_DIR, stdio: 'inherit' });
    execSync('git remote add origin https://github.com/JoaquinOviedo/App-de-Gestion-Financiera-Personal.git', { cwd: APP_DIR, stdio: 'inherit' });
  }
  
  // Hacer fetch y pull
  execSync('git fetch origin main', { cwd: APP_DIR, stdio: 'ignore' });
  const localHead = execSync('git rev-parse HEAD', { cwd: APP_DIR }).toString().trim();
  const remoteHead = execSync('git rev-parse origin/main', { cwd: APP_DIR }).toString().trim();
  
  if (localHead !== remoteHead) {
    console.log('Nueva versión detectada en GitHub. Actualizando local...');
    execSync('git pull origin main', { cwd: APP_DIR, stdio: 'inherit' });
    console.log('Proyecto actualizado correctamente.');
  } else {
    console.log('El proyecto local ya está actualizado.');
  }
} catch (error) {
  console.log('No se pudo verificar o descargar la actualización (puede que el repositorio esté vacío o requiera credenciales). Continuando...');
}

// 3. Iniciar el servidor de desarrollo de Vite
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const viteArgs = ['run', 'dev', '--', '--host', 'localhost', '--port', '5173', '--strictPort'];
const vite = process.platform === 'win32'
  ? spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', [npmCmd, ...viteArgs].join(' ')], {
      cwd: APP_DIR,
      stdio: 'inherit',
      windowsHide: true,
    })
  : spawn(npmCmd, viteArgs, { cwd: APP_DIR, stdio: 'inherit' });
let viteExited = false;
vite.on('error', (error) => {
  viteExited = true;
  console.error('No se pudo iniciar Vite:', error.message);
});
vite.on('exit', () => { viteExited = true; });

const stopVite = () => {
  if (viteExited || !vite.pid) return;
  try {
    if (process.platform === 'win32') {
      // Cierra cmd, npm y Vite como un único árbol para no dejar el puerto ocupado.
      execFileSync('taskkill.exe', ['/PID', String(vite.pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      });
    } else {
      vite.kill('SIGTERM');
    }
  } catch {
    vite.kill();
  }
};

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
  if (requestUrl.pathname !== '/api/yahoo') {
    response.writeHead(404).end();
    return;
  }

  response.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
  response.setHeader('Vary', 'Origin');
  if (request.method === 'OPTIONS') {
    response.writeHead(204).end();
    return;
  }

  try {
    const target = new URL(requestUrl.searchParams.get('url') || '');
    if (target.protocol !== 'https:' || target.hostname !== 'query1.finance.yahoo.com') {
      response.writeHead(400, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ error: 'Destino financiero no permitido.' }));
      return;
    }

    const upstream = await fetch(target, { signal: AbortSignal.timeout(10000) });
    const body = await upstream.text();
    response.writeHead(upstream.status, { 'Content-Type': upstream.headers.get('content-type') || 'application/json' });
    response.end(body);
  } catch (error) {
    response.writeHead(502, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ error: `No se pudo consultar Yahoo Finance: ${error.message}` }));
  }
});
const wss = new WebSocketServer({ server });

let activeConnections = 0;
let timeout = null;
let initialTimeout = null;

// Sincronización opcional. Está desactivada por defecto para no crear commits al cerrar.
const saveAndPushToGitHub = () => {
  console.log('Guardando cambios y subiendo a GitHub...');
  try {
    execSync('git add .', { cwd: APP_DIR, stdio: 'inherit' });
    // Solo hace commit si hay cambios en los archivos versionados
    const status = execSync('git status --porcelain', { cwd: APP_DIR }).toString().trim();
    if (status) {
      execSync('git commit -m "Auto-backup: actualización automática al cerrar aplicación"', { cwd: APP_DIR, stdio: 'inherit' });
      execSync('git push origin main', { cwd: APP_DIR, stdio: 'inherit' });
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
        const existing = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
        if (hasSubstantiveData(existing) && !hasSubstantiveData(data.payload)) {
          console.warn('Se rechazó una sesión vacía para no reemplazar la base de datos existente.');
        } else {
          writeDatabase(data.payload);
          console.log('Base de datos local actualizada.');
        }
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
        stopVite();
        if (AUTO_GIT_SYNC_ENABLED) saveAndPushToGitHub();
        process.exit();
      }, 3000);
    }
  });
});

const normalizeSource = value => value.replace(/\r\n/g, '\n').trim();

const probeVite = async baseUrl => {
  const options = { signal: AbortSignal.timeout(2000) };
  const pageResponse = await fetch(baseUrl, options);
  if (!pageResponse.ok) throw new Error(`La página respondió HTTP ${pageResponse.status}.`);
  const page = await pageResponse.text();
  if (!page.includes('id="root"') || !page.includes('/src/main.tsx')) {
    throw new Error('Vite respondió, pero no entregó la aplicación esperada.');
  }

  const entryResponse = await fetch(new URL('/src/main.tsx', baseUrl), options);
  if (!entryResponse.ok) throw new Error(`El módulo principal respondió HTTP ${entryResponse.status}.`);
  const transformedEntry = await entryResponse.text();
  const sourceEntry = fs.readFileSync(path.join(APP_DIR, 'src', 'main.tsx'), 'utf8');
  if (normalizeSource(transformedEntry) === normalizeSource(sourceEntry)) {
    throw new Error('Vite entregó main.tsx sin transformarlo. Revisá la ruta redirigida del proyecto.');
  }
};

const waitForVite = async (url, timeoutMs = 60000) => {
  const startedAt = Date.now();
  let lastError = null;
  while (Date.now() - startedAt < timeoutMs) {
    if (viteExited) throw new Error('Vite terminó antes de quedar disponible.');
    try {
      await probeVite(url);
      return;
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  const detail = lastError instanceof Error ? ` Último error: ${lastError.message}` : '';
  throw new Error(`Vite no quedó listo después de ${timeoutMs / 1000} segundos.${detail}`);
};

server.listen(WEBSOCKET_PORT, async () => {
  try {
    await waitForVite('http://localhost:5173');
    await open('http://localhost:5173');
    initialTimeout = setTimeout(() => {
      if (activeConnections === 0) {
        console.log('No se detectaron conexiones al navegador. Cerrando...');
        stopVite();
        if (AUTO_GIT_SYNC_ENABLED) saveAndPushToGitHub();
        process.exit();
      }
    }, 15000);
  } catch (error) {
    console.error('No se pudo iniciar la aplicación:', error.message);
    stopVite();
    server.close(() => process.exit(1));
  }
});
