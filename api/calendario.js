// @ts-check
/**
 * WHIDER · Calendarios suscritos: trae un calendario (.ics) de Google, Outlook, Apple… para la app.
 *
 * Los navegadores no dejan que una web lea un calendario de otro sitio (CORS), así que la app se lo pide a esta función
 * (Vercel), que lo descarga y se lo devuelve tal cual. No guarda nada y no escribe la dirección en ningún registro: la
 * dirección secreta de un calendario da acceso a él (por eso va en el cuerpo de la petición y no en la URL).
 *
 *   POST /api/calendario  { "url": "https://…/basic.ics" }  →  200 text/calendar  ·  4xx/5xx { "error": "código" }
 *
 * Para que no sirva para otra cosa: solo https (webcal:// se trata como https), sin usuario ni contraseña, puerto 443,
 * solo nombres de dominio que llevan a direcciones públicas (se comprueba la dirección con la que se conecta de verdad,
 * también tras cada redirección), como mucho 4 redirecciones, 8 segundos y 12 MB, y lo que llega tiene que ser un
 * calendario (BEGIN:VCALENDAR). Un límite por dirección IP frena el abuso. Pruebas: tests/unit/calendario-api.test.js.
 */
'use strict';
const dns = require('node:dns');
const net = require('node:net');
const https = require('node:https');
const zlib = require('node:zlib');

const MAX_DOWNLOAD = 12 * 1024 * 1024; // lo descargado, ya descomprimido
const MAX_REPLY = 4 * 1024 * 1024; // lo devuelto (Vercel no admite respuestas de más de 4,5 MB)
const TRIM_FROM = 1024 * 1024; // a partir de aquí se quitan los eventos antiguos que no se repiten
const KEEP_DAYS = 400;
const TIMEOUT = 8000;
const MAX_REDIRECTS = 4;
const MAX_URL = 2048;
// Además de la propia web (mismo dominio): la app de Android (WebViewAssetLoader) y la del ordenador (app://whider)
const ORIGINS = ['https://appassets.androidplatform.net', 'app://whider'];
const CHECK_URL =
  'https://calendar.google.com/calendar/ical/es.spain%23holiday%40group.v.calendar.google.com/public/basic.ics';
const STATUS = {
  url: 400,
  blocked: 400,
  method: 405,
  busy: 429,
  status: 502,
  network: 502,
  timeout: 504,
  size: 413,
  format: 422
};

/** @param {string} code */
function fail(code, extra) {
  return Object.assign(new Error(code), { code: code }, extra || {});
}

/** ¿Dirección IPv4 privada, local o reservada? (todo lo que no sea Internet público) */
function privateV4(ip) {
  const p = String(ip).split('.').map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b, c] = p;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) || // enlace local (y los metadatos de las nubes)
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113)
  );
}

/**
 * Dirección que da la persona → URL https comprobada, o error 'url' / 'blocked'.
 * @param {unknown} raw
 */
