// 7.0: recorrer todas las pantallas en ordenador y móvil, sin errores, con capturas
const { chromium } = require('playwright');
const { APP } = require('./_util');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const URL = APP, OUT = process.argv[2];
const results = []; let failed = 0;
const ok = (n, c, x) => { results.push((c ? 'OK   ' : 'FAIL ') + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); if (!c) failed++; };
async function setup(b, viewport, mobile) {
  const ctx = await b.newContext(Object.assign({ viewport }, mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}));
  await ctx.addInitScript(() => { window.WHIDER_CONFIG = { firebase: null }; localStorage.setItem('whider.meta.v1', JSON.stringify({ onboarded: true, createdAt: Date.now(), seenAchievements: [] })); });
  const p = await ctx.newPage(); p.setDefaultTimeout(5000);
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.goto(URL); await sleep(1800);
  await p.evaluate(() => {
    Whider.Notify.check = function () {}; const S = Whider.State;
    const t = Whider.U.today(), add = (text, h, time) => S.addTask({ text, date: t, time: time || null, highlight: h || 'none', listId: 'work', warn: false });
    add('Preparar la propuesta', 'danger', '10:00'); add('Llamar a Ana', 'purple', '12:00'); add('Revisar correo'); add('Comprar pan', 'star'); add('Enviar factura', 'none', '17:00');
    S.setCharacter({ body: 'zorro', tone: 'blanco', head: 'auriculares', acc: 'bufanda', bg: 'degradado', frame: 'aro' });
  });
  return { p, errs };
}
(async () => {
  const b = await chromium.launch();
  { // Ordenador
    const { p, errs } = await setup(b, { width: 1440, height: 900 }); await sleep(400);
    ok('Hoy: «Lo más importante» con 3 tareas', await p.evaluate(() => document.querySelectorAll('#screen-home .sec.top3 .task').length === 3));
    ok('primera prioridad = la urgente', await p.evaluate(() => (document.querySelector('#screen-home .sec.top3 .task .task-title') || {}).textContent) === 'Preparar la propuesta');
    ok('barra lateral por grupos', await p.evaluate(() => { const t = document.getElementById('sidebar').textContent; return /Cuaderno/.test(t) && /Equipo/.test(t) && /Chats/.test(t) && /Personas/.test(t) && /Rutinas/.test(t) && /Análisis/.test(t) && !/Apuntes/.test(t); }));
    ok('foto de perfil con personaje', await p.evaluate(() => !!document.querySelector('#sidebar .sb-profile .av .ch-svg')));
    if (OUT) await p.screenshot({ path: OUT + '/d-home.png' });
    for (const [k, scr] of [['4', 'notes'], ['5', 'chats'], ['6', 'friends'], ['7', 'habits'], ['8', 'focus'], ['9', 'stats'], ['1', 'home']]) {
      await p.keyboard.press(k); await sleep(350);
      ok('tecla ' + k + ' → ' + scr, await p.evaluate(() => Whider.State.activeScreen) === scr);
      if (OUT && (scr === 'chats' || scr === 'friends')) await p.screenshot({ path: OUT + '/d-' + scr + '.png' });
    }
    // Editor del personaje: pestaña «Foto de perfil» y especies (sin las retiradas en la 1.0)
    await p.evaluate(() => Whider.Character.edit('avatar')); await sleep(500);
    ok('editor: fondos y marcos', await p.evaluate(() => /Fondo/.test(document.querySelector('.buddy-editor').textContent) && /Marco/.test(document.querySelector('.buddy-editor').textContent)));
    if (OUT) await p.screenshot({ path: OUT + '/d-editor-avatar.png' });
    await p.evaluate(() => { [...document.querySelectorAll('.buddy-editor .segmented button')].find(b => b.textContent === 'Especie').click(); }); await sleep(400);
    ok('especies sin las retiradas', await p.evaluate(() => { const t = document.querySelector('.buddy-editor').textContent; return ['Gato', 'Oso', 'Búho', 'Zorro', 'Robot', 'Fantasma', 'Platino', 'Holográfico'].every(x => t.indexOf(x) >= 0) && !/Dragón|Astronauta|Fénix|Unicornio/.test(t); }));
    if (OUT) await p.screenshot({ path: OUT + '/d-editor-species.png' });
    await p.evaluate(() => Whider.Sheet.closeTop()); await sleep(400);
    await p.evaluate(() => Whider.Profile.edit()); await sleep(450);
    ok('editar perfil: Personaje / Foto / Inicial', await p.evaluate(() => /Personaje/.test(document.querySelector('.sheet-layer.open').textContent) && /Inicial/.test(document.querySelector('.sheet-layer.open').textContent)));
    await p.evaluate(() => Whider.Sheet.closeTop()); await sleep(300);
    ok('sin errores (ordenador)', errs.length === 0, errs.slice(0, 6));
  }
  { // Móvil
    const { p, errs } = await setup(b, { width: 390, height: 844 }, true); await sleep(400);
    ok('dock: Hoy, Tareas, Calendario y Más', await p.evaluate(() => [...document.querySelectorAll('.dock .tab-label')].map(x => x.textContent).join(',')) === 'Hoy,Tareas,Calendario,Más');
    ok('Hoy móvil con prioridades', await p.evaluate(() => document.querySelectorAll('#screen-home .sec.top3 .task').length === 3));
    if (OUT) await p.screenshot({ path: OUT + '/m-home.png' });
    await p.click('.dock .tab[data-go="more"]'); await sleep(450);
    ok('pantalla Más', await p.evaluate(() => Whider.State.activeScreen === 'more' && document.querySelectorAll('#screen-more .mo-row').length >= 9));
    if (OUT) await p.screenshot({ path: OUT + '/m-more.png' });
    await p.click('#screen-more .mo-row[data-go="notes"]'); await sleep(450);
    ok('Cuaderno desde Más (pestaña Más marcada)', await p.evaluate(() => Whider.State.activeScreen === 'notes' && document.querySelector('.dock .tab[data-go="more"]').classList.contains('active')));
    await p.evaluate(() => Whider.Notes.newPage({})); await sleep(500);
    await p.keyboard.type('Lista de la compra'); await p.keyboard.press('Enter'); await p.keyboard.type('[] Leche'); await p.keyboard.press('Enter'); await p.keyboard.type('Pan'); await sleep(400);
    ok('barra sobre el teclado al escribir', await p.evaluate(() => document.querySelector('.kb-bar') && document.querySelector('.kb-bar').classList.contains('show')));
    if (OUT) await p.screenshot({ path: OUT + '/m-page.png' });
    await p.evaluate(() => Whider.App.handleBack()); await sleep(450);
    ok('Atrás vuelve a la portada del Cuaderno', await p.evaluate(() => Whider.State.activeScreen === 'notes' && !Whider.State.ui.page));
    if (OUT) await p.screenshot({ path: OUT + '/m-notes.png' });
    await p.evaluate(() => Whider.Router.go('chats')); await sleep(400);
    ok('Chats sin cuenta: explica qué falta', await p.evaluate(() => /cuenta|Cuentas/i.test(document.querySelector('#screen-chats').textContent)));
    ok('sin errores (móvil)', errs.length === 0, errs.slice(0, 6));
  }
  await b.close();
  console.log(results.join('\n')); console.log(failed ? '\n' + failed + ' FALLOS' : '\nTODO OK');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
