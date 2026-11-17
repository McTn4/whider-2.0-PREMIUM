// El menú de cada bloque: grupos y que en un archivo no aparezca «Convertir en»
const { chromium } = require('playwright'); const path = require('path');
const { APP, FX, fixtures } = require('./_util');
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); await fixtures(b); const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } });
  await ctx.addInitScript(() => { window.WHIDER_CONFIG = { firebase: null }; localStorage.setItem('whider.meta.v1', JSON.stringify({ onboarded: true, createdAt: Date.now() })); });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(APP); await sleep(1500);
  await p.evaluate(() => { Whider.Notify.check = function () {}; Whider.Router.go('notes'); }); await sleep(900);
  await p.evaluate(() => { const P = Whider.Pages; const m = P.create({ title: 'Menú', blocks: [P.block('p', 'Texto'), P.block('p', '')] }); Whider.Notes.openPage(m.id); }); await sleep(900);
  await p.click('#screen-notes .bk-text >> nth=0');
  const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('.pg-addons button:has-text("Adjuntar")')]);
  await fc.setFiles([path.join(FX, 'Factura marzo.pdf')]); await sleep(1200);
  const labels = async sel => { const blk = p.locator(sel).first(); await blk.hover(); await blk.locator('.bk-handle').click(); await sleep(350); const l = await p.locator('.menu .menu-item').allInnerTexts(); const gaps = await p.locator('.menu .menu-gap').count(); await p.keyboard.press('Escape'); await p.mouse.click(5, 400); await sleep(300); return { l: l.map(x => x.split('\n')[0]), gaps }; };
  const text = await labels('#screen-notes .bk[data-t="p"]');
  const file = await labels('#screen-notes .bk[data-t="file"]');
  ok(text.l[0] === 'Convertir en…' && text.gaps >= 3, 'texto: ' + text.l.join(' · ') + ' (' + text.gaps + ' separadores)');
  ok(file.l[0] === 'Abrir' && file.l.indexOf('Convertir en…') < 0 && file.l.indexOf('Copiar el nombre') >= 0, 'archivo: ' + file.l.join(' · '));
  ok(!errs.length, 'sin errores ' + JSON.stringify(errs));
  await b.close(); console.log(fails ? fails + ' FALLOS' : 'TODO OK'); process.exit(fails ? 1 : 0);
})();
