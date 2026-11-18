// Adjuntos en la nube (emuladores): otro dispositivo de la misma cuenta los descarga, un compañero los ve
// en las páginas del equipo, lo que nadie usa se borra y al eliminar la cuenta no queda nada.
// Dos modos: en trozos en Firestore (el de siempre) y, con WHIDER_ADJUNTOS=storage (adjuntos-storage.js), en
// Firebase Storage con sus reglas (storage.rules).
const { chromium } = require('playwright');
const { APP, FX, fixtures } = require('./_util');
const fs = require('fs'), path = require('path');
const EMU = 'http://127.0.0.1:9099', FS = 'http://127.0.0.1:8085', PROJECT = 'demo-whider';
const STORAGE = process.env.WHIDER_ADJUNTOS === 'storage', ST = 'http://127.0.0.1:9199', BUCKET = 'demo-whider.appspot.com';
const cfg = { storage: STORAGE, firebase: { apiKey: 'demo-key', authDomain: 'demo-whider.firebaseapp.com', projectId: PROJECT, appId: '1:1:web:1', storageBucket: BUCKET }, googleWebClientId: 'x', requireAccount: true, allowGuest: true, allowedEmailDomains: [], emulator: { auth: EMU, firestoreHost: '127.0.0.1', firestorePort: 8085, storageHost: '127.0.0.1', storagePort: 9199 }, links: { base: 'https://whider-red.vercel.app' } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fails++; };
const get = async p => { const r = await fetch(`${FS}/v1/projects/${PROJECT}/databases/(default)/documents/${p}`, { headers: { Authorization: 'Bearer owner' } }); return r.status === 200 ? r.json() : null; };
const count = async p => { const r = await (await fetch(`${FS}/v1/projects/${PROJECT}/databases/(default)/documents/${p}?pageSize=300`, { headers: { Authorization: 'Bearer owner' } })).json(); return (r.documents || []).length; };
const object = async (p) => (await fetch(`${ST}/v0/b/${BUCKET}/o/${encodeURIComponent(p)}`, { headers: { Authorization: 'Bearer owner' } })).status === 200;
const objects = async (prefix) => { const r = await fetch(`${ST}/v0/b/${BUCKET}/o?prefix=${encodeURIComponent(prefix)}`, { headers: { Authorization: 'Bearer owner' } }); return r.status === 200 ? ((await r.json()).items || []).length : -1; };
async function waitFor(p, fn, arg, ms) { const end = Date.now() + (ms || 20000); while (Date.now() < end) { try { if (await p.evaluate(fn, arg)) return true; } catch (e) { /* recargando */ } await sleep(400); } return false; }
async function device(b, label) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 }, acceptDownloads: true });
  await ctx.addInitScript(c => { window.WHIDER_CONFIG = c; }, cfg);
  const p = await ctx.newPage(); p.errs = []; p.setDefaultTimeout(10000);
  p.on('pageerror', e => p.errs.push(label + ': ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/400|401|403|404|ERR_|permission|insufficient/i.test(m.text())) p.errs.push(label + ': ' + m.text()); });
  await p.goto(APP); await sleep(2300);
  return p;
}
async function afterAuth(p) {
  await sleep(2500);
  await p.evaluate(() => { if (Whider.Onboarding.isOpen()) document.querySelector('#onboardingRoot .nav-btn').click(); }); await sleep(700);
  await p.evaluate(() => { Whider.Notify.check = function () {}; });
}
async function register(p, name, email) {
  await p.fill('#authRoot input[autocomplete=name]', name);
  await p.fill('#authRoot input[type=email]', email);
  await p.fill('#authRoot input[type=password]', 'Secreta123');
  await p.click('#authRoot .auth-check .check');
  await p.click('#authRoot .auth-submit'); await sleep(2500);
  const r = await (await fetch(`${EMU}/emulator/v1/projects/${PROJECT}/oobCodes`)).json();
  await fetch(r.oobCodes.filter(c => c.email === email).pop().oobLink);
  await p.click('text=Ya lo he verificado');
  await afterAuth(p);
}
async function login(p, email) {
  await p.click('#authRoot >> text=Iniciar sesión'); await sleep(300);
  await p.fill('#authRoot input[type=email]', email);
  await p.fill('#authRoot input[type=password]', 'Secreta123');
  await p.click('#authRoot .auth-submit');
  await afterAuth(p);
}
async function openPage(p, id) { await p.evaluate(id => { Whider.Router.go('notes'); setTimeout(() => Whider.Notes.openPage(id), 300); }, id); await sleep(1500); }
async function attach(p, files) {
  await p.click('#screen-notes .bk-text >> nth=0'); await p.keyboard.press('End');
  const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('.pg-addons button:has-text("Adjuntar")')]);
  await fc.setFiles(files.map(f => path.join(FX, f))); await sleep(1500);
}
const refs = (p, id) => p.evaluate(id => Whider.Pages.content(id).blocks.filter(b => b.f).map(b => ({ t: b.t, f: b.f, n: b.n, s: b.s })), id);
const allUp = (p, a) => waitFor(p, a => a.list.every(f => Whider.Files.status(f, a.sk).s === 'ok'), a, 25000);