function normalize(raw) {
  let s = typeof raw === 'string' ? raw.trim() : '';
  if (!s || s.length > MAX_URL) throw fail('url');
  s = s.replace(/^webcals?:\/\//i, 'https://');
  let u;
  try {
    u = new URL(s);
  } catch (e) {
    throw fail('url');
  }
  if (u.protocol !== 'https:') throw fail('url');
  if (u.username || u.password) throw fail('url');
  if (u.port && u.port !== '443') throw fail('blocked');
  const host = u.hostname.toLowerCase().replace(/\.$/, '');
  if (!host || net.isIP(host.replace(/^\[|\]$/g, '')) || host.indexOf('.') < 0) throw fail('blocked');
  if (/(^|\.)(localhost|local|internal|intranet|lan|home|corp|localdomain|home\.arpa)$/.test(host))
    throw fail('blocked');
  u.hash = '';
  return u;
}

/**
 * Resolución de nombres que solo deja conectar con direcciones públicas (IPv4). Es la que usa la conexión, así que
 * no hay hueco entre comprobar y conectar (otra resolución del mismo nombre podría dar otra dirección).
 */
function safeLookup(resolve) {
  return function (hostname, options, cb) {
    if (typeof options === 'function') {
      cb = options;
      options = {};
    }
    (resolve || dns.lookup)(hostname, { family: 4, all: true }, (err, addrs) => {
      if (err) return cb(err);
      const list = Array.isArray(addrs) ? addrs : [];
      if (!list.length || list.some((a) => privateV4(a.address))) return cb(fail('blocked'));
      if (options && options.all)
        return cb(
          null,
          list.map((a) => ({ address: a.address, family: 4 }))
        );
      cb(null, list[0].address, 4);
    });
  };
}

/** Una petición GET: { status, location, body } con el cuerpo descomprimido y limitado */
function getOnce(u, deps) {
  return new Promise((resolve, reject) => {
    let done = false;
    const finish = (fn, v) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      fn(v);
    };
    const req = (deps.request || https.request)(
      {
        protocol: 'https:',
        hostname: u.hostname,
        servername: u.hostname,
        port: 443,
        path: u.pathname + u.search,
        method: 'GET',
        lookup: deps.lookup || safeLookup(),
        headers: {
          'User-Agent': 'WHIDER-Calendarios/1.0 (+https://github.com/McTn4/whider-2.0-PREMIUM)',
          Accept: 'text/calendar, text/plain;q=0.8, */*;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br'
        }
      },
      (res) => {
        const status = res.statusCode || 0;
        if (status >= 300 && status < 400) {
          res.resume();
          return finish(resolve, { status: status, location: res.headers.location || '', body: Buffer.alloc(0) });
        }
        if (status !== 200) {
          res.resume();
          return finish(resolve, { status: status, location: '', body: Buffer.alloc(0) });
        }
        const enc = String(res.headers['content-encoding'] || '').toLowerCase();
        const stream =
          enc === 'gzip'
            ? res.pipe(zlib.createGunzip())
            : enc === 'deflate'
              ? res.pipe(zlib.createInflate())
              : enc === 'br'
                ? res.pipe(zlib.createBrotliDecompress())
                : res;
        const chunks = [];
        let size = 0;
        stream.on('data', (c) => {
          size += c.length;
          if (size > MAX_DOWNLOAD) {
            req.destroy();
            finish(reject, fail('size'));
          } else chunks.push(c);
        });
        stream.on('end', () => finish(resolve, { status: 200, location: '', body: Buffer.concat(chunks) }));
        stream.on('error', () => finish(reject, fail('network')));
      }
    );
    const timer = setTimeout(() => {
      req.destroy();
      finish(reject, fail('timeout'));
    }, deps.timeout || TIMEOUT);
    req.on('error', (e) =>
      finish(reject, e && e.code === 'blocked' ? e : fail(e && e.code === 'ETIMEDOUT' ? 'timeout' : 'network'))
    );
    req.end();
  });
}

/** Descarga el calendario siguiendo redirecciones (cada una se vuelve a comprobar). Devuelve su texto. */
async function fetchCalendar(raw, deps) {
  deps = deps || {};
  let u = normalize(raw);
  for (let hops = 0; hops <= MAX_REDIRECTS; hops++) {
    const r = await getOnce(u, deps);
    if (r.status >= 300 && r.status < 400) {
      if (!r.location || hops === MAX_REDIRECTS) throw fail('status', { upstream: r.status });
      let next;
      try {
        next = new URL(r.location, u);
      } catch (e) {
        throw fail('status', { upstream: r.status });
      }
      u = normalize(next.href);
      continue;
    }
    if (r.status !== 200) throw fail('status', { upstream: r.status });
    const text = r.body.toString('utf8').replace(/^\uFEFF/, '');
    if (!/^\s*BEGIN:VCALENDAR/i.test(text.slice(0, 1024))) throw fail('format');
    const out = text.length > TRIM_FROM ? trimOld(text, deps.now ? deps.now() : Date.now()) : text;
    if (Buffer.byteLength(out) > MAX_REPLY) throw fail('size');
    return out;
  }
  throw fail('status');
}

/**
 * Los calendarios grandes son sobre todo historia: se quitan los eventos de hace más de 400 días que no se repiten
 * (los que se repiten y sus excepciones se quedan, porque pueden seguir apareciendo).
 */
