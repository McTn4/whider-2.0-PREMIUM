// El servidor de los calendarios suscritos (api/calendario.js): qué direcciones acepta, que no llegue a la red
// interna, redirecciones, tamaño, tiempo, formato, recorte de lo antiguo y la respuesta HTTP. Sin red de verdad.
const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const { PassThrough } = require('node:stream');
const { EventEmitter } = require('node:events');
const handler = require('../../api/calendario.js');
const { normalize, privateV4, safeLookup, fetchCalendar, trimOld, limiter } = handler._internos;

const ICS =
  'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:1\r\nDTSTART:20261120T090000Z\r\nSUMMARY:Hola\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n';
const codigo = (fn) => {
  try {
    fn();
  } catch (e) {
    return e.code;
  }
  return 'ok';
};

/** Una «red» de mentira: { 'host/ruta': { status, headers, body } | 'cuelga' } */
function red(rutas, visto) {
  return (opts, onRes) => {
    const req = new EventEmitter();
    req.destroy = () => {};
    req.end = () => {
      if (visto) visto.push(opts);
      const r = rutas[opts.hostname + opts.path];
      setImmediate(() => {
        if (!r) return req.emit('error', Object.assign(new Error('no existe'), { code: 'ENOTFOUND' }));
        if (r === 'cuelga') return;
        const res = new PassThrough();
        res.statusCode = r.status;
        res.headers = r.headers || {};
        onRes(res);
        res.end(r.body || '');
      });
    };
    return req;
  };
}

test('direcciones: https y webcal sí; http, usuario, otro puerto, IP y nombres internos no', () => {
  assert.equal(
    normalize('https://calendar.google.com/calendar/ical/x/basic.ics').href,
    'https://calendar.google.com/calendar/ical/x/basic.ics'
  );
  assert.equal(
    normalize('webcal://p01-caldav.icloud.com/published/2/abc').href,
    'https://p01-caldav.icloud.com/published/2/abc'
  );
  assert.equal(normalize('  https://outlook.office365.com/owa/calendar/a/b/calendar.ics#x ').hash, '');
  assert.equal(
    codigo(() => normalize('http://example.com/a.ics')),
    'url'
  );
  assert.equal(
    codigo(() => normalize('ftp://example.com/a.ics')),
    'url'
  );
  assert.equal(
    codigo(() => normalize('https://ana:clave@example.com/a.ics')),
    'url'
  );
  assert.equal(
    codigo(() => normalize('https://example.com:8443/a.ics')),
    'blocked'
  );
  assert.equal(
    codigo(() => normalize('https://127.0.0.1/a.ics')),
    'blocked'
  );
  assert.equal(
    codigo(() => normalize('https://[::1]/a.ics')),
    'blocked'
  );
  assert.equal(
    codigo(() => normalize('https://localhost/a.ics')),
    'blocked'
  );
  assert.equal(
    codigo(() => normalize('https://nas.local/a.ics')),
    'blocked'
  );
  assert.equal(
    codigo(() => normalize('https://metadata.google.internal/x')),
    'blocked'
  );
  assert.equal(
    codigo(() => normalize('https://intranet/a.ics')),
    'blocked'
  );
  assert.equal(
    codigo(() => normalize('https://x.com/' + 'a'.repeat(3000))),
    'url'
  );
  assert.equal(
    codigo(() => normalize(42)),
    'url'
  );
  assert.equal(
    codigo(() => normalize('')),
    'url'
  );
});

test('direcciones IP privadas, locales y reservadas', () => {
  [
    '10.1.2.3',
    '127.0.0.1',
    '169.254.169.254',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.10',
    '100.64.0.1',
    '0.0.0.0',
    '224.0.0.1',
    '255.255.255.255',
    '198.18.0.1',
    'x.y',
    '1.2.3'
  ].forEach((ip) => assert.equal(privateV4(ip), true, ip));
  ['8.8.8.8', '142.250.184.14', '52.97.1.1', '172.32.0.1', '100.128.0.1'].forEach((ip) =>
    assert.equal(privateV4(ip), false, ip)
  );
});

