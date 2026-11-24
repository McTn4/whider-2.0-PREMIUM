// Barra flotante del móvil: cuatro secciones con el «+» en el centro, una sola activa siempre, el «pulsado» solo en la
// pestaña tocada y Personas arriba, junto a tu foto
const { chromium, devices } = require('playwright');
const path = require('path');
const { APP, OUT: CAPTURAS } = require('./_util');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const OUT = process.argv[2] || path.join(CAPTURAS, 'barra-inferior'); require('fs').mkdirSync(OUT, { recursive: true });
const DEVS = [['iPhone SE', devices['iPhone SE']], ['iPhone 12', devices['iPhone 12']], ['Pixel 7', devices['Pixel 7']], ['iPhone 14 Pro Max', devices['iPhone 14 Pro Max']], ['Tableta', { viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, userAgent: devices['Pixel 7'].userAgent }]];
let fails = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch();
  for (const [name, dev] of DEVS) {
    const ctx = await b.newContext(Object.assign({}, dev));
    await ctx.addInitScript(() => { window.WHIDER_CONFIG = { firebase: null }; localStorage.setItem('whider.meta.v1', JSON.stringify({ onboarded: true, createdAt: Date.now(), seenAchievements: [] })); });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(APP); await sleep(1600);
    await p.evaluate(() => { Whider.Notify.check = function () {}; Whider.State.addTask({ text: 'Vencida', date: Whider.U.addDays(Whider.U.today(), -1) }); Whider.Router.refresh(); });
    const actives = () => p.evaluate(() => [...document.querySelectorAll('.dock .tab.active')].map(t => t.dataset.go).join(','));
    ok((await actives()) === 'home', name + ': al abrir, solo Hoy activa (' + await actives() + ')');
    ok((await p.evaluate(() => [...document.querySelector('.dock').children].map(t => t.dataset.go || t.id).join())) === 'home,tasks,fab,calendar,notes', name + ': Inicio, Tareas, «+», Calendario y Cuaderno');
    // Flota: separada de los bordes, redondeada y con el «+» en el centro de la pantalla
    const geo = await p.evaluate(() => {
      const d = document.querySelector('.dock').getBoundingClientRect(), f = document.getElementById('fab').getBoundingClientRect();
      return { left: d.left, right: innerWidth - d.right, bottom: innerHeight - d.bottom, radius: parseFloat(getComputedStyle(document.querySelector('.dock')).borderTopLeftRadius), center: Math.abs(f.left + f.width / 2 - innerWidth / 2) };
    });
    ok(geo.left >= 8 && geo.right >= 8 && geo.bottom >= 8 && geo.radius >= 24 && geo.center < 2, name + ': barra flotante y «+» centrado ' + JSON.stringify(geo));
    // Personas: arriba, junto a tu foto
    ok(await p.evaluate(() => { const b = document.querySelector('#screen-home .people-btn'); return !!b && b.offsetWidth > 0; }), name + ': Personas está arriba, junto a tu foto');
    await p.tap('#screen-home .people-btn'); await sleep(350);
    ok(await p.evaluate(() => Whider.State.activeScreen === 'friends'), name + ': el botón de Personas abre Personas');
    ok((await actives()) === '', name + ': en Personas no se marca ninguna pestaña de abajo (' + await actives() + ')');
    const seq = ['tasks', 'calendar', 'notes', 'home', 'tasks', 'notes', 'calendar'];
    let good = true;
    for (const id of seq) { await p.tap('.dock .tab[data-go="' + id + '"]'); await sleep(250); const a = await actives(); if (a !== id) { good = false; console.log('   tras ' + id + ' → ' + a); } }
    ok(good, name + ': tras 7 cambios de pestaña, siempre una sola activa');
    await p.evaluate(() => Whider.Router.go('chats')); await sleep(300);
    ok((await actives()) === '', name + ': dentro de Chats no se marca ninguna pestaña de abajo');
    // Pulsar y mantener: solo cambia la cápsula de la pestaña tocada
    const cdp = await ctx.newCDPSession(p);
    const bg = () => p.evaluate(() => [...document.querySelectorAll('.dock .tab')].map(t => getComputedStyle(t).opacity + '|' + getComputedStyle(t.querySelector('.tab-ic')).backgroundColor));
    await p.evaluate(() => Whider.Router.go('home')); await sleep(300);
    const before = await bg();
    await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
    const doc = await cdp.send('DOM.getDocument');
    const node = await cdp.send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: '.dock .tab[data-go="calendar"]' });
    await cdp.send('CSS.forcePseudoState', { nodeId: node.nodeId, forcedPseudoClasses: ['active'] }); await sleep(300);
    const during = await bg();
    const dock = await p.locator('.dock').boundingBox();
    await p.screenshot({ path: OUT + '/' + name.replace(/ /g, '_') + '.png', clip: { x: 0, y: Math.max(0, dock.y - 12), width: p.viewportSize().width, height: dock.height + 24 } });
    await cdp.send('CSS.forcePseudoState', { nodeId: node.nodeId, forcedPseudoClasses: [] }); await sleep(200);
    const changed = during.map((v, i) => v !== before[i] ? i : -1).filter(i => i >= 0);
    ok(changed.length === 1 && changed[0] === 2, name + ': al pulsar Calendario solo se atenúa esa pestaña (cambian: ' + changed.join(',') + ')');
    const fab = await p.evaluate(() => getComputedStyle(document.getElementById('fab')).boxShadow);
    ok(!/255, 255, 255/.test(fab), name + ': el botón + no tiene halo blanco');
    ok(!errs.length, name + ': sin errores ' + JSON.stringify(errs));
    await ctx.close();
  }
  await b.close();
  console.log(fails ? fails + ' FALLOS' : 'TODO OK'); process.exit(fails ? 1 : 0);
})();
