/**
 * WHIDER · Activación automática de Premium al pagar con Stripe (función de Vercel).
 *
 * Stripe avisa aquí (webhook) cuando alguien paga. Si la firma del aviso es buena, se guarda en
 * Firestore el derecho a Premium de la cuenta que pagó (entitlements/{uid}, con el uid que la app
 * manda a Stripe como client_reference_id). La app lo lee al volver del pago y activa Premium sola.
 *
 * Variables de entorno (se ponen en Vercel → Settings → Environment Variables; nunca en el código):
 *   STRIPE_WEBHOOK_SECRET     secreto de firma del webhook de Stripe (whsec_…). Pueden ir varios
 *                             separados por comas: el del modo de prueba y el real.
 *   FIREBASE_SERVICE_ACCOUNT  el JSON entero de la cuenta de servicio de Firebase (Configuración del
 *                             proyecto → Cuentas de servicio → Generar nueva clave privada).
 *
 * GET dice si está configurado, sin enseñar nada secreto: {"ok":true,"stripe":true,"firebase":true}
 *
 * Qué da cada pago:
 *   - Pago de prueba (modo de prueba de Stripe): Premium 24 horas, para probar sin regalar Premium.
 *   - Suscripción real: Premium mientras siga activa (se retira al cancelarse o quedar sin pagar).
 *   - Pago único real: un año si es de 20,00 o más; si no, un mes.
 * Sin dependencias: Node 18+ (fetch, crypto). Ver docs/CONFIGURAR-CUENTAS.md.
 */
'use strict';
const crypto = require('crypto');

const DAY = 86400000;
const TOLERANCE = 300;     // segundos de margen para la marca de tiempo de la firma
const TEST_DAYS = 1;       // los pagos de prueba dan Premium 24 horas
const YEARLY_MIN = 2000;   // pago único (en céntimos) a partir del cual se da un año
const UID = /^[A-Za-z0-9_-]{10,128}$/;
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

/* ---------- Variables de entorno: se aceptan los despistes típicos al pegarlas y, si falla algo, se
   dice qué (sin enseñar nunca su valor) ---------- */