test('la conexión solo se hace con direcciones públicas (la misma que se comprueba)', async () => {
  const resolver = (ips) => (host, opts, cb) =>
    cb(
      null,
      ips.map((address) => ({ address, family: 4 }))
    );
  const una = (fn, ...a) => new Promise((res) => fn(...a, (err, addr, fam) => res({ err, addr, fam })));
  const pub = safeLookup(resolver(['93.184.216.34']));
  assert.deepEqual(await una(pub, 'example.com', {}), { err: null, addr: '93.184.216.34', fam: 4 });
  const todas = await una(pub, 'example.com', { all: true });
  assert.deepEqual(todas.addr, [{ address: '93.184.216.34', family: 4 }]);
  const mezcla = await una(safeLookup(resolver(['93.184.216.34', '10.0.0.5'])), 'rebind.example', {});
  assert.equal(mezcla.err && mezcla.err.code, 'blocked', 'si alguna es privada, ninguna');
  const vacia = await una(safeLookup(resolver([])), 'nada.example', {});
  assert.equal(vacia.err && vacia.err.code, 'blocked');
});

test('descarga: directa, con redirecciones comprobadas, comprimida y con errores claros', async () => {
  const visto = [];
  const rutas = {
    'cal.example/a.ics': { status: 200, body: ICS },
    'cal.example/r1': { status: 302, headers: { location: '/a.ics' } },
    'cal.example/r-http': { status: 301, headers: { location: 'http://cal.example/a.ics' } },
    'cal.example/r-ip': { status: 307, headers: { location: 'https://10.0.0.1/a.ics' } },
    'cal.example/gz': { status: 200, headers: { 'content-encoding': 'gzip' }, body: zlib.gzipSync(ICS) },
    'cal.example/404': { status: 404 },
    'cal.example/html': { status: 200, body: '<!doctype html><title>Inicia sesión</title>' },
    'cal.example/grande': { status: 200, body: 'BEGIN:VCALENDAR\r\n' + 'X'.repeat(13 * 1024 * 1024) },
    'cal.example/cuelga': 'cuelga'
  };
  const deps = { request: red(rutas, visto), timeout: 80 };
  assert.equal(await fetchCalendar('https://cal.example/a.ics', deps), ICS);
  assert.equal(typeof visto[0].lookup, 'function', 'siempre con la resolución que comprueba');
  assert.equal(visto[0].port, 443);
  assert.equal(await fetchCalendar('webcal://cal.example/r1', deps), ICS);
  assert.equal(await fetchCalendar('https://cal.example/gz', deps), ICS);
  const err = async (u) => {
    try {
      await fetchCalendar(u, deps);
      return 'ok';
    } catch (e) {
      return e.code + (e.upstream ? ':' + e.upstream : '');
    }
  };
  assert.equal(await err('https://cal.example/r-http'), 'url', 'una redirección a http no se sigue');
  assert.equal(await err('https://cal.example/r-ip'), 'blocked', 'ni a una IP privada');
  assert.equal(await err('https://cal.example/404'), 'status:404');
  assert.equal(await err('https://cal.example/html'), 'format', 'una página web no es un calendario');
  assert.equal(await err('https://cal.example/grande'), 'size');
  assert.equal(await err('https://cal.example/cuelga'), 'timeout');
  assert.equal(await err('https://no-existe.example/a.ics'), 'network');
});

test('los calendarios grandes pierden los eventos antiguos que no se repiten', () => {
  const ev = (uid, start, extra) =>
    'BEGIN:VEVENT\r\nUID:' + uid + '\r\nDTSTART:' + start + '\r\n' + (extra || '') + 'END:VEVENT\r\n';
  const text =
    'BEGIN:VCALENDAR\r\n' +
    ev('viejo', '20200105T100000Z') +
    ev('serie', '20190101', 'RRULE:FREQ=YEARLY\r\n') +
    ev('cambio', '20200105T100000Z', 'RECURRENCE-ID:20200105T100000Z\r\n') +
    ev('nuevo', '20261120T090000Z') +
    'END:VCALENDAR\r\n';
  const out = trimOld(text, Date.UTC(2026, 10, 20));
  assert.ok(!/UID:viejo/.test(out));
  assert.ok(/UID:serie/.test(out) && /UID:cambio/.test(out) && /UID:nuevo/.test(out));
  assert.ok(/^BEGIN:VCALENDAR/.test(out) && /END:VCALENDAR\r\n$/.test(out));
});

