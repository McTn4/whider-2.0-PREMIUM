// Menú «/» con el teclado del móvil abierto, y menús generales en ventanas bajas (también en la app de escritorio)
const { chromium, devices } = require('playwright');
const { APP } = require('./_util');
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch();
  // 1) Móvil con teclado (simulado: 300 px de teclado)
  for (const dev of ['iPhone SE', 'Pixel 7']) {
    const ctx = await b.newContext(Object.assign({}, devices[dev]));
    await ctx.addInitScript(() => { window.WHIDER_CONFIG = { firebase: null }; localStorage.setItem('whider.meta.v1', JSON.stringify({ onboarded: true, createdAt: Date.now(), seenAchievements: [] })); });
    const p = await ctx.newPage();
    await p.goto(APP); await sleep(1500);
    await p.evaluate(() => { Whider.Notify.check = function () {}; Whider.Router.go('notes'); }); await sleep(900);
    await p.evaluate(() => { const P = Whider.Pages; const bl = []; for (let i = 0; i < 14; i++) bl.push(P.block('p', 'Línea ' + i)); bl.push(P.block('p', '')); const m = P.create({ title: 'Teclado', blocks: bl }); Whider.Notes.openPage(m.id); }); await sleep(1000);
    await p.evaluate(() => { const ed = [...document.querySelectorAll('#screen-notes [contenteditable="true"]')].pop(); ed.focus(); });
    await sleep(300);
    // Simula el teclado: la zona visible pierde 300 px y la barra del editor sube encima
    await p.evaluate(() => {
      const KB = 300, H = innerHeight;
      Whider.Layout.viewport = () => ({ top: 0, height: H - KB, bottom: H - KB, width: innerWidth, keyboard: true });
      const bar = document.querySelector('.kb-bar'); if (bar) bar.style.bottom = KB + 'px';
      window.dispatchEvent(new Event('resize'));
    });
    await p.evaluate(() => { const bar = document.querySelector('.kb-bar'); if (bar) bar.querySelector('.kb-btn').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    await sleep(500);
    if (!(await p.evaluate(() => !!document.querySelector('.bk-menu')))) { await p.keyboard.type('/'); await sleep(400); }
    const g = await p.evaluate(() => {
      const m = document.querySelector('.bk-menu'), bar = document.querySelector('.kb-bar.show'), ed = document.activeElement;
      const r = m.getBoundingClientRect(), br = bar ? bar.getBoundingClientRect() : null, er = ed.getBoundingClientRect();
      m.scrollTop = m.scrollHeight; const last = [...m.querySelectorAll('.bk-menu-i')].pop().getBoundingClientRect();
      return { menu: [Math.round(r.top), Math.round(r.bottom)], bar: br ? Math.round(br.top) : null, kbTop: innerHeight - 300, docked: m.classList.contains('docked'), last: [Math.round(last.top), Math.round(last.bottom)], line: [Math.round(er.top), Math.round(er.bottom)] };
    });
    ok(g.docked && g.menu[1] <= (g.bar || g.kbTop) && g.menu[0] >= 0, dev + ' con teclado: el menú queda entero encima de la barra del teclado ' + JSON.stringify(g));
    ok(g.last[1] <= g.menu[1] + 1 && g.last[0] >= g.menu[0], dev + ' con teclado: la última opción se ve al bajar');
    ok(g.line[1] <= g.menu[0] + 2, dev + ' con teclado: la línea que se escribe sigue a la vista por encima del menú');
    await ctx.close();
  }
  // 2) Menú general (Nueva página del Cuaderno) en ventanas bajas y en la app de escritorio de Windows
  for (const [label, w, h, app] of [['Ventana baja 1280×560', 1280, 560, false], ['App Windows 1280×600', 1280, 600, true]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h } });
    if (app) await ctx.addInitScript(() => { window.WhiderDesktop = { platform: 'win32', getSettings: () => Promise.resolve({}), setSetting: () => Promise.resolve(), onCommand() {}, setBadge() {}, showWindow() {} }; });
    await ctx.addInitScript(() => { window.WHIDER_CONFIG = { firebase: null }; localStorage.setItem('whider.meta.v1', JSON.stringify({ onboarded: true, createdAt: Date.now(), seenAchievements: [] })); });
    const p = await ctx.newPage();
    await p.goto(APP); await sleep(1500);
    await p.evaluate(() => { Whider.Notify.check = function () {}; Whider.Router.go('notes'); }); await sleep(1000);
    await p.click('#screen-notes .pt-new'); await sleep(500);
    const g = await p.evaluate(() => { const m = document.querySelector('.menu-layer .menu'); const r = m.getBoundingClientRect(); m.scrollTop = m.scrollHeight; const last = [...m.querySelectorAll('.menu-item')].pop(); const lr = last.getBoundingClientRect(); const hit = document.elementFromPoint(lr.left + lr.width / 2, lr.top + lr.height / 2); return { top: Math.round(r.top), bottom: Math.round(r.bottom), vh: innerHeight, scrollable: m.scrollHeight > m.clientHeight, lastHit: !!hit && last.contains(hit), last: last.textContent.trim().slice(0, 30) }; });
    const minTop = app ? 34 + 8 : 8;
    ok(g.top >= minTop && g.bottom <= g.vh - 8, label + ': el menú cabe en la ventana' + (app ? ' y no tapa la franja de título' : '') + ' ' + JSON.stringify(g));
    ok(g.lastHit, label + ': la última opción («' + g.last + '») se puede pulsar');
    await ctx.close();
  }
  await b.close();
  console.log(fails ? fails + ' FALLOS' : 'TODO OK'); process.exit(fails ? 1 : 0);
})();