function unquote(s) { return s.replace(/^\s*(["'])([\s\S]*)\1\s*$/, '$2').trim(); }
function secrets() {
  return String(process.env.STRIPE_WEBHOOK_SECRET || '').split(',').map(function (s) { return unquote(s.trim()); }).filter(Boolean);
}
function stripeProblem() {
  if (process.env.STRIPE_WEBHOOK_SECRET == null) return 'falta la variable STRIPE_WEBHOOK_SECRET en este proyecto de Vercel (o falta volver a publicarlo)';
  const list = secrets();
  if (!list.length) return 'STRIPE_WEBHOOK_SECRET está vacía';
  if (!list.every(function (s) { return /^whsec_/.test(s); })) return 'STRIPE_WEBHOOK_SECRET debe ser el «secreto de firma» del webhook de Stripe, que empieza por whsec_';
  return null;
}
function readAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (raw == null) return { problem: 'falta la variable FIREBASE_SERVICE_ACCOUNT en este proyecto de Vercel (o falta volver a publicarlo)' };
  const text = String(raw).trim();
  if (!text) return { problem: 'FIREBASE_SERVICE_ACCOUNT está vacía' };
  let a = null;
  try { a = JSON.parse(text); } catch (e) {
    try { a = JSON.parse(unquote(text)); } catch (e2) {
      try { a = JSON.parse(Buffer.from(text, 'base64').toString('utf8')); } catch (e3) { a = null; }
    }
  }
  if (typeof a === 'string') { try { a = JSON.parse(a); } catch (e) { a = null; } }
  if (!a || typeof a !== 'object') return { problem: 'FIREBASE_SERVICE_ACCOUNT no es un JSON válido: abre el archivo .json con el Bloc de notas y pega TODO, desde la primera { hasta la última }' };
  if (a.apiKey && !a.private_key) return { problem: 'FIREBASE_SERVICE_ACCOUNT tiene la configuración web (apiKey), no la clave de la cuenta de servicio: Firebase → Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada' };
  const missing = ['project_id', 'client_email', 'private_key'].filter(function (k) { return !a[k]; });
  if (missing.length) return { problem: 'a FIREBASE_SERVICE_ACCOUNT le falta ' + missing.join(', ') + ': ¿se pegó el archivo .json entero?' };
  const key = String(a.private_key).replace(/\\n/g, '\n');
  try { crypto.createPrivateKey(key); } catch (e) { return { problem: 'la private_key de FIREBASE_SERVICE_ACCOUNT está incompleta o dañada: vuelve a pegar el archivo .json entero' }; }
  return { account: Object.assign({}, a, { private_key: key }) };
}
function account() { return readAccount().account || null; }

/* ---------- Firma de Stripe: HMAC-SHA256 de «t.cuerpo» con el secreto del webhook ---------- */
function verify(raw, header, list, nowSec) {
  if (!header || !list.length) return false;
  let t = 0; const v1 = [];
  String(header).split(',').forEach(function (part) {
    const i = part.indexOf('=');
    if (i < 0) return;
    const k = part.slice(0, i).trim(), v = part.slice(i + 1).trim();
    if (k === 't') t = Number(v); else if (k === 'v1') v1.push(v);
  });
  if (!t || !v1.length || Math.abs(nowSec - t) > TOLERANCE) return false;
  return list.some(function (secret) {
    const want = Buffer.from(crypto.createHmac('sha256', secret).update(t + '.' + raw, 'utf8').digest('hex'));
    return v1.some(function (sig) { const got = Buffer.from(sig); return got.length === want.length && crypto.timingSafeEqual(got, want); });
  });
}

/* ---------- Firestore por REST con la cuenta de servicio (o el emulador en las pruebas) ---------- */
let cached = null;
function jwt(sa, nowSec) {
  const b64 = function (x) { return Buffer.from(typeof x === 'string' ? x : JSON.stringify(x)).toString('base64url'); };
  const head = b64({ alg: 'RS256', typ: 'JWT' });
  const body = b64({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/datastore', aud: sa.token_uri || TOKEN_URL, iat: nowSec, exp: nowSec + 3600 });
  const sig = crypto.createSign('RSA-SHA256').update(head + '.' + body).sign(sa.private_key).toString('base64url');
  return head + '.' + body + '.' + sig;
}
async function accessToken(sa) {
  if (process.env.FIRESTORE_EMULATOR_HOST) return 'owner';
  if (cached && cached.email === sa.client_email && cached.exp > Date.now() + 60000) return cached.value;
  const r = await fetch(sa.token_uri || TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt(sa, Math.floor(Date.now() / 1000)) }).toString()
  });
  const j = await r.json().catch(function () { return {}; });
  if (!r.ok || !j.access_token) throw new Error('token de Google: ' + r.status + ' ' + (j.error || ''));
  cached = { email: sa.client_email, value: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return cached.value;
}
function docUrl(sa, path) {
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  return (host ? 'http://' + host : 'https://firestore.googleapis.com') + '/v1/projects/' + encodeURIComponent(sa.project_id) + '/databases/(default)/documents/' + path;
}
function enc(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  return { stringValue: String(v) };
}
function dec(fields) {
  const out = {};
  Object.keys(fields || {}).forEach(function (k) {
    const f = fields[k];
    if ('booleanValue' in f) out[k] = f.booleanValue;
    else if ('integerValue' in f) out[k] = Number(f.integerValue);
    else if ('doubleValue' in f) out[k] = f.doubleValue;
    else if ('stringValue' in f) out[k] = f.stringValue;
    else out[k] = null;
  });
  return out;
}
async function getDoc(sa, path) {
  const r = await fetch(docUrl(sa, path), { headers: { authorization: 'Bearer ' + await accessToken(sa) } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('leer ' + path + ': ' + r.status);
  return dec((await r.json()).fields);
}
async function setDoc(sa, path, data, merge) {
  const keys = Object.keys(data), fields = {};
  keys.forEach(function (k) { fields[k] = enc(data[k]); });
  const mask = merge ? '?' + keys.map(function (k) { return 'updateMask.fieldPaths=' + encodeURIComponent(k); }).join('&') : '';
  const r = await fetch(docUrl(sa, path) + mask, {
    method: 'PATCH',
    headers: { authorization: 'Bearer ' + await accessToken(sa), 'content-type': 'application/json' },
    body: JSON.stringify({ fields: fields })
  });
  if (!r.ok) throw new Error('guardar ' + path + ': ' + r.status + ' ' + (await r.text()).slice(0, 200));
}

/* ---------- Qué hacer con cada aviso de Stripe ---------- */
async function handle(event, sa, nowMs) {
  const o = (event && event.data && event.data.object) || {};
  const now = nowMs || Date.now(), test = event.livemode === false;
  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded': {
      if (o.payment_status !== 'paid' && o.payment_status !== 'no_payment_required') return 'pago aún sin confirmar';
      const uid = o.client_reference_id;
      if (!uid || !UID.test(uid)) return 'pago sin cuenta de WHIDER';
      const until = test ? now + TEST_DAYS * DAY
        : o.mode === 'subscription' ? null
        : now + ((o.amount_total || 0) >= YEARLY_MIN ? 366 : 31) * DAY;
      await setDoc(sa, 'entitlements/' + uid, {
        premium: true, until: until, test: test, mode: o.mode || null, subscription: o.subscription || null,
        session: o.id || null, amount: typeof o.amount_total === 'number' ? o.amount_total : null, currency: o.currency || null, updatedAt: now
      });
      if (o.subscription) await setDoc(sa, 'stripe_subscriptions/' + o.subscription, { uid: uid, updatedAt: now });
      return 'Premium activado';
    }
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const link = o.id ? await getDoc(sa, 'stripe_subscriptions/' + o.id) : null;
      if (!link || !link.uid) return 'suscripción desconocida';
      const ent = await getDoc(sa, 'entitlements/' + link.uid);
      if (!ent || ent.subscription !== o.id) return 'la cuenta tiene otro pago';
      const active = event.type === 'customer.subscription.updated' && ['active', 'trialing', 'past_due'].indexOf(o.status) >= 0;
      if (active === (ent.premium === true)) return active ? 'suscripción activa' : 'ya estaba retirado';
      await setDoc(sa, 'entitlements/' + link.uid, { premium: active, until: active ? (ent.test ? now + TEST_DAYS * DAY : null) : now, updatedAt: now }, true);
      return active ? 'suscripción activa' : 'Premium retirado';
    }
  }
  return 'aviso ignorado';
}

/* ---------- Peticiones (firma web de las funciones de Vercel) ---------- */
function headers() {
  return {
    'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store',
    'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type, stripe-signature'
  };
}
function json(body, status) { return new Response(JSON.stringify(body), { status: status || 200, headers: headers() }); }

async function POST(request) {
  const raw = await request.text();
  if (!verify(raw, request.headers.get('stripe-signature'), secrets(), Math.floor(Date.now() / 1000))) {
    return json({ error: 'firma no válida', motivo: stripeProblem() || 'el secreto whsec_ de Vercel no es el de este webhook de Stripe' }, 400);
  }
  const acc = readAccount(), sa = acc.account;
  if (!sa) return json({ error: acc.problem }, 500);
  let event;
  try { event = JSON.parse(raw); } catch (e) { return json({ error: 'aviso no válido' }, 400); }
  try {
    const result = await handle(event, sa);
    console.log('WHIDER pagos:', event.type, event.livemode ? 'real' : 'prueba', '→', result);
    return json({ received: true, result: result });
  } catch (e) {
    console.error('WHIDER pagos:', event.type, e.message);
    return json({ error: 'no se pudo guardar; Stripe lo reintentará', motivo: e.message }, 500);
  }
}
/**
 * Estado, sin secretos: {"ok":true,"stripe":true,"firebase":true,"proyecto":"…"}, y «problemas» si falta algo.
 * Con ?comprobar=1 además entra de verdad en Firestore con la cuenta de servicio («firestore»: "ok" o el error).
 */
async function GET(request) {
  const sp = stripeProblem(), acc = readAccount();
  const body = { ok: true, stripe: !sp, firebase: !!acc.account };
  if (acc.account) body.proyecto = acc.account.project_id;
  const problems = [sp, acc.problem].filter(Boolean);
  if (problems.length) body.problemas = problems;
  let check = false;
  try { check = !!request && new URL(request.url).searchParams.has('comprobar'); } catch (e) { check = false; }
  if (check && acc.account) {
    try { await getDoc(acc.account, 'entitlements/_comprobacion'); body.firestore = 'ok'; }
    catch (e) { body.firestore = String(e.message || e).slice(0, 300); }
  }
  return json(body);
}
function OPTIONS() { return new Response(null, { status: 204, headers: headers() }); }

module.exports = { GET: GET, POST: POST, OPTIONS: OPTIONS, _internals: { verify: verify, handle: handle, jwt: jwt, setDoc: setDoc, getDoc: getDoc, readAccount: readAccount, stripeProblem: stripeProblem } };
