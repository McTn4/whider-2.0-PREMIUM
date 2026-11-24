// 1.1 · Tema claro
//  - Ajustes → Apariencia → Tema: Oscuro (el de siempre), Claro o «Como el sistema». Se aplica al momento en toda la
//    app (fondo, superficies, barra de abajo, hojas) y queda guardado.
//  - Sin destello al abrir: el tema ya está puesto antes de que se pinte la página.
//  - «Como el sistema» sigue al dispositivo, también si cambia con la app abierta.
//  - Contraste AA (axe, color-contrast) en claro en todas las pantallas, Ajustes, nueva tarea y personaje.
//  - El alto contraste también funciona en claro.
const { chromium } = require('playwright');
const fs = require('fs');
const { APP, AXE: AXE_RUTA, axePrep } = require('./_util');

const AXE = fs.readFileSync(AXE_RUTA, 'utf8');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (c, m, x) => { console.log((c ? 'OK   ' : 'FAIL ') + m + (!c && x !== undefined ? '  → ' + JSON.stringify(x) : '')); if (!c) fails++; };
const state = (p) => p.evaluate(() => ({
  th: document.documentElement.getAttribute('data-theme'),
  atBody: window.__themeAtBody,
  bg: getComputedStyle(document.body).backgroundColor,
  meta: document.querySelector('meta[name="theme-color"]').getAttribute('content'),
  saved: (JSON.parse(localStorage.getItem('whider.settings.v2') || '{}')).theme,
  ui: JSON.parse(localStorage.getItem('whider.ui') || '{}')
}));
const closeAll = (p) => p.evaluate(() => { for (let i = 0; i < 8 && Whider.Sheet.closeTop(); i++); });
const pick = async (p, label) => { await p.click('#sheetRoot .sheet-layer:last-child button:text-is("' + label + '")'); await sleep(350); };

async function contrast(p, label, bad) {
  await axePrep(p);
  await p.evaluate(AXE);
  const r = await p.evaluate(async () => {
    const res = await axe.run(document, { runOnly: { type: 'rule', values: ['color-contrast'] }, resultTypes: ['violations'] });
    return res.violations.flatMap((v) => v.nodes.map((n) => n.target.join(' ') + ' :: ' + (n.any[0] && n.any[0].message || '').slice(0, 110)));
  });
  for (const x of r) bad.push(label + ' · ' + x);
}

