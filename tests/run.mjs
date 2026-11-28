#!/usr/bin/env node
// @ts-check
// Lanzador de las pruebas de extremo a extremo (Playwright). Arranca lo que cada grupo necesita
// (servidor de la app, web compilada, emuladores de Firebase, pantalla virtual para Electron),
// ejecuta las pruebas una a una, guarda cada salida en tests/e2e/logs/ y resume el resultado.
//
//   node tests/run.mjs                 → grupos app y web
//   node tests/run.mjs app nube        → grupos concretos (app, nube, web, escritorio)
//   node tests/run.mjs adjuntos qr     → pruebas sueltas (nombre del archivo sin .js)
//   node tests/run.mjs --lista         → enseña los grupos y sus pruebas
//
// Variables: WHIDER_URL (app ya servida), WHIDER_WEB_URL (web compilada ya servida),
// WHIDER_PRUEBA_MIN (minutos por prueba; 8 por defecto).
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const E2E = path.join(RAIZ, 'tests', 'e2e');
const LOGS = path.join(E2E, 'logs');
const MIN = Number(process.env.WHIDER_PRUEBA_MIN || 8);

export const GRUPOS = {
  // La app en el navegador con datos locales (python3 serve.py)
  app: [
    'recorrido',
    'sin-premium',
    'sin-gamificacion',
    'copia-cuaderno',
    'barra-inferior',
    'menu-teclado',
    'menu-desplazamiento',
    'qr',
    'menu-bloques',
    'adjuntos',
    'accesibilidad',
    'uso-diario',
    'importar',
    'novedades',
    'instalar',
    'copias',
    'tema',
    'ingles',
    'calendarios',
    'planificar',
    'rediseno',
    'revision'
  ],
  // Cuentas, sincronización y comunidad contra los emuladores de Firebase
  nube: [
    'entrar',
    'comunidad',
    'eliminar-cuenta',
    'adjuntos-nube',
    'adjuntos-storage',
    'version-1',
    'sincronizacion',
    'tiempo-real',
    'seguridad',
    'ayuda'
  ],
  // La web tal y como se publica en Vercel (dist/)
  web: ['web-recorrido', 'web-portada', 'web-accesibilidad'],
  // La app de escritorio (Electron); necesita «npm ci» dentro de desktop/
  escritorio: ['escritorio', 'escritorio-adjuntos', 'escritorio-actualizaciones', 'escritorio-copias']
};
const NECESITA = {
  app: ['app'],
  nube: ['app', 'emuladores'],
  web: ['web'],
  escritorio: ['escritorio']
};

const hijos = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function puertoAbierto(port, host = '127.0.0.1') {
  return new Promise((res) => {
    const s = net.connect({ port, host });
    s.once('connect', () => {
      s.destroy();
      res(true);
    });
    s.once('error', () => res(false));
    s.setTimeout(1500, () => {
      s.destroy();
      res(false);
    });
  });
}

async function esperarPuerto(port, segundos, nombre) {
  const fin = Date.now() + segundos * 1000;
  while (Date.now() < fin) {
    if (await puertoAbierto(port)) return;
    await sleep(500);
  }
  throw new Error(nombre + ': no responde en el puerto ' + port + ' tras ' + segundos + ' s');
}

function lanzar(nombre, cmd, args, opts = {}) {
  const log = fs.openSync(path.join(LOGS, '_' + nombre + '.log'), 'w');
  const p = spawn(cmd, args, {
    cwd: RAIZ,
    stdio: ['ignore', log, log],
    detached: process.platform !== 'win32',
    ...opts
  });
  p.on('error', (e) => console.error('No se pudo iniciar ' + nombre + ':', e.message));
  hijos.push({ nombre, p });
  return p;
}

function parar() {
  for (const { p } of hijos.reverse()) {
    try {
      // Grupo de procesos entero: los emuladores de Firebase abren Java aparte
      if (process.platform !== 'win32') process.kill(-p.pid, 'SIGTERM');
      else p.kill();
    } catch {
      /* ya terminado */
    }
  }
}
process.on('SIGINT', () => {
  parar();
  process.exit(130);
});