test('límite por dirección IP', () => {
  const ok = limiter(3, 1000);
  assert.deepEqual(
    [ok('a', 1), ok('a', 2), ok('a', 3), ok('a', 4), ok('b', 4), ok('a', 1200)],
    [true, true, true, false, true, true]
  );
});

/** Petición y respuesta HTTP mínimas para llamar a la función */
function llamar(method, headers, body) {
  const req = new EventEmitter();
  Object.assign(req, { method, headers: Object.assign({ host: 'whider-red.vercel.app' }, headers || {}), body });
  const res = { statusCode: 0, headers: {}, body: '' };
  res.setHeader = (k, v) => {
    res.headers[k.toLowerCase()] = v;
  };
  return new Promise((resolve) => {
    res.end = (b) => {
      res.body = b ? String(b) : '';
      resolve(res);
    };
    handler(req, res);
  });
}

test('la función: CORS solo para la app, POST, sin caché y errores en JSON', async () => {
  handler.deps = { request: red({ 'cal.example/a.ics': { status: 200, body: ICS } }) };
  try {
    const pre = await llamar('OPTIONS', { origin: 'https://appassets.androidplatform.net' });
    assert.equal(pre.statusCode, 204);
    assert.equal(pre.headers['access-control-allow-origin'], 'https://appassets.androidplatform.net');
    const otra = await llamar('OPTIONS', { origin: 'https://otra-web.example' });
    assert.equal(
      otra.headers['access-control-allow-origin'],
      undefined,
      'otras webs no pueden usarla desde el navegador'
    );
    handler.deps = {
      request: red({
        'cal.example/a.ics': { status: 200, body: ICS },
        'calendar.google.com/calendar/ical/es.spain%23holiday%40group.v.calendar.google.com/public/basic.ics': {
          status: 200,
          body: ICS
        }
      })
    };
    const prueba = await llamar('GET', { 'x-real-ip': '1.1.1.9' });
    const salud = await new Promise((resolve) => {
      const req = new EventEmitter();
      Object.assign(req, {
        method: 'GET',
        url: '/api/calendario?comprobar',
        headers: { host: 'whider-red.vercel.app', 'x-real-ip': '1.1.1.8' }
      });
      const res = {
        statusCode: 0,
        headers: {},
        setHeader: (k, v) => (res.headers[k.toLowerCase()] = v),
        end: (b) => resolve({ status: res.statusCode, body: String(b || '') })
      };
      handler(req, res);
    });
    assert.equal(salud.status, 200);
    assert.deepEqual(
      JSON.parse(salud.body),
      { ok: true, events: 1 },
      'GET ?comprobar: trae el calendario fijo y dice cuántos eventos tiene'
    );
    assert.equal(prueba.statusCode, 405, 'sin ?comprobar, GET no vale');
    const get = await llamar('GET', {});
    assert.equal(get.statusCode, 405);
    assert.deepEqual(JSON.parse(get.body), { error: 'method' });
    const ok = await llamar(
      'POST',
      { origin: 'https://whider-red.vercel.app', 'x-real-ip': '1.1.1.1' },
      { url: 'https://cal.example/a.ics' }
    );
    assert.equal(ok.statusCode, 200);
    assert.equal(ok.body, ICS);
    assert.match(ok.headers['content-type'], /^text\/calendar/);
    assert.equal(ok.headers['cache-control'], 'no-store');
    assert.equal(ok.headers['x-content-type-options'], 'nosniff');
    assert.equal(ok.headers['access-control-allow-origin'], 'https://whider-red.vercel.app', 'la propia web');
    const mal = await llamar('POST', { 'x-real-ip': '1.1.1.2' }, { url: 'http://cal.example/a.ics' });
    assert.equal(mal.statusCode, 400);
    assert.deepEqual(JSON.parse(mal.body), { error: 'url' });
    const roto = await llamar('POST', { 'x-real-ip': '1.1.1.3' }, '{no es json');
    assert.deepEqual(JSON.parse(roto.body), { error: 'url' });
  } finally {
    handler.deps = null;
  }
});