(async () => {
  await fetch(`${EMU}/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });
  await fetch(`${FS}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
  const b = await chromium.launch(); await fixtures(b);

  console.log('— Misma cuenta, dos dispositivos —');
  const A = await device(b, 'A');
  await register(A, 'Ana Ruiz', 'ana@ejemplo.com');
  const uid = await A.evaluate(() => Whider.Auth.user.uid);
  const pid = await A.evaluate(() => { const P = Whider.Pages; return P.create({ title: 'Contrato del piso', blocks: [P.block('p', 'Documentos firmados:'), P.block('p', '')] }).id; });
  await openPage(A, pid);
  await attach(A, ['foto.png', 'Factura marzo.pdf', 'grande.jpg']);
  const files = await refs(A, pid);
  ok(files.length === 3, 'A: tres adjuntos en la página');
  ok(await allUp(A, { list: files.map(f => f.f), sk: 'me' }), 'A: los tres terminan de subirse (estado «en la nube»)');
  const card = await A.locator('.bkf').first().innerText();
  ok(/Documento PDF · 3 KB/.test(card) && !/Pendiente|dispositivo/.test(card), 'A: la tarjeta ya no dice «pendiente»: ' + card.replace(/\n/g, ' | '));
  const meta = await get(`users/${uid}/files/${files[2].f}`);
  const parts = meta ? +meta.fields.parts.integerValue : 0;
  ok(await A.evaluate(() => Whider.Files.backend()) === (STORAGE ? 'storage' : 'firestore'), 'A: los archivos nuevos van a ' + (STORAGE ? 'Firebase Storage' : 'Firestore'));
  if (STORAGE) {
    ok(meta && meta.fields.name.stringValue === 'grande.jpg' && meta.fields.where && meta.fields.where.stringValue === 's' && parts === 0, 'nube: la ficha del archivo grande dice que está en Storage');
    ok(await object(`users/${uid}/files/${files[2].f}`) && await objects(`users/${uid}/files/`) === 3 && await count(`users/${uid}/files/${files[2].f}/parts`) === 0, 'nube: los 3 archivos, enteros en Storage y sin trozos en Firestore');
  } else {
    ok(meta && meta.fields.name.stringValue === 'grande.jpg' && parts === Math.ceil(files[2].s / (600 * 1024)), 'nube: ficha del archivo grande con ' + parts + ' trozos de menos de 1 MB');
    ok(await count(`users/${uid}/files/${files[2].f}/parts`) === parts, 'nube: están todos los trozos');
  }
  await A.evaluate(() => Whider.PageSync.now()); await sleep(2500);

  const A2 = await device(b, 'A2');
  await login(A2, 'ana@ejemplo.com');
  ok(await waitFor(A2, id => !!Whider.Pages.get(id) && Whider.Pages.content(id).blocks.filter(x => x.f).length === 3, pid, 20000), 'A2 (otro dispositivo): llega la página con sus 3 adjuntos');
  ok(await A2.evaluate(a => a.every(f => !Whider.Files.has(f)), files.map(f => f.f)), 'A2: aún no están descargados (se bajan al abrir la página)');
  await openPage(A2, pid);
  ok(await waitFor(A2, () => document.querySelectorAll('#screen-notes .bk-img-box.ready img').length === 2, null, 20000), 'A2: al abrir la página se descargan y se ven las dos imágenes');
  const [dl] = await Promise.all([A2.waitForEvent('download'), A2.locator('.bkf').first().locator('.bkf-btn').first().click()]);
  ok(fs.readFileSync(await dl.path()).equals(fs.readFileSync(path.join(FX, 'Factura marzo.pdf'))), 'A2: el PDF descargado es idéntico byte a byte al original');
  await A2.reload(); await sleep(2500);
  await A2.evaluate(() => { Whider.Notify.check = function () {}; });
  ok(await A2.evaluate(a => Whider.Files.ready().then(() => a.every(f => Whider.Files.has(f))), files.map(f => f.f)), 'A2: tras recargar, los tiene guardados en el dispositivo');

  console.log('— Página de equipo —');
  await A.evaluate(() => Whider.People.enable()); await sleep(1200);
  const sid = await A.evaluate(() => Whider.People.createTeam('Piso compartido', [])); await sleep(800);
  const tlink = await A.evaluate(id => Whider.People.teamLink(id), sid);
  const B = await device(b, 'B');
  await register(B, 'Bea Gil', 'bea@ejemplo.com');
  await B.evaluate(l => Whider.Invite.open(l), tlink); await sleep(900);
  await B.click('.sheet-layer.open .sheet-foot .btn.primary'); await sleep(2500);
  ok(await B.evaluate(id => !!Whider.State.social.spaces[id], sid), 'B: entra en el equipo con el enlace');
  // A comparte la página con el equipo: sus archivos se copian al equipo
  await A.evaluate(a => { Whider.Pages.update(a.pid, { team: a.sid }); }, { pid, sid });
  await A.evaluate(() => Whider.PageSync.now()); await sleep(1500);
  ok(await waitFor(A, a => a.list.every(f => Whider.Files.status(f, a.sk).s === 'ok'), { list: files.map(f => f.f), sk: 't:' + sid }, 30000), 'A: los adjuntos se copian al equipo al compartir la página');
  ok(await count(`spaces/${sid}/files`) === 3 && (!STORAGE || await objects(`spaces/${sid}/files/`) === 3), 'nube: 3 archivos en el equipo');
  await B.evaluate(() => Whider.PageSync.now()); await sleep(2500);
  await openPage(B, pid);
  const bSees = await waitFor(B, () => document.querySelectorAll('#screen-notes .bk-img-box.ready img').length === 2 && document.querySelectorAll('#screen-notes .bkf').length === 1, null, 20000);
  if (!bSees) console.log('   B ve:', JSON.stringify(await B.evaluate(id => ({ screen: Whider.State.activeScreen, page: Whider.State.ui.page, meta: Whider.Pages.get(id) && { team: Whider.Pages.get(id).team, title: Whider.Pages.get(id).title }, blocks: Whider.Pages.content(id).blocks.map(x => x.t + (x.f ? ':' + Whider.Files.status(x.f, Whider.Files.scopeOf(id)).s + '/' + (Whider.Files.status(x.f, Whider.Files.scopeOf(id)).code || '') : '')), boxes: [...document.querySelectorAll('#screen-notes .bk-img-box')].map(e => e.className + ' ' + e.textContent.slice(0, 80)), cards: [...document.querySelectorAll('#screen-notes .bkf')].map(e => e.textContent.slice(0, 80)), spaces: Object.keys(Whider.State.social.spaces || {}), sheets: document.querySelectorAll('.sheet-layer.open').length, title: (document.querySelector('#screen-notes .pg-title') || {}).textContent }), pid)));
  ok(bSees, 'B (compañera): ve las imágenes y el PDF de la página del equipo');
  // B añade un archivo a la página del equipo y A lo recibe
  await attach(B, ['notas.txt']);
  const bFile = (await refs(B, pid)).filter(f => f.n === 'notas.txt')[0];
  ok(bFile && await allUp(B, { list: [bFile.f], sk: 't:' + sid }), 'B: su archivo se sube al equipo (no a su espacio)');
  ok(!(await get(`users/${await B.evaluate(() => Whider.Auth.user.uid)}/files/${bFile.f}`)), 'nube: el archivo de B no está en su espacio personal');
  await B.evaluate(() => Whider.PageSync.now()); await sleep(2000);
  await A.evaluate(() => Whider.PageSync.now()); await sleep(2500);
  await openPage(A, pid);
  const txt = await A.evaluate(f => Whider.Files.get(f, Whider.Files.scopeOf(Whider.State.ui.page)).then(bl => bl.text()), bFile.f);
  ok(/Lista de la compra/.test(txt), 'A: abre el archivo que añadió B');
  // Un intruso (fuera del equipo) no puede leer los archivos
  const C = await device(b, 'C');
  await register(C, 'Carlos Pérez', 'carlos@ejemplo.com');
  const denied = await C.evaluate(a => { const F = Whider.Auth.sdk(), db = Whider.Auth.db(); return F.getDoc(F.doc(db, 'spaces', a.sid, 'files', a.f)).then(() => 'leído', e => e.code); }, { sid, f: files[0].f });
  ok(denied === 'permission-denied', 'reglas: alguien de fuera del equipo no puede leerlos (' + denied + ')');
  const denied2 = await C.evaluate(a => { const F = Whider.Auth.sdk(), db = Whider.Auth.db(); return F.getDoc(F.doc(db, 'users', a.uid, 'files', a.f)).then(() => 'leído', e => e.code); }, { uid, f: files[0].f });
  ok(denied2 === 'permission-denied', 'reglas: nadie más puede leer los archivos personales de Ana (' + denied2 + ')');
  if (STORAGE) {
    const read = (a) => C.evaluate(a => { const F = Whider.Auth.sdk(); return F.getBytes(F.ref(Whider.Auth.storage(), a.p)).then(() => 'leído', e => e.code); }, a);
    const s1 = await read({ p: `spaces/${sid}/files/${files[0].f}` }), s2 = await read({ p: `users/${uid}/files/${files[0].f}` });
    ok(s1 === 'storage/unauthorized' && s2 === 'storage/unauthorized', 'reglas de Storage: alguien de fuera no puede leer ni los del equipo ni los personales (' + s1 + ', ' + s2 + ')');
    const w = await C.evaluate(a => { const F = Whider.Auth.sdk(); return new Promise(res => { const t = F.uploadBytesResumable(F.ref(Whider.Auth.storage(), a.p), new Blob(['x'])); t.on('state_changed', null, e => res(e.code), () => res('escrito')); }); }, { p: `users/${uid}/files/fintruso1234` });
    ok(w === 'storage/unauthorized', 'reglas de Storage: ni escribir en el espacio de otra persona (' + w + ')');
    const html = await A.evaluate(a => { const F = Whider.Auth.sdk(); return new Promise(res => { const t = F.uploadBytesResumable(F.ref(Whider.Auth.storage(), a.p), new Blob(['<script>alert(1)</script>'], { type: 'text/html' }), { contentType: 'text/html' }); t.on('state_changed', null, e => res(e.code), () => res('escrito')); }); }, { p: `users/${uid}/files/fhtml123456` });
    ok(html === 'storage/unauthorized', 'reglas de Storage: ni siquiera en tu espacio se sube HTML con su tipo (' + html + ')');
    const svg = await A.evaluate(() => Whider.Files.add(new File(['<svg xmlns="http://www.w3.org/2000/svg"><circle r="4"/></svg>'], 'logo.svg', { type: 'image/svg+xml' }), { image: false }).then(r => r.f));
    ok(await allUp(A, { list: [svg], sk: 'me' }), 'A: un SVG adjunto se sube a Storage');
    const sm = await (await fetch(`${ST}/v0/b/${BUCKET}/o/${encodeURIComponent(`users/${uid}/files/${svg}`)}`, { headers: { Authorization: 'Bearer owner' } })).json();
    const svgCard = await get(`users/${uid}/files/${svg}`);
    ok(sm.contentType === 'application/octet-stream' && svgCard && svgCard.fields.type.stringValue === 'image/svg+xml', 'Storage: el SVG va como binario genérico y su ficha conserva el tipo (' + sm.contentType + ')');
    const back = await A2.evaluate(f => Whider.Files.get(f, 'me').then(b => b.type + '|' + b.size), svg);
    ok(/^image\/svg\+xml\|\d+$/.test(back), 'A2: lo recibe como SVG (' + back + ')');
  }

  console.log('— Limpieza de lo que ya no se usa —');
  // Ana quita la foto grande de la página; pasados los días de margen se borra del dispositivo y de la nube
  const big = files[2].f;
  await A.evaluate(a => { const P = Whider.Pages; P.setBlocks(a.pid, P.content(a.pid).blocks.filter(x => x.f !== a.f)); }, { pid, f: big });
  await A.evaluate(() => Whider.PageSync.now()); await sleep(2500);
  await A.evaluate(() => Whider.Files.maintain(0)); await sleep(1500);
  const seen = await A.evaluate(f => JSON.parse(localStorage.getItem('whider.files.v1')).unref[f], big);
  ok(!!seen, 'A: la foto quitada queda marcada como «sin usar» (no se borra todavía)');
  ok(await A.evaluate(f => Whider.Files.has(f), big), 'A: sigue en el dispositivo durante el margen (se puede deshacer)');
  // Simula que han pasado 4 días: se borra del dispositivo y de la nube del equipo y de la personal
  await A.evaluate(f => { const s = JSON.parse(localStorage.getItem('whider.files.v1')); s.unref[f] = Date.now() - 4 * 86400000; s.gcAt = {}; Object.keys(s.cloudUnref).forEach(k => { if (s.cloudUnref[k][f]) s.cloudUnref[k][f] = Date.now() - 4 * 86400000; }); localStorage.setItem('whider.files.v1', JSON.stringify(s)); }, big);
  await A.reload(); await sleep(2500); await A.evaluate(() => { Whider.Notify.check = function () {}; });
  await A.evaluate(() => Whider.PageSync.now()); await sleep(2000);
  await A.evaluate(() => Whider.Files.maintain(0)); await sleep(3000);
  await A.evaluate(() => Whider.Files.sync()); await sleep(2500);
  ok(!(await A.evaluate(f => Whider.Files.has(f), big)), 'A: pasado el margen, se borra del dispositivo');
  ok(!(await get(`spaces/${sid}/files/${big}`)) && await count(`spaces/${sid}/files/${big}/parts`) === 0 && (!STORAGE || !(await object(`spaces/${sid}/files/${big}`))), 'nube: se borra del equipo (ficha y ' + (STORAGE ? 'archivo de Storage' : 'todos sus trozos') + ')');
  // La copia personal (de antes de compartir la página) tampoco la usa ya nadie
  await A.evaluate(() => { const s = JSON.parse(localStorage.getItem('whider.files.v1')); s.gcAt = {}; Object.keys(s.cloudUnref.me || {}).forEach(k => { s.cloudUnref.me[k] = Date.now() - 4 * 86400000; }); localStorage.setItem('whider.files.v1', JSON.stringify(s)); });
  await A.reload(); await sleep(2500); await A.evaluate(() => { Whider.Notify.check = function () {}; });
  await A.evaluate(() => Whider.PageSync.now()); await sleep(2000);
  await A.evaluate(() => Whider.Files.maintain(0)); await sleep(3000); await A.evaluate(() => Whider.Files.sync()); await sleep(2500);
  ok(await count(`users/${uid}/files`) === 0 && (!STORAGE || await objects(`users/${uid}/files/`) === 0), 'nube: las copias personales de antes de compartir se borran (quedan ' + await count(`users/${uid}/files`) + ')');
  ok(await count(`spaces/${sid}/files`) === 3, 'nube: en el equipo siguen los 3 que se usan (foto, PDF y el de B)');

  console.log('— Eliminar la cuenta —');
  const pid2 = await A.evaluate(() => { const P = Whider.Pages; return P.create({ title: 'Solo mío', blocks: [P.block('p', 'x')] }).id; });
  await openPage(A, pid2);
  await attach(A, ['notas.txt']);
  const mine = (await refs(A, pid2))[0];
  ok(await allUp(A, { list: [mine.f], sk: 'me' }), 'A: un archivo personal subido');
  await A.evaluate(() => Whider.App.deleteAccount()); await sleep(4000);
  ok(await count(`users/${uid}/files`) === 0 && await count(`users/${uid}/files/${mine.f}/parts`) === 0 && (!STORAGE || await objects(`users/${uid}/files/`) === 0), 'al eliminar la cuenta no queda ningún archivo suyo en la nube');
  ok(await A.evaluate(() => Whider.Files.ready().then(() => Whider.Files.pendingCount() === 0 && !Whider.Files.has('x'))), 'y nada pendiente en el dispositivo');
  const local = await A.evaluate(() => new Promise(res => { const r = indexedDB.open('whider-files'); r.onsuccess = () => { const c = r.result.transaction('data').objectStore('data').count(); c.onsuccess = () => res(c.result); }; }));
  ok(local === 0, 'el dispositivo queda sin archivos (' + local + ')');

  const errs = [].concat(A.errs, A2.errs, B.errs, C.errs);
  ok(!errs.length, 'sin errores ' + JSON.stringify(errs.slice(0, 4)));
  await b.close();
  console.log(fails ? '\n' + fails + ' FALLOS' : '\nTODO OK'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