const preparado = {};
async function preparar(que) {
  if (preparado[que]) return preparado[que];
  preparado[que] = (async () => {
    if (que === 'app') {
      if (process.env.WHIDER_URL) return;
      if (await puertoAbierto(8642)) {
        console.log('· App: uso el servidor que ya está en :8642');
        return;
      }
      console.log('· App: arranco python3 serve.py 8642');
      lanzar('servidor-app', 'python3', ['serve.py', '8642', '--no-open']);
      await esperarPuerto(8642, 20, 'serve.py');
    } else if (que === 'web') {
      if (process.env.WHIDER_WEB_URL) return;
      console.log('· Web: compilo dist/ (node tools/web-build.js)');
      const r = spawnSync(process.execPath, ['tools/web-build.js'], { cwd: RAIZ, stdio: 'inherit' });
      if (r.status !== 0) throw new Error('falló la compilación de la web');
      if (await puertoAbierto(8650)) {
        console.log('· Web: uso el servidor que ya está en :8650');
        return;
      }
      lanzar('servidor-web', 'python3', ['-I', 'tools/servir-web.py', '.', '8650']);
      await esperarPuerto(8650, 20, 'servir-web.py');
    } else if (que === 'emuladores') {
      const [a, f, s] = [await puertoAbierto(9099), await puertoAbierto(8085), await puertoAbierto(9199)];
      if (a && f && s) {
        console.log('· Firebase: uso los emuladores que ya están en marcha');
        return;
      }
      if (a || f || s)
        throw new Error(
          'hay emuladores de Firebase a medias (hacen falta Auth, Firestore y Storage): páralos y vuelve a probar'
        );
      const fb = path.join(RAIZ, 'node_modules', '.bin', process.platform === 'win32' ? 'firebase.cmd' : 'firebase');
      if (!fs.existsSync(fb)) throw new Error('faltan las herramientas de Firebase: ejecuta «npm ci» en la raíz');
      console.log('· Firebase: arranco los emuladores de Auth, Firestore y Storage (necesita Java)');
      lanzar('emuladores', fb, ['emulators:start', '--only', 'auth,firestore,storage', '--project', 'demo-whider']);
      await esperarPuerto(9099, 120, 'emulador de Auth');
      await esperarPuerto(8085, 120, 'emulador de Firestore');
      await esperarPuerto(9199, 120, 'emulador de Storage');
    } else if (que === 'escritorio') {
      const el = path.join(
        RAIZ,
        'desktop',
        'node_modules',
        '.bin',
        process.platform === 'win32' ? 'electron.cmd' : 'electron'
      );
      if (!fs.existsSync(el)) return 'omitido: falta Electron (ejecuta «npm ci» dentro de desktop/)';
      // La app de escritorio lleva dentro una copia de la web: se actualiza antes de probar
      const r = spawnSync(process.execPath, ['scripts/sync-web.js'], {
        cwd: path.join(RAIZ, 'desktop'),
        stdio: 'ignore'
      });
      if (r.status !== 0) throw new Error('no se pudo copiar la web a desktop/www');
    }
  })();
  return preparado[que];
}

function ejecutar(nombre) {
  return new Promise((res) => {
    const archivo = path.join(E2E, nombre + '.js');
    const log = path.join(LOGS, nombre + '.log');
    let cmd = process.execPath,
      args = [archivo];
    // Electron necesita una pantalla: en Linux sin escritorio, una virtual
    if (GRUPOS.escritorio.includes(nombre) && process.platform === 'linux' && !process.env.DISPLAY) {
      cmd = 'xvfb-run';
      args = ['-a', process.execPath, archivo];
    }
    const t0 = Date.now();
    const p = spawn(cmd, args, { cwd: E2E, env: process.env });
    let out = '';
    p.stdout.on('data', (d) => {
      out += d;
    });
    p.stderr.on('data', (d) => {
      out += d;
    });
    const reloj = setTimeout(() => {
      out += '\nFAIL tiempo agotado (' + MIN + ' min)\n';
      p.kill('SIGKILL');
    }, MIN * 60000);
    p.on('close', (code) => {
      clearTimeout(reloj);
      fs.writeFileSync(log, out);
      const fallos = out.split('\n').filter((l) => /^\s*FAIL\b/.test(l));
      res({ nombre, code, fallos, s: Math.round((Date.now() - t0) / 1000), ok: code === 0 && !fallos.length });
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--lista')) {
    for (const [g, l] of Object.entries(GRUPOS)) console.log(g.padEnd(11) + l.join(', '));
    return 0;
  }
  const pedidos = args.length ? args : ['app', 'web'];
  const cola = [];
  for (const a of pedidos) {
    if (GRUPOS[a]) GRUPOS[a].forEach((n) => cola.push([a, n]));
    else {
      const g = Object.keys(GRUPOS).find((k) => GRUPOS[k].includes(a));
      if (!g) {
        console.error('No conozco «' + a + '». Usa --lista para ver los grupos y las pruebas.');
        return 2;
      }
      cola.push([g, a]);
    }
  }
  fs.mkdirSync(LOGS, { recursive: true });
  const resultados = [];
  for (const [g, n] of cola) {
    let omitido = null;
    try {
      for (const q of NECESITA[g]) omitido = (await preparar(q)) || omitido;
    } catch (e) {
      resultados.push({ nombre: n, ok: false, fallos: ['FAIL ' + e.message], s: 0, code: -1 });
      console.log('FALLA   ' + n.padEnd(22) + e.message);
      continue;
    }
    if (omitido) {
      resultados.push({ nombre: n, ok: true, omitido, fallos: [], s: 0 });
      console.log('OMITIDA ' + n.padEnd(22) + omitido);
      continue;
    }
    const r = await ejecutar(n);
    resultados.push(r);
    console.log(
      (r.ok ? 'BIEN    ' : 'FALLA   ') +
        n.padEnd(22) +
        String(r.s).padStart(4) +
        ' s' +
        (r.ok
          ? ''
          : '   (salida ' +
            r.code +
            ', ' +
            r.fallos.length +
            ' comprobaciones fallidas → tests/e2e/logs/' +
            n +
            '.log)')
    );
    for (const f of r.fallos.slice(0, 5)) console.log('          ' + f.trim().slice(0, 160));
  }
  parar();
  const mal = resultados.filter((r) => !r.ok);
  const omitidas = resultados.filter((r) => r.omitido).length;
  console.log(
    '\n' +
      (resultados.length - mal.length - omitidas) +
      ' bien, ' +
      mal.length +
      ' fallidas' +
      (omitidas ? ', ' + omitidas + ' omitidas' : '') +
      ' (' +
      resultados.length +
      ' pruebas). Registros en tests/e2e/logs/'
  );
  return mal.length ? 1 : 0;
}

main().then(
  (c) => {
    parar();
    process.exit(c);
  },
  (e) => {
    console.error(e);
    parar();
    process.exit(2);
  }
);
