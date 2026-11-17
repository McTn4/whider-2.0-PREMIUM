// La copia de seguridad incluye el Cuaderno y se recupera en otro dispositivo
const { chromium } = require('playwright');
const { APP } = require('./_util');
(async () => {
  const b = await chromium.launch();
  const mk = async () => { const ctx = await b.newContext(); await ctx.addInitScript(() => { window.WHIDER_CONFIG = { firebase: null }; if (!localStorage.getItem('whider.meta.v1')) localStorage.setItem('whider.meta.v1', JSON.stringify({ onboarded: true, createdAt: Date.now(), seenAchievements: [] })); }); const p = await ctx.newPage(); await p.goto(APP); await p.waitForTimeout(1500); return p; };
  const A = await mk();
  const snap = await A.evaluate(() => {
    const P = Whider.Pages; const pg = P.create({ title: 'Mi página', blocks: [P.block('h1', 'Hola'), P.block('todo', 'Una casilla')] }); P.newDb('Tabla', pg.id);
    let out = null; const orig = Whider.U.saveFile; Whider.U.saveFile = (n, t) => { out = t; }; Whider.Settings.open('data'); 
    return new Promise(r => setTimeout(() => { const cell = [...document.querySelectorAll('.sheet-layer.open .cell')].find(c => /Guardar una copia/.test(c.textContent)); cell.click(); Whider.U.saveFile = orig; r(out); }, 600));
  });
  const data = JSON.parse(snap);
  console.log((data.pages && data.pages.length === 2 ? 'OK   ' : 'FAIL ') + 'la copia lleva las páginas → ' + (data.pages || []).length);
  const B = await mk();
  await B.evaluate(txt => { const data = JSON.parse(txt); const merged = Whider.Sync.merge(Whider.State.snapshot(), data); Whider.State.applySnapshot(merged, 'import'); return null; }, snap);
  const restored = await B.evaluate(txt => {
    // Mismo camino que «Recuperar una copia»: aplica las páginas
    const data = JSON.parse(txt); data.pages.forEach(x => { Whider.Pages.applyMeta(Object.assign({}, x.meta, { team: null })); Whider.Pages.applyContent(x.meta.id, x.content, x.meta.cv); });
    const m = Whider.Pages.all().filter(x => x.title === 'Mi página')[0]; return m ? Whider.Pages.content(m.id).blocks.map(b => Whider.Pages.plain(b.x || '')) : null;
  }, snap);
  console.log((restored && restored.indexOf('Una casilla') >= 0 ? 'OK   ' : 'FAIL ') + 'páginas recuperadas en otro dispositivo → ' + JSON.stringify(restored));
  await b.close();
})();
