// ¿Se puede bajar dentro del menú «/» y elegir la última opción? (ordenador con rueda y móvil arrastrando)
const { chromium, devices } = require('playwright');
const { APP } = require('./_util');
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fails++; };
async function run(label, ctxOpts, mobile) {
  const b = await chromium.launch();
  const ctx = await b.newContext(ctxOpts);
  await ctx.addInitScript(() => { window.WHIDER_CONFIG = { firebase: null }; localStorage.setItem('whider.meta.v1', JSON.stringify({ onboarded: true, createdAt: Date.now(), seenAchievements: [] })); });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(APP); await sleep(1600);
  await p.evaluate(() => { Whider.Notify.check = function () {}; Whider.Router.go('notes'); }); await sleep(900);
  await p.evaluate(() => { const P = Whider.Pages; const m = P.create({ title: 'Menús', blocks: [P.block('p', 'Uno'), P.block('p', '')] }); Whider.Notes.openPage(m.id); }); await sleep(1000);
  await p.evaluate(() => { const ed = [...document.querySelectorAll('#screen-notes [contenteditable="true"]')].pop(); ed.focus(); });
  await p.keyboard.type('/'); await sleep(500);
  const box = await p.locator('.bk-menu').boundingBox();
  if (mobile) {
    const cdp = await ctx.newCDPSession(p); const x = box.x + box.width / 2;
    for (let i = 0; i < 6; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: box.y + box.height - 20 }] });
      for (let k = 1; k <= 8; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: box.y + box.height - 20 - k * 30 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(120);
    }
  } else {
    await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    for (let i = 0; i < 12; i++) { await p.mouse.wheel(0, 200); await sleep(60); }
  }
  await sleep(400);
  const st = await p.evaluate(() => { const m = document.querySelector('.bk-menu'); return m ? { scrollTop: Math.round(m.scrollTop), max: m.scrollHeight - m.clientHeight } : null; });
  ok(st && st.scrollTop > st.max * 0.8, label + ': se puede bajar hasta el final del menú (scrollTop ' + (st && st.scrollTop) + ' de ' + (st && st.max) + ')');
  // Elegir la última opción con un clic/toque normal
  const last = p.locator('.bk-menu .bk-menu-i').last();
  const lastText = (await last.textContent()).trim().slice(0, 30);
  const dbBefore = await p.evaluate(() => Whider.Pages.all().filter(x => x.kind === 'db').length);
  await last.click(); await sleep(700);
  const dbAfter = await p.evaluate(() => Whider.Pages.all().filter(x => x.kind === 'db').map(x => Whider.Pages.title(x) + ' (dentro de ' + (x.parent ? Whider.Pages.title(x.parent) : '—') + ')'));
  ok(dbAfter.length === dbBefore + 1 && /Menús/.test(dbAfter[dbAfter.length - 1]), label + ': la última opción «' + lastText + '» funciona → ' + dbAfter.join(', '));
  ok(!errs.length, label + ': sin errores ' + JSON.stringify(errs));
  await b.close();
}
(async () => {
  await run('Ordenador', { viewport: { width: 1280, height: 720 } }, false);
  await run('Móvil', Object.assign({}, devices['Pixel 7']), true);
  console.log(fails ? fails + ' FALLOS' : 'TODO OK'); process.exit(fails ? 1 : 0);
})();
