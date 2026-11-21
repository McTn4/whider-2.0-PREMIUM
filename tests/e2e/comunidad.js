// 7.0 con dos cuentas (emuladores): enlace de invitación, chat, equipo, enlace del equipo y páginas compartidas
const { chromium } = require('playwright');
const { APP } = require('./_util');
const base = process.argv[2] || APP, OUT = process.argv[3];
const EMU = 'http://127.0.0.1:9099', PROJECT = 'demo-whider';
const cfg = {
  firebase: { apiKey: 'demo-key', authDomain: 'demo-whider.firebaseapp.com', projectId: PROJECT, appId: '1:1:web:1' },
  googleWebClientId: 'test-client', requireAccount: true, allowGuest: true, allowedEmailDomains: [],
  emulator: { auth: EMU, firestoreHost: '127.0.0.1', firestorePort: 8085 }, links: { base: 'https://whider-red.vercel.app' }
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const results = []; let failed = 0;
const ok = (n, c, x) => { results.push((c ? 'OK   ' : 'FAIL ') + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); if (!c) failed++; };
async function waitFor(p, fn, arg, ms) { const end = Date.now() + (ms || 15000); while (Date.now() < end) { try { if (await p.evaluate(fn, arg)) return true; } catch (e) { /* recarga */ } await sleep(400); } return false; }
async function device(browser, viewport, mobile, hash) {
  const ctx = await browser.newContext(Object.assign({ viewport }, mobile ? { isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 14) Mobile' } : {}));
  await ctx.addInitScript(c => { window.WHIDER_CONFIG = c; }, cfg);
  const p = await ctx.newPage(); p.errs = []; p.setDefaultTimeout(8000);
  p.on('pageerror', e => p.errs.push(e.message));
  p.on('console', m => {
    if (m.type() !== 'error') return;
    // Un 409 al confirmar una transacción es que los dos dispositivos guardaron a la vez: Firestore la repite sola,
    // y «cambios a la vez de los dos se conservan» comprueba que no se pierde nada
    if (/\b409\b/.test(m.text()) && /documents:commit/.test((m.location() && m.location().url) || '')) return;
    if (!/400|401|403|404|ERR_|permission|Missing or insufficient/i.test(m.text())) p.errs.push(m.text());
  });
  await p.goto(base + (hash || '')); await sleep(2300);
  return p;
}
async function register(p, name, email) {
  await p.fill('#authRoot input[autocomplete=name]', name);
  await p.fill('#authRoot input[type=email]', email);
  await p.fill('#authRoot input[type=password]', 'Secreta123');
  await p.click('#authRoot .auth-check .check');
  await p.click('#authRoot .auth-submit'); await sleep(2500);
  const r = await (await fetch(`${EMU}/emulator/v1/projects/${PROJECT}/oobCodes`)).json();
  await fetch(r.oobCodes.filter(c => c.email === email).pop().oobLink);
  await p.click('text=Ya lo he verificado'); await sleep(2500);
  await p.evaluate(() => { if (Whider.Onboarding.isOpen()) document.querySelector('#onboardingRoot .nav-btn').click(); }); await sleep(700);
  await p.evaluate(() => { Whider.Notify.check = function () {}; });
}
(async () => {
  await fetch(`${EMU}/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });
  await fetch(`http://127.0.0.1:8085/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
  const browser = await chromium.launch();

  // A (ordenador): cuenta, comunidad y su enlace (todo gratis)
  const A = await device(browser, { width: 1360, height: 860 });
  await register(A, 'Lucía Martín', 'lucia@ejemplo.com');
  await A.evaluate(() => Whider.People.enable()); await sleep(1500);
  const link = await A.evaluate(() => Whider.Invite.personLink('work'));
  ok('A: enlace de invitación', /^https:\/\/whider-red\.vercel\.app\/i\/\?c=WH-[A-Z0-9]{6}&k=/.test(link || ''), link);
  const q = link.split('?')[1];

  // B (móvil, sin cuenta) abre el enlace: la invitación espera a que entre
  const B = await device(browser, { width: 390, height: 844 }, true, '#i=' + encodeURIComponent(q));
  ok('B: invitación guardada mientras no tiene cuenta', await B.evaluate(() => !!localStorage.getItem('whider.pendingInvite')));
  await register(B, 'Carlos Pérez', 'carlos@ejemplo.com');
  ok('B: al entrar ve quién le invita', await waitFor(B, () => { const s = document.querySelector('.invite-sheet'); return !!s && /Lucía Martín te invita/.test(s.textContent); }, null, 12000));
  if (OUT) await B.screenshot({ path: OUT + '/m-invite.png' });
  await B.click('.sheet-layer.open .sheet-foot .btn.primary'); await sleep(2500);
  const bFriend = await B.evaluate(() => Whider.State.friends().map(f => ({ name: f.name, kind: f.kind, pending: f.pending })));
  ok('B: Lucía en sus contactos (trabajo)', bFriend.length === 1 && bFriend[0].kind === 'work', bFriend);
  // A recibe la conexión sin tener que aceptar
  await A.evaluate(() => Whider.People.poll(true)); await sleep(2000);
  const aFriend = await A.evaluate(() => Whider.State.friends().map(f => ({ name: f.name, kind: f.kind, pending: f.pending })));
  ok('A: Carlos conectado solo con el enlace', aFriend.length === 1 && aFriend[0].name === 'Carlos Pérez' && !aFriend[0].pending && aFriend[0].kind === 'work', aFriend);
  await B.evaluate(() => Whider.People.poll(true)); await sleep(1800);
  ok('B: confirmación recibida', await B.evaluate(() => Whider.State.friends()[0].pending === false));
  ok('B también puede invitar (1.0: sin Premium)', /^https:\/\/whider-red\.vercel\.app\/i\/\?c=WH-/.test(await B.evaluate(() => Whider.Invite.personLink('friend')) || ''));

  // Chat de dos
  await B.evaluate(() => Whider.Chat.openChat({ uid: Whider.State.friends()[0].uid })); await sleep(2200);
  ok('B: chat abierto', await B.evaluate(() => Whider.State.activeScreen === 'chats' && !!document.querySelector('#screen-chats .ct-input')));
  await B.fill('#screen-chats .ct-input', '¡Hola Lucía! ¿Vemos el informe mañana?');
  await B.click('#screen-chats .ct-send'); await sleep(2000);
  ok('B: mensaje enviado', await B.evaluate(() => { const m = Whider.Chat.messages(Whider.State.ui.chat); return m.length === 1 && !m[0].pending && !m[0].failed; }));
  await A.evaluate(() => Whider.People.poll(true)); await sleep(2500);
  ok('A: aviso de chat sin leer', await A.evaluate(() => Whider.Chat.unreadCount() === 1));
  await A.evaluate(() => Whider.Router.go('chats')); await sleep(1500);
  await A.click('#screen-chats .ct-row'); await sleep(2000);
  ok('A: ve el mensaje de Carlos', await A.evaluate(() => /Vemos el informe/.test(document.querySelector('#screen-chats .ct-msgs').textContent)));
  await A.fill('#screen-chats .ct-input', 'Claro, a las 10');
  await A.keyboard.press('Enter'); await sleep(1500);
  ok('A: sin leer a cero tras abrir', await A.evaluate(() => Whider.Chat.unreadCount() === 0));
  // Reacción de A al mensaje de B y tarea compartida
  await A.evaluate(() => { const c = Whider.State.ui.chat, m = Whider.Chat.messages(c).filter(x => x.by !== Whider.Chat.me())[0]; Whider.Chat.react(c, m.id, 'like'); }); await sleep(1200);
  await A.evaluate(() => { const t = Whider.State.addTask({ text: 'Revisar el informe trimestral', date: Whider.U.addDays(Whider.U.today(), 1), time: '10:00' }); return Whider.Chat.send(Whider.State.ui.chat, { kind: 'task', text: '', ref: { text: t.text, date: t.date, time: t.time } }); }); await sleep(1500);
  if (OUT) await A.screenshot({ path: OUT + '/d-chat.png' });
  await B.evaluate(() => Whider.Chat.loadMsgs(Whider.State.ui.chat)); await sleep(1500);
  const bMsgs = await B.evaluate(() => Whider.Chat.messages(Whider.State.ui.chat).map(m => ({ t: m.text, k: m.kind, r: m.react ? Object.values(m.react) : [] })));
  ok('B: recibe respuesta, reacción y tarea', bMsgs.length === 3 && bMsgs[0].r[0] === 'like' && bMsgs[1].t === 'Claro, a las 10' && bMsgs[2].k === 'task', bMsgs);
  await B.evaluate(() => Whider.Router.refresh()); await sleep(600);
  await B.click('#screen-chats .ct-card .btn'); await sleep(600);
  ok('B: añade la tarea compartida a las suyas', await B.evaluate(() => Whider.State.tasks.some(t => t.text === 'Revisar el informe trimestral' && t.time === '10:00')));
  if (OUT) await B.screenshot({ path: OUT + '/m-chat.png' });
  // B edita su mensaje
  await B.evaluate(() => { const c = Whider.State.ui.chat, m = Whider.Chat.messages(c).filter(x => x.by === Whider.Chat.me())[0]; return Whider.Chat.edit(c, m.id, '¡Hola Lucía! ¿Vemos el informe mañana a las 10?'); }); await sleep(1200);
  await A.evaluate(() => Whider.Chat.loadMsgs(Whider.State.ui.chat)); await sleep(1200);
  ok('A: ve el mensaje editado', await A.evaluate(() => Whider.Chat.messages(Whider.State.ui.chat).some(m => /a las 10\?/.test(m.text) && m.edited)));

  // Seguridad: B no puede escribir en el buzón de A con la clave de otro
  const denied = await B.evaluate(() => { const F = Whider.Auth.sdk(), db = Whider.Auth.db(); return F.setDoc(F.doc(db, 'inbox', Whider.State.friends()[0].uid), { requests: { otraPersona: { name: 'Falso' } } }, { merge: true }).then(() => 'permitido', e => e.code); });
  ok('reglas: nadie escribe en nombre de otro', denied === 'permission-denied', denied);

  // Equipo con B y su chat
  const sid = await A.evaluate(() => Whider.People.createTeam('Proyecto X', Whider.State.friends().map(f => ({ uid: f.uid, name: f.name })))); await sleep(800);
  await B.evaluate(() => Whider.People.poll(true)); await sleep(1800);
  ok('B: añadido al equipo', await B.evaluate(id => !!Whider.State.social.spaces[id] && !Whider.State.social.spaces[id].left, sid));
  await A.evaluate(id => Whider.Chat.openChat({ team: id }), sid); await sleep(2000);
  await A.evaluate(() => Whider.Chat.send(Whider.State.ui.chat, { text: 'Bienvenido al equipo' })); await sleep(1200);
  await B.evaluate(() => Whider.People.poll(true)); await sleep(2500);
  ok('B: mensaje del chat del equipo', await B.evaluate(id => { const c = Whider.Chat.get('tm_' + id); return !!c && c.last && c.last.text === 'Bienvenido al equipo'; }, sid));

  // Páginas del equipo: A crea, B ve y edita, A recibe el cambio
  const pid = await A.evaluate(id => { const P = Whider.Pages; const pg = P.create({ title: 'Plan del Proyecto X', team: id, blocks: [P.block('h2', 'Objetivos'), P.block('todo', 'Definir el alcance'), P.block('p', 'Notas iniciales')] }); return pg.id; }, sid);
  await A.evaluate(() => Whider.PageSync.now()); await sleep(2500);
  await B.evaluate(() => Whider.PageSync.now()); await sleep(2500);
  const bPage = await B.evaluate(id => { const m = Whider.Pages.get(id); return m ? { title: m.title, team: m.team, texts: Whider.Pages.content(id).blocks.map(b => Whider.Pages.plain(b.x || '')) } : null; }, pid);
  ok('B: recibe la página del equipo', !!bPage && bPage.title === 'Plan del Proyecto X' && bPage.texts.indexOf('Definir el alcance') >= 0, bPage);
  await B.evaluate(id => { const P = Whider.Pages, bl = P.content(id).blocks.slice(); bl.push(P.block('todo', 'Presupuesto (Carlos)')); P.setBlocks(id, bl); }, pid);
  await A.evaluate(id => { const P = Whider.Pages, bl = P.content(id).blocks.slice(); bl[2] = Object.assign({}, bl[2], { x: 'Notas iniciales y calendario' }); P.setBlocks(id, bl); }, pid);
  await B.evaluate(() => Whider.PageSync.now()); await sleep(2500);
  await A.evaluate(() => Whider.PageSync.now()); await sleep(2500);
  await B.evaluate(() => Whider.PageSync.now()); await sleep(2500);
  const both = await Promise.all([A, B].map(p => p.evaluate(id => Whider.Pages.content(id).blocks.map(b => Whider.Pages.plain(b.x || '')), pid)));
  ok('cambios a la vez de los dos se conservan', both.every(t => t.indexOf('Presupuesto (Carlos)') >= 0 && t.indexOf('Notas iniciales y calendario') >= 0), both);

  // Enlace del equipo: un equipo nuevo de A sin miembros; B entra con el enlace
  const sid2 = await A.evaluate(() => Whider.People.createTeam('Marketing', [])); await sleep(800);
  const tlink = await A.evaluate(id => Whider.People.teamLink(id), sid2);
  ok('A: enlace del equipo', /\/i\/\?s=/.test(tlink || ''), tlink);
  await B.evaluate(l => Whider.Invite.open(l), tlink); await sleep(800);
  ok('B: invitación al equipo', await B.evaluate(() => /Marketing/.test((document.querySelector('.invite-sheet') || {}).textContent || '')));
  await B.click('.sheet-layer.open .sheet-foot .btn.primary'); await sleep(2500);
  ok('B: dentro del equipo con el enlace', await B.evaluate(id => !!Whider.State.social.spaces[id] && Object.keys((Whider.People.team(id) || {}).members || {}).length === 2, sid2));
  const badKey = await B.evaluate(id => { const F = Whider.Auth.sdk(), db = Whider.Auth.db(); return F.updateDoc(F.doc(db, 'spaces', id), { ['members.intruso']: 'x' }).then(() => 'permitido', e => e.code); }, sid2);
  ok('reglas: no se puede meter a otros en un equipo', badKey === 'permission-denied', badKey);
  if (OUT) { await A.evaluate(() => Whider.Router.go('friends')); await sleep(1200); await A.screenshot({ path: OUT + '/d-people.png' }); }

  ok('sin errores (A)', A.errs.length === 0, A.errs.slice(0, 5));
  ok('sin errores (B)', B.errs.length === 0, B.errs.slice(0, 5));
  await browser.close();
  console.log(results.join('\n')); console.log(failed ? '\n' + failed + ' FALLOS' : '\nTODO OK');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.log(results.join('\n')); console.error(String(e).split('\n')[0]); process.exit(2); });