(async () => {
  const b = await chromium.launch();
  for (const [nombre, viewport] of [['móvil', { width: 390, height: 844 }], ['ordenador', { width: 1280, height: 860 }]]) {
    const ctx = await b.newContext({ viewport, colorScheme: 'dark' });
    await ctx.addInitScript(() => {
      window.WHIDER_CONFIG = { firebase: null };
      if (!localStorage.getItem('whider.meta.v1')) localStorage.setItem('whider.meta.v1', JSON.stringify({ onboarded: true, createdAt: Date.now() - 9e8 }));
      localStorage.setItem('whider.seenVersion', '999.0.0');
      // El tema que hay en el momento en que aparece <body>: antes de pintar nada
      new MutationObserver(function (m, obs) {
        if (document.body) { window.__themeAtBody = document.documentElement.getAttribute('data-theme'); obs.disconnect(); }
      }).observe(document, { childList: true, subtree: true });
    });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(APP);
    await sleep(1600);
    await p.evaluate(() => { const S = Whider.State, td = Whider.U.today(); S.addTask({ text: 'Enviar el presupuesto', date: td, time: '10:00', highlight: 'danger' }); S.addTask({ text: 'Revisar el informe', date: td, highlight: 'purple' }); Whider.Router.refresh(); });

    let s = await state(p);
    ok(s.th === 'dark' && s.atBody === 'dark' && s.bg === 'rgb(18, 19, 22)' && s.meta === '#121316', nombre + ': por defecto, el tema oscuro (fondo grafito)', s);

    // Ajustes → Apariencia → Tema → Claro
    await p.evaluate(() => Whider.Settings.open('appearance'));
    await sleep(600);
    const opts = await p.evaluate(() => [...document.querySelectorAll('#sheetRoot .sheet-layer:last-child .segmented')][0].innerText.replace(/\s+/g, ' ').trim());
    ok(opts === 'Oscuro Claro Como el sistema', nombre + ': Apariencia empieza por el tema (Oscuro, Claro, Como el sistema)', opts);
    await pick(p, 'Claro');
    s = await state(p);
    ok(s.th === 'light' && s.bg === 'rgb(246, 247, 249)' && s.meta === '#F6F7F9', nombre + ': «Claro» se aplica al momento (fondo y barra del navegador)', s);
    ok(s.saved === 'light' && s.ui.th === 'light' && !s.ui.sys, nombre + ': y queda guardado', s);
    const sheet = await p.evaluate(() => { const el = document.querySelector('#sheetRoot .sheet-layer:last-child .sheet'), cs = getComputedStyle(el); return { bg: cs.backgroundColor, cell: cs.getPropertyValue('--cell').trim(), t1: getComputedStyle(document.documentElement).getPropertyValue('--t1').trim() }; });
    ok(sheet.bg === 'rgb(255, 255, 255)' && /^#F3F4F6$/i.test(sheet.cell) && /^#14161A$/i.test(sheet.t1), nombre + ': hojas blancas con celdas grises claras y texto casi negro', sheet);
    await closeAll(p);
    await sleep(400);
    if (nombre === 'móvil') {
      const dock = await p.evaluate(() => getComputedStyle(document.querySelector('.dock')).backgroundColor);
      ok(/^rgba?\(255, 255, 255/.test(dock), 'móvil: la barra flotante, clara (translúcida)', dock);
    } else {
      const logo = await p.evaluate(() => getComputedStyle(document.querySelector('#topbar .tb-brand svg')).color);
      ok(logo === 'rgb(20, 22, 26)', 'ordenador: el logotipo de la barra superior se ve (oscuro sobre claro)', logo);
    }

    // Sin destello: al recargar, el tema ya está puesto cuando aparece <body>
    await p.reload();
    await sleep(1500);
    s = await state(p);
    ok(s.atBody === 'light' && s.th === 'light', nombre + ': al abrir de nuevo, claro desde el primer momento (sin destello oscuro)', s);

    // Contraste AA en claro en toda la app
    const bad = [];
    for (const id of ['home', 'tasks', 'calendar', 'notes', 'friends', 'chats']) {
      await p.evaluate((x) => Whider.Router.go(x), id);
      await sleep(450);
      await contrast(p, id, bad);
    }
    for (const pg of [null, 'appearance', 'custom', 'alerts', 'data', 'privacy']) {
      await closeAll(p);
      await sleep(350);
      await p.evaluate((x) => Whider.Settings.open(x || undefined), pg);
      await sleep(550);
      await contrast(p, 'ajustes-' + (pg || 'portada'), bad);
    }
    await closeAll(p);
    await sleep(350);
    await p.evaluate(() => Whider.QuickAdd.open({}));
    await sleep(550);
    await contrast(p, 'nueva-tarea', bad);
    await closeAll(p);
    await sleep(350);
    await p.evaluate(() => Whider.Onboarding.start());
    await sleep(650);
    await contrast(p, 'presentacion', bad);
    await p.evaluate(() => document.querySelector('#onboardingRoot .ob-top .nav-btn').click());
    await sleep(500);
    await closeAll(p);
    ok(!bad.length, nombre + ': contraste AA en claro en todas las pantallas, Ajustes, nueva tarea y la presentación', bad.slice(0, 6));

    // Alto contraste, también en claro: textos secundarios más oscuros
    await p.evaluate(() => Whider.State.setSetting('contrast', 'high'));
    await sleep(300);
    const t3 = await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--t3').trim());
    ok(/^#2F3A44$/i.test(t3), nombre + ': alto contraste en claro (texto secundario más oscuro)', t3);
    await p.evaluate(() => Whider.State.setSetting('contrast', 'normal'));

    // «Como el sistema»: sigue al dispositivo, también con la app abierta
    await p.evaluate(() => Whider.Settings.open('appearance'));
    await sleep(600);
    await pick(p, 'Como el sistema');
    s = await state(p);
    ok(s.th === 'dark' && s.saved === 'system' && s.ui.sys === true, nombre + ': «Como el sistema» con el dispositivo en oscuro → oscuro', s);
    await p.emulateMedia({ colorScheme: 'light' });
    await sleep(300);
    s = await state(p);
    ok(s.th === 'light' && s.meta === '#F6F7F9', nombre + ': el dispositivo pasa a claro con la app abierta → claro al momento', s);
    await closeAll(p);
    await p.reload();
    await sleep(1500);
    s = await state(p);
    ok(s.atBody === 'light' && s.th === 'light', nombre + ': y al abrir de nuevo, ya en claro antes de pintar', s);
    await p.emulateMedia({ colorScheme: 'dark' });
    await sleep(300);
    ok((await state(p)).th === 'dark', nombre + ': el dispositivo vuelve a oscuro → oscuro');

    // Volver al oscuro de siempre
    await p.evaluate(() => Whider.Settings.open('appearance'));
    await sleep(600);
    await pick(p, 'Oscuro');
    s = await state(p);
    ok(s.th === 'dark' && s.bg === 'rgb(18, 19, 22)' && s.saved === 'dark', nombre + ': «Oscuro» vuelve al tema de siempre', s);

    ok(!errs.length, nombre + ': sin errores', errs.slice(0, 3));
    await ctx.close();
  }
  await b.close();
  console.log(fails ? fails + ' FALLOS' : 'TODO OK');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