function trimOld(text, now) {
  const d = new Date(now - KEEP_DAYS * 86400000);
  const cut = d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
  return text.replace(/BEGIN:VEVENT[\s\S]*?END:VEVENT(\r?\n)?/g, (block) => {
    if (/\n(RRULE|RECURRENCE-ID)[;:]/i.test(block)) return block;
    const m = block.match(/\nDTSTART[^:\n]*:(\d{8})/i);
    return m && +m[1] < cut ? '' : block;
  });
}

/** Límite por dirección IP (en cada instancia de la función): 60 peticiones cada 10 minutos */
function limiter(max, windowMs) {
  const seen = new Map();
  return function (key, now) {
    const t = now || Date.now();
    const cur = seen.get(key);
    if (!cur || t > cur.reset) {
      if (seen.size > 5000) seen.clear();
      seen.set(key, { n: 1, reset: t + windowMs });
      return true;
    }
    cur.n++;
    return cur.n <= max;
  };
}
const allow = limiter(60, 10 * 60 * 1000);

/** El cuerpo de la petición: el que ya preparó Vercel o, si no, leído (como mucho 8 KB) */
function readBody(req) {
  let ready;
  try {
    ready = req.body; // en Vercel es un «getter» que falla si el JSON está mal escrito
  } catch (e) {
    return Promise.resolve({});
  }
  if (ready && typeof ready === 'object' && !Buffer.isBuffer(ready)) return Promise.resolve(ready);
  if (typeof ready === 'string') return Promise.resolve(parse(ready));
  if (Buffer.isBuffer(ready)) return Promise.resolve(parse(ready.toString('utf8')));
  return new Promise((resolve) => {
    let s = '';
    req.on('data', (c) => {
      s += c;
      if (s.length > 8192) {
        s = '';
        req.destroy();
      }
    });
    req.on('end', () => resolve(parse(s)));
    req.on('error', () => resolve({}));
  });
}
function parse(s) {
  try {
    return JSON.parse(s) || {};
  } catch (e) {
    return {};
  }
}

function cors(req, res) {
  const origin = String(req.headers.origin || '');
  let same;
  try {
    same = !!origin && new URL(origin).host === String(req.headers.host || '');
  } catch (e) {
    same = false;
  }
  if (origin && (same || ORIGINS.indexOf(origin) >= 0)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
}
function reply(res, status, type, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', type);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(body);
}
function error(res, code, extra) {
  reply(
    res,
    STATUS[code] || 500,
    'application/json; charset=utf-8',
    JSON.stringify(Object.assign({ error: code }, extra || {}))
  );
}

async function handler(req, res) {
  cors(req, res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }
  const ip = String(
    req.headers['x-real-ip'] || String(req.headers['x-forwarded-for'] || '').split(',')[0] || 'anon'
  ).trim();
  // GET /api/calendario?comprobar: prueba de que la función llega a Internet, siempre con el mismo calendario público
  // (los festivos de España de Google). No acepta otra dirección; dice cuántos eventos trae, no los devuelve.
  if (req.method === 'GET' && /[?&]comprobar(=|&|$)/.test(String(req.url || ''))) {
    if (!allow(ip)) return error(res, 'busy');
    try {
      const ics = await fetchCalendar(CHECK_URL, handler.deps || {});
      const events = (ics.match(/BEGIN:VEVENT/g) || []).length;
      return reply(res, 200, 'application/json; charset=utf-8', JSON.stringify({ ok: true, events: events }));
    } catch (e) {
      return error(res, e && STATUS[e.code] ? e.code : 'network', e && e.upstream ? { upstream: e.upstream } : null);
    }
  }
  if (req.method !== 'POST') return error(res, 'method');
  if (!allow(ip)) return error(res, 'busy');
  const body = await readBody(req);
  try {
    const ics = await fetchCalendar(body && body.url, handler.deps || {});
    reply(res, 200, 'text/calendar; charset=utf-8', ics);
  } catch (e) {
    const code = e && STATUS[e.code] ? e.code : 'network';
    // Solo el código: nunca la dirección (lleva la clave del calendario)
    if (code === 'network' || code === 'timeout') console.warn('calendario: ' + code);
    error(res, code, e && e.upstream ? { upstream: e.upstream } : null);
  }
}

/** Solo para las pruebas: otra forma de conectar (request, lookup, now, timeout) */
handler.deps = null;

module.exports = handler;
module.exports._internos = { normalize, privateV4, safeLookup, fetchCalendar, trimOld, limiter, MAX_REPLY };
