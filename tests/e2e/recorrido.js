// Recorrer todas las pantallas en ordenador y móvil, sin errores, con capturas (opcional: carpeta en el argumento)
const { chromium } = require('playwright');
const { APP } = require('./_util');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const URL = APP,
  OUT = process.argv[2];
const results = [];
let failed = 0;
const ok = (n, c, x) => {
  results.push((c ? 'OK   ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + JSON.stringify(x) : ''));
  if (!c) failed++;
};
async function setup(b, viewport, mobile) {
  const ctx = await b.newContext(Object.assign({ viewport }, mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}));
  await ctx.addInitScript(() => {
    window.WHIDER_CONFIG = { firebase: null };
    localStorage.setItem('whider.meta.v1', JSON.stringify({ onboarded: true, createdAt: Date.now() }));
  });
  const p = await ctx.newPage();
  p.setDefaultTimeout(5000);
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => {
    if (m.type() === 'error') errs.push('console: ' + m.text());
  });
  await p.goto(URL);
  await sleep(1500);
  await p.evaluate(() => {
    Whider.Notify.check = function () {};
    const S = Whider.State;
    // Sin categorías de serie: la de Trabajo la crea quien la quiere
    const work = S.addList('Trabajo', 'iris', 'briefcase').id;
    const t = Whider.U.today(),
      add = (text, h, time, repeat) => S.addTask({ text, date: t, time: time || null, highlight: h || 'none', listId: work, warn: false, repeat: repeat || 'none' });
    add('Preparar la propuesta', 'danger', '10:00');
    add('Llamar a Ana', 'purple', '12:00');
    add('Revisar correo');
    add('Comprar pan', 'star');
    add('Enviar factura', 'none', '17:00');
    add('Leer 20 minutos', 'none', null, 'daily');
  });
  return { p, errs };
}
(async () => {
  const b = await chromium.launch();
  {
    // Ordenador
    const { p, errs } = await setup(b, { width: 1440, height: 900 });
    await sleep(400);
    const hoy = await p.evaluate(() => ({
      cada: [...document.querySelectorAll('#screen-home .daily-sec .task-title')].map((x) => x.textContent),
      todo: [...document.querySelectorAll('#screen-home .todo-sec .task-title')].map((x) => x.textContent)
    }));
    ok('Inicio: «Cada día» con la diaria', hoy.cada.join() === 'Leer 20 minutos', hoy.cada);
    ok('Inicio: «Por hacer» por importancia (urgente, importante, destacada, normal)', hoy.todo[0] === 'Preparar la propuesta' && hoy.todo[1] === 'Llamar a Ana' && hoy.todo[2] === 'Comprar pan', hoy.todo);
    ok('barra lateral: Inicio, Tareas, Calendario, Cuaderno y Personas', await p.evaluate(() => [...document.querySelectorAll('#sidebar .sb-nav .sb-label')].map((x) => x.textContent).join()) === 'Inicio,Tareas,Calendario,Cuaderno,Personas');
    ok('foto de perfil con la inicial', await p.evaluate(() => !!document.querySelector('#sidebar .sb-profile .avatar')));
    if (OUT) await p.screenshot({ path: OUT + '/d-home.png' });
    for (const [k, scr] of [
      ['2', 'tasks'],
      ['3', 'calendar'],
      ['4', 'notes'],
      ['5', 'friends'],
      ['1', 'home']
    ]) {
      await p.keyboard.press(k);
      await sleep(350);
      ok('tecla ' + k + ' → ' + scr, (await p.evaluate(() => Whider.State.activeScreen)) === scr);
      if (OUT) await p.screenshot({ path: OUT + '/d-' + scr + '.png' });
    }
    // Rutas de lo que ya no existe: llevan a lo más parecido
    for (const [r, to] of [
      ['habits', 'tasks'],
      ['focus', 'home'],
      ['stats', 'home'],
      ['progress', 'home'],
      ['more', 'home']
    ]) {
      await p.evaluate((x) => Whider.Router.go(x), r);
      await sleep(250);
      ok('«' + r + '» lleva a ' + to, (await p.evaluate(() => Whider.State.activeScreen)) === to);
    }
    await p.evaluate(() => Whider.Profile.edit());
    await sleep(450);
    ok('editar perfil: foto o inicial (sin personaje)', await p.evaluate(() => !/Personaje/.test(document.querySelector('.sheet-layer.open').textContent)));
    await p.evaluate(() => Whider.Sheet.closeTop());
    await sleep(300);
    ok('sin errores (ordenador)', errs.length === 0, errs.slice(0, 6));
  }
  {
    // Móvil
    const { p, errs } = await setup(b, { width: 390, height: 844 }, true);
    await sleep(400);
    ok('barra inferior: Inicio, Tareas, Calendario, Cuaderno y Personas', (await p.evaluate(() => [...document.querySelectorAll('.dock .tab-label')].map((x) => x.textContent).join(','))) === 'Inicio,Tareas,Calendario,Cuaderno,Personas');
    ok('Inicio móvil: «Cada día» y «Por hacer»', await p.evaluate(() => !!document.querySelector('#screen-home .daily-sec') && document.querySelectorAll('#screen-home .todo-sec .task').length === 5));
    if (OUT) await p.screenshot({ path: OUT + '/m-home.png' });
    await p.click('.dock .tab[data-go="notes"]');
    await sleep(450);
    ok('Cuaderno desde la barra', await p.evaluate(() => Whider.State.activeScreen === 'notes' && document.querySelector('.dock .tab[data-go="notes"]').classList.contains('active')));
    await p.evaluate(() => Whider.Notes.newPage({}));
    await sleep(500);
    await p.keyboard.type('Lista de la compra');
    await p.keyboard.press('Enter');
    await p.keyboard.type('[] Leche');
    await p.keyboard.press('Enter');
    await p.keyboard.type('Pan');
    await sleep(400);
    ok('barra sobre el teclado al escribir', await p.evaluate(() => document.querySelector('.kb-bar') && document.querySelector('.kb-bar').classList.contains('show')));
    if (OUT) await p.screenshot({ path: OUT + '/m-page.png' });
    await p.evaluate(() => Whider.App.handleBack());
    await sleep(450);
    ok('Atrás vuelve a la portada del Cuaderno', await p.evaluate(() => Whider.State.activeScreen === 'notes' && !Whider.State.ui.page));
    await p.click('.dock .tab[data-go="friends"]');
    await sleep(450);
    ok('Personas sin cuenta: explica qué falta', await p.evaluate(() => Whider.State.activeScreen === 'friends' && /cuenta|Cuentas/i.test(document.querySelector('#screen-friends').textContent)));
    await p.evaluate(() => Whider.Router.go('chats'));
    await sleep(400);
    ok('Chats: la pestaña marcada es Personas', await p.evaluate(() => document.querySelector('.dock .tab[data-go="friends"]').classList.contains('active')));
    ok('sin la foto arriba a la izquierda: el engranaje, a la derecha', await p.evaluate(() => !document.querySelector('.screen.active .avatar-btn') && !!document.querySelector('.screen.active .nav-trail .gear-btn')));
    await p.click('.screen.active .gear-btn');
    await sleep(500);
    ok('el engranaje abre los Ajustes', await p.evaluate(() => Whider.Settings.isOpen()));
    ok('sin errores (móvil)', errs.length === 0, errs.slice(0, 6));
  }
  await b.close();
  console.log(results.join('\n'));
  console.log(failed ? '\n' + failed + ' FALLOS' : '\nTODO OK');
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
